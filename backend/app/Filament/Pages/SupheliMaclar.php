<?php

namespace App\Filament\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\AccountClosure;
use App\Support\CheatScan;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Şüpheli Maçlar — motor-yardımı (engine-assist) HİLE sinyali. Kaynak: match_results PR geçmişi
 * (bkz App\Support\CheatScan). SİNYAL'dir, KANIT değil: eşik üstü maçları yönetici inceler
 * (hamle-hamle motor eşleşmesi en sağlam kanıt), sonra hesabı engeller. CifteGirisler'in kardeşi.
 */
class SupheliMaclar extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-cpu-chip';

    protected static ?string $navigationLabel = 'Şüpheli Kullanıcılar';

    protected static ?string $title = 'Şüpheli Kullanıcılar — Motor-Yardımı (Hile) Sinyali';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.pages.supheli-maclar';

    /** Hamle-hamle eşleşmesi açık olan maçın odası ve hesaplanmış sonucu (on-demand; 244KB review parse). */
    public ?string $openRoom = null;

    public array $moveMatch = [];

    /** true: yalnız hamle-hamle motor eşleşmesi doğrulanmış (kesin) hesapları göster. Varsayılan AÇIK. */
    public bool $onlyCertain = true;

    public static function getNavigationBadge(): ?string
    {
        $n = count(CheatScan::suspects());

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    /** Şüpheli hesaplar + her biri için flag'lenmiş maçları (ağır sorgu — yalnız sayfa görünümünde). */
    public function suspects(): array
    {
        $suspects = CheatScan::suspects();

        // Hamle-hamle kanıt (ağır review parse, cache'li) herkese iliştir — rozet + filtre + sıralama için.
        foreach ($suspects as &$s) {
            $s['confirmation'] = CheatScan::confirmation($s['user_id']);
        }
        unset($s);

        if ($this->onlyCertain) {
            $suspects = array_values(array_filter($suspects, fn ($s) => $s['confirmation']['certain'] ?? false));
        }

        // Kesin (motor eşleşmesi doğrulanmış) hesaplar üstte (PHP 8 usort kararlı → gerisi aynı kalır).
        usort($suspects, fn ($a, $b) => ($b['confirmation']['certain'] ?? false) <=> ($a['confirmation']['certain'] ?? false));

        foreach ($suspects as &$s) {
            $s['matches'] = CheatScan::flaggedMatches($s['user_id']);
            $s['profile'] = CheatScan::profile($s['user_id']); // grafik + neden (kullanıcı-bazlı dağılım)
            $s['url'] = self::editUrl($s['user_id']);
        }
        unset($s);

        return $suspects;
    }

    /** "Kesin suçlu" (motor eşleşmesi ≥ eşik) hesap sayısı — üst kart + filtre etiketi için. */
    public function certainCount(): int
    {
        $n = 0;
        foreach (CheatScan::suspects() as $s) {
            if (CheatScan::confirmation($s['user_id'])['certain'] ?? false) {
                $n++;
            }
        }

        return $n;
    }

    public function stats(): array
    {
        $suspects = CheatScan::suspects();
        $flags = array_sum(array_column($suspects, 'flags'));

        return [
            'suspects' => count($suspects),
            'flags' => $flags,
            'worst' => $suspects ? min(array_column($suspects, 'worst_pr')) : 0,
        ];
    }

    /** Hesabı engelle (CifteGirisler::block ile AYNI mantık — config admin / kendini koru). */
    public function block(int $id): void
    {
        $u = User::find($id);
        if (! $u) {
            return;
        }
        if (method_exists($u, 'isConfigAdmin') && $u->isConfigAdmin()) {
            Notification::make()->title('Bu hesap (config admin) engellenemez.')->danger()->send();

            return;
        }
        if ($u->id === auth()->id()) {
            Notification::make()->title('Kendini engelleyemezsin.')->danger()->send();

            return;
        }
        $u->banned_at = now();
        $u->ban_reason = 'Motor-yardımı hile şüphesi (Şüpheli Maçlar)';
        $u->banned_by = auth()->id();
        $u->save();
        CheatScan::forget();
        Notification::make()->title(($u->nickname ?: $u->email).' engellendi.')->success()->send();
    }

    public function unblock(int $id): void
    {
        $u = User::find($id);
        if (! $u) {
            return;
        }
        $u->banned_at = null;
        $u->save();
        CheatScan::forget();
        Notification::make()->title(($u->nickname ?: $u->email).' engeli kaldırıldı.')->success()->send();
    }

    /**
     * HESABI KAPAT (ban'dan ağır): UserResource ile AYNI akış — AccountClosure::close hesabı kapatır,
     * oturumları/token'ları keser, ekonomik kilit/iade işler. Engelle = erişimi kes; Kapat = hesabı sonlandır.
     */
    public function closeAccount(int $id): void
    {
        $u = User::find($id);
        if (! $u) {
            return;
        }
        if (method_exists($u, 'isConfigAdmin') && $u->isConfigAdmin()) {
            Notification::make()->title('Bu hesap (config admin) kapatılamaz.')->danger()->send();

            return;
        }
        if ($u->id === auth()->id()) {
            Notification::make()->title('Kendi hesabını kapatamazsın.')->danger()->send();

            return;
        }
        AccountClosure::close($u, (int) auth()->id(), 'Motor-yardımı hile (Şüpheli Kullanıcılar)');
        CheatScan::forget();
        Notification::make()->title(($u->nickname ?: $u->email).' hesabı kapatıldı.')->success()->send();
    }

    /** Beyaz listeye al: yanlış-pozitif iyi oyuncu (şampiyon vb.) — listeden kalıcı çıkar. */
    public function whitelist(int $id): void
    {
        $u = User::find($id);
        CheatScan::setWhitelisted($id, true);
        Notification::make()->title(($u?->nickname ?: '#'.$id).' beyaz listeye alındı (temiz oyuncu).')->success()->send();
    }

    /** Beyaz listeden çıkar: tekrar taramaya girsin. */
    public function unwhitelist(int $id): void
    {
        $u = User::find($id);
        CheatScan::setWhitelisted($id, false);
        Notification::make()->title(($u?->nickname ?: '#'.$id).' beyaz listeden çıkarıldı.')->success()->send();
    }

    /** Beyaz listedeki hesaplar (altta "geri al" şeridi için). @return array<int,array{id:int,nickname:string}> */
    public function whitelisted(): array
    {
        $ids = CheatScan::whitelistIds();
        if ($ids === []) {
            return [];
        }
        $names = User::whereIn('id', $ids)->pluck('nickname', 'id');

        return array_map(fn ($id) => ['id' => $id, 'nickname' => $names[$id] ?? ('#'.$id)], $ids);
    }

    /** Hamle-hamle motor eşleşmesini aç/kapa (on-demand — yalnız tıklanan maçın review'ını parse eder). */
    public function showMoves(int $userId, string $room): void
    {
        if ($this->openRoom === $room) {
            $this->openRoom = null;
            $this->moveMatch = [];

            return;
        }
        $this->openRoom = $room;
        $this->moveMatch = CheatScan::moveMatch($userId, $room);
    }

    private static function editUrl(int $uid): ?string
    {
        try {
            return UserResource::getUrl('edit', ['record' => $uid]);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
