<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\AccountClosure;
use App\Support\NicknameFilter;
use App\Support\OfficialMessenger;
use Illuminate\Console\Command;

/**
 * Küfürlü takma ad SON-TARİH nöbetçisi. Admin "Küfürlü Takmaisim" sayfasından uyarı gönderince
 * nickname_ban_at (son tarih) + nickname_warned_nick (uyarı anındaki ad) işlenir; bu komut:
 *  - Takma ad uyarıdan bu yana DEĞİŞMİŞSE (kullanıcı düzeltmiş) -> uyarı alanlarını temizle (ban yok).
 *  - Son tarih GEÇMİŞ + takma ad DEĞİŞMEMİŞ + hesap açık -> AccountClosure ile kapat.
 *  - Son tarih henüz gelmemişse dokunma (bekle).
 * "Değişti mi?" ölçütü filtreye takılmayan ELLE eklenen hesapları da kapsar (admin uygunsuz bulmuş;
 * ad değişmediyse süre dolunca kapatılır). nickname_warned_nick boş olan eski kayıtlarda filtre
 * uygunluğuna düşülür (geriye dönük güvenli). Idempotent; saatte bir koşar (routes/console.php).
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
                    $warnedNick = $u->nickname_warned_nick;
                    // Düzeltildi mi? Uyarı anındaki addan farklıysa DEĞİŞMİŞ; warned_nick yoksa
                    // (eski kayıt) filtre uygunluğuna düş.
                    $corrected = $warnedNick !== null
                        ? ((string) $u->nickname !== (string) $warnedNick)
                        : NicknameFilter::isAllowed((string) $u->nickname);
                    if ($corrected) {
                        if (! $dry) {
                            $u->forceFill(['nickname_warned_at' => null, 'nickname_ban_at' => null, 'nickname_warned_nick' => null])->save();
                        }
                        $cleared++;

                        continue;
                    }
                    // Düzeltilmemiş ama süre dolmamış -> bekle.
                    if ($u->nickname_ban_at->isFuture()) {
                        continue;
                    }
                    // Süre doldu + düzeltilmemiş -> kapat.
                    if (! $dry) {
                        try {
                            AccountClosure::close($u, $actorId, 'Uygunsuz takma ad (verilen süre doldu)', 'tavla:nickname-enforce');
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
