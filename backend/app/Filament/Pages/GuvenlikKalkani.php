<?php

namespace App\Filament\Pages;

use App\Models\User;
use App\Support\Shield;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Güvenlik Kalkanı — SALDIRI paneli. Yalnızca siteye kasıtlı zarar verme girişimleri gösterilir:
 * yalnız brute-force giriş, şüpheli/tarama (exploit) istekleri ve yetkisiz panel denemeleri. İstek/hata
 * selleri (rate_burst/error_burst) ve yasaklı hesap ısrarı (oyun gürültüsü) saldırı sayılmaz; yalnız
 * "tümü" görünümünde kalır, saldırı listesinden elenir. Her satırdaki saldırgan IP'den tek tıkla yasaklanabilir;
 * yasaklı IP'ler shield_ip_bans'te tutulur ve SiteGate middleware'i tüm /api isteklerini keser.
 * Olaylar ShieldTracker middleware'i + Shield çekirdeği tarafından toplanır; sayfa 15 sn'de yenilenir.
 */
class GuvenlikKalkani extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-shield-exclamation';

    protected static ?string $navigationLabel = 'Güvenlik Kalkanı';

    protected static ?string $title = 'Güvenlik Kalkanı';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 1;

    protected static string $view = 'filament.pages.guvenlik-kalkani';

    /** Olaylar: yalnızca gerçek saldırılar (true) mı, tüm güvenlik olayları (false) mı? */
    public bool $onlyAttacks = true;

    /** Elle IP yasaklama alanı. */
    public string $newIp = '';

    public string $newIpReason = '';

    /** Saldırı sayılan olay türleri (brute-force + exploit/tarama + yetkisiz panel). */
    private const ATTACK_TYPES = ['brute_force', 'suspicious_path', 'admin_probe'];

    public function toggleAttacks(): void
    {
        $this->onlyAttacks = ! $this->onlyAttacks;
    }

    public static function getNavigationBadge(): ?string
    {
        if (! Schema::hasTable('shield_events')) {
            return null;
        }
        $n = DB::table('shield_events')
            ->where('created_at', '>', now()->subHour())
            ->where('severity', '>=', 3)
            ->whereIn('type', self::ATTACK_TYPES)
            ->count();

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public function ready(): bool
    {
        return Schema::hasTable('shield_events') && Schema::hasTable('shield_ip_bans');
    }

    /** Üst kartlar — tehdit odaklı. */
    public function stats(): array
    {
        if (! Schema::hasTable('shield_events')) {
            return ['attacks1h' => 0, 'danger24' => 0, 'ipbans' => 0, 'bannedUsers' => 0];
        }
        $e = DB::table('shield_events');

        return [
            // Son 1 saatteki saldırı olayları (aktif tehdit nabzı).
            'attacks1h' => (clone $e)->where('created_at', '>', now()->subHour())
                ->whereIn('type', self::ATTACK_TYPES)->count(),
            // Son 24 saatteki tehlike (severity ≥ 3) olayları.
            'danger24' => (clone $e)->where('created_at', '>', now()->subDay())->where('severity', '>=', 3)->count(),
            'ipbans' => Schema::hasTable('shield_ip_bans') ? DB::table('shield_ip_bans')->count() : 0,
            'bannedUsers' => DB::table('users')->whereNotNull('banned_at')->count(),
        ];
    }

    /** Saldırı olayları (varsayılan) ya da tüm güvenlik olayları. */
    public function events(): array
    {
        if (! Schema::hasTable('shield_events')) {
            return [];
        }

        return DB::table('shield_events as e')
            ->leftJoin('users as u', 'u.id', '=', 'e.user_id')
            ->when($this->onlyAttacks, fn ($q) => $q->whereIn('e.type', self::ATTACK_TYPES))
            ->orderByDesc('e.created_at')
            ->limit(200)
            ->get([
                'e.id', 'e.user_id', 'e.ip', 'e.type', 'e.severity', 'e.path',
                'e.method', 'e.status', 'e.detail', 'e.created_at',
                'u.nickname', 'u.first_name', 'u.email', 'u.banned_at', 'u.is_admin',
            ])
            ->all();
    }

    /** Yasaklı IP listesi (admin dönem dönem temizler). */
    public function ipBans(): array
    {
        if (! Schema::hasTable('shield_ip_bans')) {
            return [];
        }

        return DB::table('shield_ip_bans as b')
            ->leftJoin('users as u', 'u.id', '=', 'b.created_by')
            ->orderByDesc('b.created_at')
            ->get(['b.id', 'b.ip', 'b.reason', 'b.created_at', 'u.nickname as by_nick', 'u.email as by_email'])
            ->all();
    }

    // ---- IP yasaklama ----

    public function banIp(string $ip, ?string $reason = null): void
    {
        $ip = trim($ip);
        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            Notification::make()->title('Geçersiz IP adresi.')->danger()->send();

            return;
        }
        if ($ip === request()->ip()) {
            Notification::make()->title('Kendi IP’ni yasaklayamazsın (kendini kilitlersin).')->danger()->send();

            return;
        }
        if (! Schema::hasTable('shield_ip_bans')) {
            return;
        }
        DB::table('shield_ip_bans')->updateOrInsert(
            ['ip' => $ip],
            ['reason' => $reason ? mb_substr($reason, 0, 255) : null, 'created_by' => auth()->id(), 'created_at' => now()],
        );
        Shield::flushIpBans();
        Shield::audit(auth()->id(), 'ip_ban', "IP yasaklandı: {$ip}".($reason ? " ({$reason})" : ''), 2);
        Notification::make()->title("{$ip} yasaklandı.")->success()->send();
    }

    public function banNewIp(): void
    {
        $this->banIp($this->newIp, $this->newIpReason ?: 'Elle eklendi');
        $this->newIp = '';
        $this->newIpReason = '';
    }

    public function unbanIp(int $id): void
    {
        if (! Schema::hasTable('shield_ip_bans')) {
            return;
        }
        $row = DB::table('shield_ip_bans')->where('id', $id)->first();
        DB::table('shield_ip_bans')->where('id', $id)->delete();
        Shield::flushIpBans();
        if ($row) {
            Shield::audit(auth()->id(), 'ip_unban', "IP yasağı kaldırıldı: {$row->ip}", 1);
            Notification::make()->title("{$row->ip} yasağı kaldırıldı.")->success()->send();
        }
    }

    // ---- Üye engelleme ----

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

    /** Olay türü → Türkçe etiket. */
    public function eventLabel(string $type): string
    {
        return match ($type) {
            'brute_force' => 'Brute-force giriş',
            'suspicious_path' => 'Tarama / exploit',
            'admin_probe' => 'Yetkisiz panel',
            'banned_hit' => 'Yasaklı ısrar',
            'rate_burst' => 'İstek seli',
            'error_burst' => 'Hata seli',
            'spin_burst' => 'Çark/Slot spam',
            default => $type,
        };
    }
}
