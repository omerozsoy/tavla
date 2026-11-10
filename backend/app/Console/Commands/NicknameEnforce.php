<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\AccountClosure;
use App\Support\NicknameFilter;
use App\Support\OfficialMessenger;
use Illuminate\Console\Command;

/**
 * Küfürlü takma ad SON-TARİH nöbetçisi. Admin "Küfürlü Takmaisim" sayfasından uyarı gönderince
 * nickname_ban_at (son tarih) işlenir; bu komut:
 *  - Takma ad artık UYGUNSA (kullanıcı düzeltmiş) -> uyarı alanlarını temizle (ban yok).
 *  - Son tarih GEÇMİŞ + takma ad hâlâ uygunsuz + hesap açık -> AccountClosure ile kapat.
 *  - Son tarih henüz gelmemişse dokunma (bekle).
 * Idempotent; saatte bir koşar (routes/console.php). Son tarihi olmayan hesaba dokunmaz.
 */
class NicknameEnforce extends Command
{
    protected $signature = 'tavla:nickname-enforce {--dry : Yalnız raporla, kapatma/temizleme yapma}';

    protected $description = 'Süresi dolan küfürlü takma adlı hesapları kapatır; düzeltilenlerin uyarısını temizler.';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $actorId = OfficialMessenger::existingId() ?? OfficialMessenger::ACCOUNT_ID;
        $cleared = 0;
        $banned = 0;

        User::whereNotNull('nickname_ban_at')
            ->whereNull('banned_at')
            ->orderBy('id')
            ->chunkById(200, function ($users) use ($dry, $actorId, &$cleared, &$banned) {
                foreach ($users as $u) {
                    // Düzeltilmiş -> uyarıyı kaldır.
                    if (NicknameFilter::isAllowed((string) $u->nickname)) {
                        if (! $dry) {
                            $u->forceFill(['nickname_warned_at' => null, 'nickname_ban_at' => null])->save();
                        }
                        $cleared++;

                        continue;
                    }
                    // Hâlâ uygunsuz ama süre dolmamış -> bekle.
                    if ($u->nickname_ban_at->isFuture()) {
                        continue;
                    }
                    // Süre doldu + hâlâ uygunsuz -> kapat.
                    if (! $dry) {
                        try {
                            AccountClosure::close($u, $actorId, 'Küfürlü/uygunsuz takma ad (verilen süre doldu)', 'tavla:nickname-enforce');
                        } catch (\Throwable $e) {
                            // Kök yönetici vb. kapatılamaz -> atla; nöbetçi diğerlerini kapatmaya devam etsin.
                            $this->warn("#{$u->id} kapatılamadı: {$e->getMessage()}");

                            continue;
                        }
                    }
                    $banned++;
                }
            });

        $this->info(($dry ? '[dry] ' : '')."Temizlenen (düzeltilmiş): {$cleared}, kapatılan (süre doldu): {$banned}");

        return self::SUCCESS;
    }
}
