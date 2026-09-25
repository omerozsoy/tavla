<?php

namespace App\Filament\Pages;

use App\Models\User;
use App\Support\Shield;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Güvenlik Kalkanı — canlı izleme paneli. Kim, hangi işte, ne kadardır sitede, kaç istek atıyor,
 * garip/tarama isteği var mı, çark/slot spam'i var mı, risk skoru ne. Veriler ShieldTracker
 * middleware'i tarafından her /api isteğinde toplanır. Sayfa 15 sn'de bir kendini yeniler.
 */
class GuvenlikKalkani extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-shield-exclamation';

    protected static ?string $navigationLabel = 'Güvenlik Kalkanı';

    protected static ?string $title = 'Güvenlik Kalkanı';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 1;

    protected static string $view = 'filament.pages.guvenlik-kalkani';

    /** Yalnızca riskli (risk ≥ 30) özneleri göster. */
    public bool $onlyRisky = false;

    /** Olaylar tablosu: yalnızca gerçekten önemli (tehlike) olayları göster; kazıma gürültüsünü ele. */
    public bool $onlyImportant = true;

    public function toggleRisky(): void
    {
        $this->onlyRisky = ! $this->onlyRisky;
    }

    public function toggleImportant(): void
    {
        $this->onlyImportant = ! $this->onlyImportant;
    }

    public static function getNavigationBadge(): ?string
    {
        if (! Schema::hasTable('shield_presence')) {
            return null;
        }
        $n = DB::table('shield_presence')
            ->where('last_seen_at', '>', now()->subMinutes(60))
            ->where('risk', '>=', 60)
            ->count();
        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public function ready(): bool
    {
        return Schema::hasTable('shield_presence') && Schema::hasTable('shield_events');
    }

    /** Üst kartlar. */
    public function stats(): array
    {
        if (! $this->ready()) {
            return ['online' => 0, 'active' => 0, 'flagged' => 0, 'events24' => 0, 'danger24' => 0, 'banned' => 0];
        }
        $p = DB::table('shield_presence');

        return [
            'online' => (clone $p)->where('last_seen_at', '>', now()->subSeconds(90))->count(),
            'active' => (clone $p)->where('last_seen_at', '>', now()->subMinutes(15))->count(),
            'flagged' => (clone $p)->where('last_seen_at', '>', now()->subMinutes(60))->where('risk', '>=', 30)->count(),
            'events24' => DB::table('shield_events')->where('created_at', '>', now()->subDay())->count(),
            'danger24' => DB::table('shield_events')->where('created_at', '>', now()->subDay())->where('severity', '>=', 3)->count(),
            'banned' => DB::table('users')->whereNotNull('banned_at')->count(),
        ];
    }

    /** Canlı tablo: son 15 dk aktif özneler, riske göre sıralı. */
    public function liveRows(): array
    {
        if (! $this->ready()) {
            return [];
        }

        // last_page kolonu deploy migrate'inden sonra gelir; yoksa seçme (500 önle).
        $cols = [
            'p.subject', 'p.user_id', 'p.ip', 'p.last_path', 'p.last_method', 'p.last_status',
            'p.last_seen_at', 'p.session_started_at', 'p.req_count', 'p.err_count',
            'p.spin_count', 'p.susp_count', 'p.rate_max', 'p.risk', 'p.user_agent',
            'u.nickname', 'u.first_name', 'u.last_name', 'u.email', 'u.avatar',
            'u.banned_at', 'u.is_admin',
        ];
        if (Schema::hasColumn('shield_presence', 'last_page')) {
            $cols[] = 'p.last_page';
        }

        return DB::table('shield_presence as p')
            ->leftJoin('users as u', 'u.id', '=', 'p.user_id')
            ->where('p.last_seen_at', '>', now()->subMinutes(15))
            ->when($this->onlyRisky, fn ($q) => $q->where('p.risk', '>=', 30))
            ->orderByDesc('p.risk')
            ->orderByDesc('p.last_seen_at')
            ->limit(200)
            ->get($cols)
            ->all();
    }

    /** Son güvenlik olayları (garip istekler / patlamalar). */
    public function events(): array
    {
        if (! $this->ready()) {
            return [];
        }

        return DB::table('shield_events as e')
            ->leftJoin('users as u', 'u.id', '=', 'e.user_id')
            ->when($this->onlyImportant, function ($q) {
                // Yalnızca gerçekten önemli olaylar: tehlike (severity ≥ 3) VE zararsız
                // salt-okunur GET aşırı-istek gürültüsünü (kazıma) dışla.
                $q->where('e.severity', '>=', 3)
                    ->where(function ($w) {
                        $w->where('e.type', '!=', 'rate_burst')
                            ->orWhere('e.method', '!=', 'GET')
                            ->orWhere('e.status', '>=', 400);
                    });
            })
            ->orderByDesc('e.created_at')
            ->limit(150)
            ->get([
                'e.id', 'e.user_id', 'e.ip', 'e.type', 'e.severity', 'e.path',
                'e.method', 'e.status', 'e.detail', 'e.created_at',
                'u.nickname', 'u.first_name', 'u.email',
            ])
            ->all();
    }

    // ---- Aksiyonlar ----

    public function block(int $id): void
    {
        $u = User::find($id);
        if (! $u) {
            return;
        }
        if ($u->isConfigAdmin()) {
            Notification::make()->title('Bu hesap (config admin) engellenemez.')->danger()->send();
            return;
        }
        if ($u->id === auth()->id()) {
            Notification::make()->title('Kendini engelleyemezsin.')->danger()->send();
            return;
        }
        $u->banned_at = now();
        $u->save();
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
        Notification::make()->title(($u->nickname ?: $u->email).' engeli kaldırıldı.')->success()->send();
    }

    // ---- Görünüm yardımcıları ----

    /** last_path → "ne yapıyor" insan etiketi. */
    public function activityLabel(?string $path): string
    {
        $p = (string) $path;
        return match (true) {
            str_contains($p, 'lucky-wheel/spin') => 'Şans Çarkı çeviriyor',
            str_contains($p, 'lucky-wheel') => 'Şans Çarkı’na bakıyor',
            str_contains($p, 'dice-slot/spin') => 'Zar Slotu çeviriyor',
            str_contains($p, 'dice-slot') => 'Zar Slotu’na bakıyor',
            str_contains($p, 'matchmaking') => 'Rakip arıyor',
            str_contains($p, 'live-matches') || str_contains($p, 'watch') || str_contains($p, '/live') => 'Maç izliyor',
            str_contains($p, 'online-players') => 'Oyuncu listesi',
            str_contains($p, 'rooms') => 'Oyun / oda',
            str_contains($p, 'chat') => 'Sohbet',
            str_contains($p, 'messages') => 'Mesajlaşıyor',
            str_contains($p, 'gnubg-review') || str_contains($p, 'analy') => 'Maç analizi',
            str_contains($p, 'me/matches') => 'Maç kayıtları',
            str_contains($p, 'shop') || str_contains($p, 'products') || str_contains($p, 'cart') => 'Mağaza',
            str_contains($p, 'pay') || str_contains($p, 'payment') => 'Ödeme',
            str_contains($p, 'friends') => 'Arkadaşlar',
            str_contains($p, 'tournament') => 'Turnuvalar',
            str_contains($p, 'clubs') => 'Kulüpler',
            str_contains($p, 'login') || str_contains($p, 'register') => 'Giriş / kayıt',
            str_contains($p, 'admin') => 'Panel isteği',
            str_contains($p, 'ping') => 'Beklemede',
            $p === 'api' || $p === '' => 'Ana sayfa',
            default => '/'.$p,
        };
    }

    /** SPA rotası (X-Page) → insan-okunur sayfa adı. Boşsa null döner (API'den tahmine düşülür). */
    public function pageLabel(?string $page): ?string
    {
        $p = trim((string) $page, '/');
        if ($p === '') {
            return null;
        }
        // Tam eşleşmeler (pages.ts slug'larıyla hizalı).
        $map = [
            '' => 'Ana sayfa',
            'tek-oyun' => 'Tek Oyun', 'yeni-oyun' => 'Yeni Oyun (eşleşme)',
            'yz-ile-oyna' => 'YZ ile Oyna', 'arkadasinla-oyna' => 'Arkadaşınla Oyna',
            'online-turnuvalar' => 'Turnuvalar', 'lider-tablosu' => 'Lider Tablosu',
            'arkadaslar' => 'Arkadaşlar', 'mesajlar' => 'Mesajlar',
            'sans-carki' => 'Şans Çarkı', 'zar-slotu' => 'Zar Slotu', 'bahane-makinesi' => 'Bahane Makinesi',
            'kiz-tavlasi' => 'Kız Tavlası', 'makaleler' => 'Makaleler', 'turnuva-takvimi' => 'Turnuva Takvimi',
            'kulupler' => 'Kulüpler', 'haberler' => 'Haberler', 'tavla-magazin' => 'Tavla Magazin',
            'urunler' => 'Ürünler', 'pozisyon-analizi' => 'Pozisyon Analizi', 'mat-analiz' => 'MAT Analizi',
            'basarimlar' => 'Başarımlar', 'hata-gunlugu' => 'Hata Günlüğü', 'mac-analizleri' => 'Maç Analizleri',
            'uyelik' => 'Üyelik', 'magaza' => 'Mağaza', 'pul-tasarimlari' => 'Pul Tasarımları',
            'siparislerim' => 'Siparişlerim', 'online-tavla' => 'Online Tavla', 'tavla-oyna' => 'Tavla Oyna',
        ];
        if (isset($map[$p])) {
            return $map[$p];
        }
        // Ön ek eşleşmeleri (derin/dinamik yollar: /makaleler/<slug>, /bilgi/<sekme>, /oda/<kod> vb.).
        return match (true) {
            str_starts_with($p, 'makaleler/') => 'Makale okuyor',
            str_starts_with($p, 'haberler/') => 'Haber okuyor',
            str_starts_with($p, 'tavla-magazin/') => 'Magazin izliyor',
            str_starts_with($p, 'bilgi') => 'Bilgi sayfaları',
            str_starts_with($p, 'oda/') || str_starts_with($p, 'oyun') => 'Oyun / oda',
            str_starts_with($p, 'profil') => 'Profil',
            default => '/'.$p,
        };
    }

    /** İnsan-okunur süre (kaç saattir/dakikadır sitede). */
    public function human($from): string
    {
        if (! $from) {
            return '—';
        }
        $start = $from instanceof Carbon ? $from : Carbon::parse($from);
        $sec = max(0, now()->getTimestamp() - $start->getTimestamp());
        if ($sec < 60) {
            return $sec.' sn';
        }
        if ($sec < 3600) {
            return floor($sec / 60).' dk';
        }
        $h = floor($sec / 3600);
        $m = floor(($sec % 3600) / 60);
        return $m > 0 ? "{$h} sa {$m} dk" : "{$h} sa";
    }

    public function riskTier(int $risk): int
    {
        return Shield::riskTier($risk);
    }

    /** Olay türü → Türkçe etiket. */
    public function eventLabel(string $type): string
    {
        return match ($type) {
            'rate_burst' => 'Aşırı istek',
            'error_burst' => 'Hata patlaması',
            'spin_burst' => 'Çark/Slot spam',
            'suspicious_path' => 'Şüpheli / tarama',
            'admin_probe' => 'Yetkisiz panel',
            'banned_hit' => 'Yasaklı istek',
            default => $type,
        };
    }
}
