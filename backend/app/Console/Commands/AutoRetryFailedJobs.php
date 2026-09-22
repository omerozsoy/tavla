<?php

namespace App\Console\Commands;

use App\Support\Alert;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * SINIRLI + ALARMLI otomatik yeniden deneme (failed_jobs).
 *
 * NEDEN: "queue:retry all"ı kör bir cron'a bağlamak KALICI bozuk işleri sonsuza dek döndürür
 * (retry -> tekrar patlar -> yeni failed_jobs satırı -> tekrar retry ...). Bu komut bunu SINIRLAR:
 *
 *   - Her başarısız işi, İMZASINA (job sınıfı + serialized constructor argümanları) göre izler.
 *     İmza retry'lar arası SABİT kalır (uuid değişir, imza değişmez) -> gerçek deneme sayısı sayılır.
 *   - İmza MAX_ATTEMPTS'ten az denendiyse: sadece O işi yeniden dener (queue:retry <uuid>).
 *   - MAX'ı aşarsa: DENEMEZ. Bir kez admin'e ALARM verir (Alert::send) ve satırı panelde BIRAKIR
 *     -> gerçek bug gizlenmez, gnubg/DB çağrı fırtınası olmaz.
 *
 * Böylece geçici hatalar (gnubg 1 dk down, DB blip) sessizce düzelir; kalıcı hatalar görünür kalır.
 *
 * Zamanlama: routes/console.php -> everyFifteenMinutes (schedule:run cron'u şart).
 * Elle: php artisan jobs:auto-retry --dry-run    (sadece raporla)
 */
class AutoRetryFailedJobs extends Command
{
    protected $signature = 'jobs:auto-retry
        {--max=3 : Bir iş imzası için üst sınır otomatik deneme sayısı}
        {--dry-run : Sadece raporla; retry/alarm yok}';

    protected $description = 'Başarısız kuyruk işlerini SINIRLI (imza başına N) yeniden dener; sınırı aşanı ALARMLA bırakır';

    /** İmza deneme sayacı ne kadar hatırlansın (retry döngüsü bu pencereye sığar). */
    private const COUNTER_TTL_HOURS = 24;

    /** Aynı kalıcı-bozuk iş için ne sıklıkla realert (spam önleme). */
    private const REALERT_HOURS = 6;

    public function handle(): int
    {
        if (! Schema::hasTable('failed_jobs')) {
            $this->info('failed_jobs tablosu yok — atlandı.');

            return self::SUCCESS;
        }

        $max = max(1, (int) $this->option('max'));
        $dry = (bool) $this->option('dry-run');

        $rows = DB::table('failed_jobs')->orderBy('id')->get(['id', 'uuid', 'queue', 'payload', 'exception']);
        if ($rows->isEmpty()) {
            $this->info('Başarısız iş yok. ✓');

            return self::SUCCESS;
        }

        $retried = 0;
        $exhausted = 0;
        $exhaustedList = [];

        foreach ($rows as $row) {
            $sig = $this->signature($row->payload);
            $counterKey = "failjob:retry:{$sig}";
            $attempts = (int) Cache::get($counterKey, 0);
            [$job, $short] = $this->describe($row->payload, $row->exception);

            if ($attempts >= $max) {
                // ÜST SINIR AŞILDI -> retry etme, panelde bırak, (spam-önleyici) bir kez alarm ver.
                $exhausted++;
                $exhaustedList[] = "{$job} ({$attempts}× denendi)";
                $alertKey = "failjob:alerted:{$sig}";
                if (! $dry && ! Cache::get($alertKey)) {
                    Cache::put($alertKey, time(), now()->addHours(self::REALERT_HOURS));
                    Alert::send(
                        "🔴 Kuyruk işi KALICI başarısız (otomatik retry sınırı {$max}× aşıldı):\n".
                        "{$job}\n{$short}\n\nAdmin → Güvenlik → Başarısız İşler'den incele. ".
                        'Otomatik yeniden deneme DURDURULDU (döngü önlendi).',
                        'TavlaTV — Kalıcı Kuyruk Hatası'
                    );
                }

                continue;
            }

            // Sınır içinde -> bu işi yeniden dene.
            if ($dry) {
                $this->line("  [dry] retry #".($attempts + 1)."/{$max}: {$job}");
                $retried++;

                continue;
            }

            Cache::put($counterKey, $attempts + 1, now()->addHours(self::COUNTER_TTL_HOURS));
            try {
                // Yalnız BU uuid'yi yeniden dene (queue:retry all değil -> kontrollü).
                Artisan::call('queue:retry', ['id' => [$row->uuid]]);
                $retried++;
            } catch (\Throwable $e) {
                Log::warning('jobs:auto-retry: queue:retry patladı', ['uuid' => $row->uuid, 'err' => $e->getMessage()]);
            }
        }

        $msg = "jobs:auto-retry: {$rows->count()} başarısız iş | {$retried} yeniden denendi | {$exhausted} sınır-aşımı (bırakıldı)";
        $this->info($msg);
        if ($exhausted > 0) {
            $this->warn('Sınırı aşan (alarm verildi, panelde bırakıldı): '.implode(', ', array_slice($exhaustedList, 0, 10)));
        }
        Log::info($msg, ['exhausted' => $exhaustedList]);

        return self::SUCCESS;
    }

    /**
     * İş imzası: job sınıfı + serialized constructor argümanları. Retry'lar arası SABİT
     * (uuid değişir, bu değişmez) -> aynı mantıksal işin gerçek deneme sayısını sayar.
     */
    private function signature(string $payload): string
    {
        $data = json_decode($payload, true);
        $name = is_array($data) ? ($data['displayName'] ?? 'job') : 'job';
        // command = serialized job nesnesi (matchResultId gibi argümanları içerir -> maça özgü).
        $cmd = is_array($data) ? ($data['data']['command'] ?? '') : '';

        return sha1($name.'|'.$cmd);
    }

    /** İnsan-okur: job kısa adı + exception ilk satırı (kısaltılmış). */
    private function describe(string $payload, ?string $exception): array
    {
        $data = json_decode($payload, true);
        $name = is_array($data) ? ($data['displayName'] ?? 'job') : 'job';
        $job = class_basename($name);
        $first = trim(strtok((string) $exception, "\n")) ?: 'bilinmiyor';
        $short = mb_substr($first, 0, 240);

        return [$job, $short];
    }
}
