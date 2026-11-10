<?php

namespace App\Filament\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\AccountClosure;
use App\Support\NicknameFilter;
use App\Support\OfficialMessenger;
use Filament\Forms\Components\Select;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/**
 * Küfürlü Takmaisim — NicknameFilter'a takılan (küfür/uygunsuz) takma adlı AKTİF hesapları listeler.
 * Admin satırdan "Uyarı Gönder" ile oyuncuya resmi DM yollar + son tarih verir (varsayılan 24 saat).
 * Süre dolup takma ad DEĞİŞMEMİŞSE tavla:nickname-enforce nöbetçisi hesabı kapatır; oyuncu takma
 * adını değiştirirse uyarı otomatik temizlenir (ban yok). "Şimdi Banla" bekletmeden kapatır.
 *
 * Filtrenin YAKALAMADIĞI birini admin ELLE ekleyebilir (alttaki arama) -> aynı uyarı+süre+takip akışı
 * işler; ad değişmediği için süre dolunca kapatılır. Yasaklı liste panelden yönetilir
 * (Site Ayarları > Yasaklı Takma Adlar); otomatik tespit onun CANLI sonucudur.
 */
class KufurluTakmaAdlar extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-no-symbol';

    protected static ?string $navigationLabel = 'Küfürlü Takmaisim';

    protected static ?string $title = 'Küfürlü Takmaisim — Uygunsuz Takma Adlı Hesaplar';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 5;

    protected static string $view = 'filament.pages.kufurlu-takma-adlar';

    /** Uyarıda verilecek süre (saat). Admin blade'den değiştirir; en az 1. */
    public int $hours = 24;

    /** Elle ekleme formu state'i (searchable oyuncu seçimi). */
    public ?array $data = [];

    /** Tek render'da offenders()+stats() ikisi de çağırır -> instance'ta bir kez hesapla. */
    private ?array $memo = null;

    public function mount(): void
    {
        $this->form->fill();
    }

    /** Elle ekleme: filtrenin yakalamadığı bir oyuncuyu seç (nickname/ad/e-posta ile ara). */
    public function form(Form $form): Form
    {
        return $form->schema([
            Select::make('user_id')
                ->label('Oyuncu ara ve ekle')
                ->placeholder('Takma ad, ad veya e-posta...')
                ->searchable()
                ->getSearchResultsUsing(fn (string $search) => self::searchUsers($search))
                ->getOptionLabelUsing(fn ($value) => optional(User::find($value))->nickname)
                ->helperText('Filtrenin yakalamadığı ama uygunsuz bulduğun bir oyuncuyu ekle; aynı uyarı+süre akışı işler.'),
        ])->statePath('data');
    }

    /** Oyuncu arama (sistem/banlı hariç). */
    public static function searchUsers(string $search): array
    {
        $search = trim($search);
        if ($search === '') {
            return [];
        }

        return User::query()
            ->whereNull('banned_at')
            ->when(Schema::hasColumn('users', 'is_system'), fn ($q) => $q->where('is_system', false))
            ->where(fn ($q) => $q->where('nickname', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('first_name', 'like', "%{$search}%"))
            ->orderBy('nickname')
            ->limit(30)
            ->pluck('nickname', 'id')
            ->all();
    }

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
                    $flagged = ! NicknameFilter::isAllowed((string) $u->nickname);
                    $tracked = $u->nickname_ban_at !== null;
                    // Filtre yakalamadıysa VE takip de edilmiyorsa atla; elle eklenenler (takipte) kalır.
                    if (! $flagged && ! $tracked) {
                        continue;
                    }
                    $rows[] = [
                        'id' => (int) $u->id,
                        'name' => $u->nickname ?: ($u->first_name ?: ('#'.$u->id)),
                        'email' => $u->email,
                        'rating' => $u->rating,
                        'flagged' => $flagged,            // filtre yakaladı mı
                        'manual' => $tracked && ! $flagged, // elle eklenmiş (filtre yakalamadı)
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

    /** Oyuncuya uyarı DM'i gönder + son tarih + uyarı anındaki adı işle. Tek yazar (warn/warnAll/addManual). */
    private function applyWarning(User $u, Carbon $deadline, string $body): void
    {
        OfficialMessenger::sendTo($u, $body);
        $u->forceFill([
            'nickname_warned_at' => now(),
            'nickname_ban_at' => $deadline,
            'nickname_warned_nick' => $u->nickname,
        ])->save();
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
        $this->applyWarning($u, $deadline, $this->warningBody($deadline, $hours));
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
            $this->applyWarning($u, $deadline, $body);
            $sent++;
        }
        $this->bust();
        Notification::make()->title("{$sent} oyuncuya uyarı gönderildi ({$hours} saat süre).")->success()->send();
    }

    /** ELLE EKLE: filtrenin yakalamadığı seçili oyuncuya uyarı gönder + takibe al. */
    public function addManual(): void
    {
        $id = (int) ($this->data['user_id'] ?? 0);
        $u = User::find($id);
        if (! $u) {
            Notification::make()->title('Oyuncu bulunamadı.')->danger()->send();

            return;
        }
        if ($u->isBanned()) {
            Notification::make()->title('Bu hesap zaten kapalı.')->danger()->send();

            return;
        }
        if (Schema::hasColumn('users', 'is_system') && $u->is_system) {
            Notification::make()->title('Sistem hesabı eklenemez.')->danger()->send();

            return;
        }
        $hours = max(1, (int) $this->hours);
        $deadline = now()->addHours($hours);
        $this->applyWarning($u, $deadline, $this->warningBody($deadline, $hours));
        $this->form->fill(); // seçimi temizle
        $this->bust();
        Notification::make()->title(($u->nickname ?: $u->email)." eklendi ve uyarıldı — {$hours} saat süre verildi.")->success()->send();
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
        $u->forceFill(['nickname_warned_at' => null, 'nickname_ban_at' => null, 'nickname_warned_nick' => null])->save();
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
