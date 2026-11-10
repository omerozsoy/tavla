<?php

namespace App\Filament\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\AccountClosure;
use App\Support\NicknameFilter;
use App\Support\OfficialMessenger;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Küfürlü Takmaisim — NicknameFilter'a takılan (küfür/uygunsuz) takma adlı AKTİF hesapları listeler.
 * Admin satırdan "Uyarı Gönder" ile oyuncuya resmi DM yollar + son tarih verir (varsayılan 24 saat).
 * Süre dolup takma ad hâlâ uygunsuzsa tavla:nickname-enforce nöbetçisi hesabı kapatır; oyuncu takma
 * adını düzeltirse uyarı otomatik temizlenir (ban yok). "Şimdi Banla" bekletmeden kapatır.
 *
 * Yasaklı liste panelden yönetilir (Site Ayarları > Yasaklı Takma Adlar); burası onun CANLI sonucudur.
 */
class KufurluTakmaAdlar extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-no-symbol';

    protected static ?string $navigationLabel = 'Küfürlü Takmaisim';

    protected static ?string $title = 'Küfürlü Takmaisim — Uygunsuz Takma Adlı Hesaplar';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 5;

    protected static string $view = 'filament.pages.kufurlu-takma-adlar';

    /** Uyarıda verilecek süre (saat). Admin blade'den değiştirir; en az 1. */
    public int $hours = 24;

    /** Tek render'da offenders()+stats() ikisi de çağırır -> instance'ta bir kez hesapla. */
    private ?array $memo = null;

    public static function getNavigationBadge(): ?string
    {
        // Tüm kullanıcıyı tarar (substring normalize) -> 30 dk cache (nav her sayfada render edilir).
        $n = Cache::remember('kufurlu_nick_count', 1800, fn () => count(self::compute()));

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public function offenders(): array
    {
        return $this->memo ??= self::compute();
    }

    public function stats(): array
    {
        $rows = $this->offenders();

        return [
            'total' => count($rows),
            'warned' => collect($rows)->filter(fn ($r) => $r['warnedAt'] !== null)->count(),
            'overdue' => collect($rows)->filter(fn ($r) => $r['overdue'])->count(),
        ];
    }

    /**
     * Uygunsuz takma adlı aktif (banlı/sistem olmayan) hesaplar. SQL ön-eleme yapılamaz
     * (NicknameFilter normalize + leetspeak uygular) -> PHP tarama.
     * ponytail: O(n) tüm-kullanıcı taraması; taban yüz binlere çıkarsa nickname yazımında bir
     * flag kolonu tut. Şimdilik badge 30 dk cache'li (BanKacaklari deseni).
     *
     * @return array<int,array{id:int,name:string,email:?string,rating:?int,warnedAt:?string,banAt:?string,overdue:bool,url:?string}>
     */
    private static function compute(): array
    {
        $rows = [];
        User::query()
            ->whereNull('banned_at')
            ->where('is_system', false)
            ->whereNotNull('nickname')->where('nickname', '!=', '')
            ->select(['id', 'nickname', 'first_name', 'email', 'rating', 'nickname_warned_at', 'nickname_ban_at'])
            ->orderBy('id')
            ->chunkById(1000, function ($users) use (&$rows) {
                foreach ($users as $u) {
                    if (NicknameFilter::isAllowed((string) $u->nickname)) {
                        continue;
                    }
                    $rows[] = [
                        'id' => (int) $u->id,
                        'name' => $u->nickname ?: ($u->first_name ?: ('#'.$u->id)),
                        'email' => $u->email,
                        'rating' => $u->rating,
                        'warnedAt' => $u->nickname_warned_at ? (string) $u->nickname_warned_at : null,
                        'banAt' => $u->nickname_ban_at ? (string) $u->nickname_ban_at : null,
                        'overdue' => $u->nickname_ban_at && $u->nickname_ban_at < now(),
                        'url' => self::editUrl((int) $u->id),
                    ];
                }
            });

        // Süresi dolmuşlar en üstte, sonra uyarılmamışlar, sonra en düşük id.
        usort($rows, fn ($a, $b) => [$b['overdue'], $a['warnedAt'] === null ? 1 : 0, -$a['id']]
            <=> [$a['overdue'], $b['warnedAt'] === null ? 1 : 0, -$b['id']]);

        return $rows;
    }

    /** Oyuncuya uyarı DM'i gönder + son tarih işle (varsayılan $this->hours saat). */
    public function warn(int $id): void
    {
        $u = User::find($id);
        if (! $u || $u->isBanned()) {
            return;
        }
        $hours = max(1, (int) $this->hours);
        $deadline = now()->addHours($hours);
        OfficialMessenger::sendTo($u, $this->warningBody($deadline, $hours));
        $u->forceFill(['nickname_warned_at' => now(), 'nickname_ban_at' => $deadline])->save();
        $this->bust();
        Notification::make()->title(($u->nickname ?: $u->email)." uyarıldı — {$hours} saat süre verildi.")->success()->send();
    }

    /** Uyarılmamış TÜM uygunsuz hesaplara tek seferde uyarı gönder. */
    public function warnAll(): void
    {
        $hours = max(1, (int) $this->hours);
        $deadline = now()->addHours($hours);
        $body = $this->warningBody($deadline, $hours);
        $sent = 0;
        foreach ($this->offenders() as $r) {
            if ($r['warnedAt'] !== null) {
                continue; // zaten uyarılmış -> süresini sıfırlama
            }
            $u = User::find($r['id']);
            if (! $u || $u->isBanned()) {
                continue;
            }
            OfficialMessenger::sendTo($u, $body);
            $u->forceFill(['nickname_warned_at' => now(), 'nickname_ban_at' => $deadline])->save();
            $sent++;
        }
        $this->bust();
        Notification::make()->title("{$sent} oyuncuya uyarı gönderildi ({$hours} saat süre).")->success()->send();
    }

    /** Beklemeden şimdi kapat (AccountClosure — token iptali + denetim kaydı). */
    public function banNow(int $id): void
    {
        $u = User::find($id);
        if (! $u) {
            return;
        }
        try {
            AccountClosure::close($u, auth()->id(), 'Küfürlü/uygunsuz takma ad', 'Küfürlü Takmaisim paneli');
        } catch (\Throwable $e) {
            Notification::make()->title($e->getMessage())->danger()->send();

            return;
        }
        $this->bust();
        Notification::make()->title(($u->nickname ?: $u->email).' kapatıldı.')->success()->send();
    }

    /** Yanlış-pozitif: uyarıyı iptal et (hesaba dokunmaz, nöbetçi artık banlamaz). */
    public function clearWarning(int $id): void
    {
        $u = User::find($id);
        if (! $u) {
            return;
        }
        $u->forceFill(['nickname_warned_at' => null, 'nickname_ban_at' => null])->save();
        $this->bust();
        Notification::make()->title('Uyarı iptal edildi.')->success()->send();
    }

    /** Uyarı mesajı — son tarih gömülü. */
    private function warningBody(Carbon $deadline, int $hours): string
    {
        return 'Takma adınız topluluk kurallarına aykırı (küfür/uygunsuz içerik) bulundu. '
            ."Lütfen {$hours} saat içinde (son tarih: ".$deadline->format('d.m.Y H:i').') '
            .'profilinizden takma adınızı değiştirin. Süre dolana kadar düzeltmezseniz hesabınız kapatılacaktır.';
    }

    private function bust(): void
    {
        $this->memo = null;
        Cache::forget('kufurlu_nick_count');
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
