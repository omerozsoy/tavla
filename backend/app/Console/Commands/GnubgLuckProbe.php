<?php

namespace App\Console\Commands;

use App\Services\GnuBg\GnuBgClient;
use Illuminate\Console\Command;

/**
 * TEŞHİS: gnubg'nin NATIVE 'luck' (şans) çıktısını ölçer. İki gnubg botu kısa bir maç oynar,
 * 'analyse match' çalışır; gnubg'nin kendi luck rate / ölçek / normalizasyon / işaret çıktısını
 * (insan-okur istatistik + yapısal per-move) döker. Amaç: Tavlai sunucu-luck formülünü gnubg'nin
 * GERÇEK davranışına göre TAHMİN ETMEDEN tasarlamak. Çıktıyı paylaş -> formülü kesinleştireyim.
 */
class GnubgLuckProbe extends Command
{
    protected $signature = 'tavla:gnubg-luck-probe {--points=1 : maç uzunluğu (1=en hızlı)} {--out= : çıktıyı dosyaya da yaz}';

    protected $description = 'gnubg native luck (şans) çıktısını teşhis eder (ölçek/normalizasyon doğrulaması).';

    public function handle(GnuBgClient $gnubg): int
    {
        $this->line('gnubg URL: '.config('gnubg.url'));
        if (! $gnubg->health()) {
            $this->error('gnubg servisi ERİŞİLEMEZ. GNUBG_URL + servis çalışıyor mu?');

            return self::FAILURE;
        }
        $this->info('Sağlık: OK — maç oynatılıyor + analiz ediliyor (birkaç sn)...');

        $r = $gnubg->lucktest((int) $this->option('points'));
        if (! is_array($r)) {
            $this->error('lucktest başarısız (null).');

            return self::FAILURE;
        }
        if (isset($r['exception']) || isset($r['http_status'])) {
            $this->error('lucktest hata: '.json_encode($r));

            return self::FAILURE;
        }

        $this->line('');
        $this->line('== gnubg version =='); $this->line((string) ($r['version'] ?? '?'));
        $this->line('oynanan hamle sayısı: '.($r['plays'] ?? '?'));

        $this->line('');
        $this->line('== show analysis (luck eval AYRI mı / hangi ply) ==');
        $this->line((string) ($r['show_analysis'] ?? '(yok)'));

        $this->line('');
        $this->line('== show statistics match (LUCK RATE + ÖLÇEK/BİRİM burada) ==');
        $this->line((string) ($r['statistics_match'] ?? '(yok)'));

        $this->line('');
        $this->line('== yapısal gnubg.match() ==');
        $this->line('type: '.($r['match_struct_type'] ?? '?'));
        if (isset($r['match_struct_keys'])) {
            $this->line('keys: '.json_encode($r['match_struct_keys']));
        }
        if (isset($r['match_struct_err'])) {
            $this->warn('match() hata: '.$r['match_struct_err']);
        }
        if (! empty($r['luck_move_sample'])) {
            $this->line('per-move luck örneği (ilk 10):');
            $this->line(json_encode($r['luck_move_sample'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        if ($out = $this->option('out')) {
            file_put_contents($out, json_encode($r, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $this->info('Ham JSON yazıldı: '.$out);
        }

        $this->line('');
        $this->info('BİTTİ. Bu çıktının TAMAMINI bana yapıştır -> luck formülünü (ölçek/normalizasyon) kesinleştireyim.');

        return self::SUCCESS;
    }
}
