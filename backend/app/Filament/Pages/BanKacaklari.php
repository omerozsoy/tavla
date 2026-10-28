<?php

namespace App\Filament\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use App\Support\Shield;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ban Kaçakları — YASAKLI bir hesapla AYNI IP'den giren YASAKSIZ (çoğunlukla yeni) hesapları gösterir.
 * Amaç: yasaklanan kullanıcı yeni hesap açıp devam ediyorsa (ban-evasion) yakalamak.
 *
 * Veri: yasaklı hesapların IP izi (shield_presence + sessions + shield_events) — Shield::maybePrune artık
 * yasaklıları BUDAMADIĞI için bu iz KALICI. Yeni hesabın IP'si bu yasaklı-IP kümesiyle kesişirse eşleşir.
 *
 * SİNYAL'dir, KANIT değil: aynı ev/ofis/okul/mobil-NAT IP'si masum paylaşılabilir. Özellikle "ban SONRASI
 * açılmış" hesaplar (rozet) güçlü sinyaldir; yönetici satırdan inceleyip engeller.
 */
class BanKacaklari extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-user-minus';

    protected static ?string $navigationLabel = 'Ban Kaçakları';

    protected static ?string $title = 'Ban Kaçakları — Yasaklıyla Aynı IP\'den Yeni Hesap';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 4;

    protected static string $view = 'filament.pages.ban-kacaklari';

    /** Tek render'da stats()+suspects() detect'i birden çok çağırır -> instance'ta bir kez hesapla. */
    private ?array $memo = null;

    public static function getNavigationBadge(): ?string
    {
        // Ağır tarama -> 30 dk cache (nav her sayfada render edilir).
        $n = Cache::remember('ban_evasion_count', 1800, fn () => count(self::compute()));

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    /** Sayfa gövdesi (cache'siz, instance-memo'lu). */
    public function suspects(): array
    {
        return $this->memo ??= self::compute();
    }

    public function stats(): array
    {
        $rows = $this->suspects();
        $bannedLinked = [];
        $ips = [];
        foreach ($rows as $r) {
            foreach ($r['links'] as $l) {
                $bannedLinked[$l['bannedId']] = true;
                foreach ($l['ips'] as $ip) {
                    $ips[$ip] = true;
                }
            }
        }

        return [
            'fresh' => count($rows),
            'banned' => count($bannedLinked),
            'ips' => count($ips),
            'afterBan' => collect($rows)->filter(fn ($r) => $r['anyAfterBan'])->count(),
        ];
    }

    /**
     * Yasaklı hesapların IP'leriyle kesişen yasaksız hesapları bul. HEDEFLİ (ucuz): önce yasaklı
     * IP kümesini çıkar, sonra YALNIZ o IP'lerdeki yasaksız hesapları ara (global tarama yok).
     *
     * @return array<int,array{user:array,links:array<int,array>,anyAfterBan:bool}>
     */
    private static function compute(): array
    {
        // 1) Yasaklı hesaplar (silinmiş/anonimleştirilmiş hariç — tarihsel satırlar listeyi kirletmesin).
        $banned = DB::table('users')->whereNotNull('banned_at')
            ->where(fn ($q) => $q->whereNull('ban_reason')->orWhere('ban_reason', '<>', 'account_deleted'))
            ->get(['id', 'nickname', 'first_name', 'email', 'banned_at', 'ban_reason'])->keyBy('id');
        if ($banned->isEmpty()) {
            return [];
        }
        $bannedIds = $banned->keys()->all();

        // 2) Yasaklıların IP izi: ip => [bannedUid => sonGörülme]
        $bannedIpSeen = self::ipSeen($bannedIds, false);
        $bannedIps = array_keys($bannedIpSeen);
        if ($bannedIps === []) {
            return [];
        }

        // 3) O IP'lerdeki YASAKSIZ hesaplar: ip => [freshUid => sonGörülme]
        $freshIpSeen = self::ipSeen($bannedIds, true, $bannedIps);
        if ($freshIpSeen === []) {
            return [];
        }

        // 4) Yasaksız hesap detayları
        $freshIds = [];
        foreach ($freshIpSeen as $seen) {
            foreach (array_keys($seen) as $uid) {
                $freshIds[$uid] = true;
            }
        }
        $fresh = DB::table('users')->whereIn('id', array_keys($freshIds))
            ->where(fn ($q) => $q->whereNull('ban_reason')->orWhere('ban_reason', '<>', 'account_deleted'))
            ->get(['id', 'nickname', 'first_name', 'email', 'created_at', 'rating'])->keyBy('id');

        // 5) Eşleştir: freshUid => bannedUid => paylaşılan IP'ler
        $out = []; // freshUid => ['user'=>..., 'banned'=> [bannedUid => ['ips'=>[], 'afterBan'=>bool]]]
        foreach ($freshIpSeen as $ip => $freshSeen) {
            $bannedHere = array_keys($bannedIpSeen[$ip] ?? []);
            if ($bannedHere === []) {
                continue;
            }
            foreach ($freshSeen as $fid => $fts) {
                $fu = $fresh[$fid] ?? null;
                if (! $fu) {
                    continue;
                }
                foreach ($bannedHere as $bid) {
                    $bu = $banned[$bid] ?? null;
                    if (! $bu) {
                        continue;
                    }
                    $out[$fid]['banned'][$bid]['ips'][$ip] = true;
                    // Ban SONRASI açılmış hesap = güçlü sinyal (yasaklanıp yeni hesap açmış).
                    $after = $fu->created_at && $bu->banned_at && $fu->created_at > $bu->banned_at;
                    $out[$fid]['banned'][$bid]['afterBan'] = ($out[$fid]['banned'][$bid]['afterBan'] ?? false) || $after;
                }
            }
        }

        // 6) Görünüm satırları
        $rows = [];
        foreach ($out as $fid => $data) {
            $fu = $fresh[$fid];
            $links = [];
            $anyAfter = false;
            foreach ($data['banned'] as $bid => $info) {
                $bu = $banned[$bid];
                $anyAfter = $anyAfter || $info['afterBan'];
                $links[] = [
                    'bannedId' => (int) $bid,
                    'bannedName' => $bu->nickname ?: ($bu->first_name ?: ('#'.$bid)),
                    'bannedAt' => $bu->banned_at,
                    'bannedReason' => $bu->ban_reason,
                    'bannedUrl' => self::editUrl((int) $bid),
                    'ips' => array_keys($info['ips']),
                    'afterBan' => (bool) $info['afterBan'],
                ];
            }
            // Ban sonrası eşleşenler önce
            usort($links, fn ($a, $b) => ($b['afterBan'] <=> $a['afterBan']));
            $rows[] = [
                'user' => [
                    'id' => (int) $fid,
                    'name' => $fu->nickname ?: ($fu->first_name ?: ('#'.$fid)),
                    'email' => $fu->email,
                    'rating' => $fu->rating,
                    'created_at' => $fu->created_at,
                    'url' => self::editUrl((int) $fid),
                ],
                'links' => $links,
                'anyAfterBan' => $anyAfter,
            ];
        }

        // Ban-sonrası (güçlü) satırlar üstte; sonra en yeni kayıt.
        usort($rows, fn ($a, $b) => [$b['anyAfterBan'], (string) $b['user']['created_at']] <=> [$a['anyAfterBan'], (string) $a['user']['created_at']]);

        return array_slice($rows, 0, 200);
    }

    /**
     * (ip => [user_id => sonGörülme]) haritası. shield_presence + sessions + shield_events birleşik.
     * $exclude=false: user_id IN $userIds (yasaklıların izi). $exclude=true: user_id NOT IN $userIds
     * ama ip IN $onlyIps (o IP'lerdeki yasaksız hesaplar).
     *
     * @param  array<int>  $userIds
     * @param  array<string>|null  $onlyIps
     */
    private static function ipSeen(array $userIds, bool $exclude, ?array $onlyIps = null): array
    {
        $map = [];
        $add = function (string $ip, $uid, string $ts) use (&$map) {
            if ($ip === '' || $uid === null) {
                return;
            }
            $map[$ip][(int) $uid] = max($map[$ip][(int) $uid] ?? '', $ts);
        };

        if (Schema::hasTable('shield_presence')) {
            $q = DB::table('shield_presence')->whereNotNull('user_id')->whereNotNull('ip');
            $exclude ? $q->whereNotIn('user_id', $userIds) : $q->whereIn('user_id', $userIds);
            if ($onlyIps !== null) {
                $q->whereIn('ip', $onlyIps);
            }
            foreach ($q->get(['user_id', 'ip', 'last_seen_at']) as $r) {
                $add($r->ip, $r->user_id, (string) ($r->last_seen_at ?? ''));
            }
        }
        if (Schema::hasTable('shield_events')) {
            $q = DB::table('shield_events')->whereNotNull('user_id')->whereNotNull('ip');
            $exclude ? $q->whereNotIn('user_id', $userIds) : $q->whereIn('user_id', $userIds);
            if ($onlyIps !== null) {
                $q->whereIn('ip', $onlyIps);
            }
            foreach ($q->get(['user_id', 'ip', 'created_at']) as $r) {
                $add($r->ip, $r->user_id, (string) ($r->created_at ?? ''));
            }
        }
        if (Schema::hasTable('sessions')) {
            $q = DB::table('sessions')->whereNotNull('user_id')->whereNotNull('ip_address');
            $exclude ? $q->whereNotIn('user_id', $userIds) : $q->whereIn('user_id', $userIds);
            if ($onlyIps !== null) {
                $q->whereIn('ip_address', $onlyIps);
            }
            foreach ($q->get(['user_id', 'ip_address', 'last_activity']) as $r) {
                $ts = $r->last_activity ? date('Y-m-d H:i:s', (int) $r->last_activity) : '';
                $add($r->ip_address, $r->user_id, $ts);
            }
        }

        return $map;
    }

    private static function editUrl(int $uid): ?string
    {
        try {
            return UserResource::getUrl('edit', ['record' => $uid]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Yasaksız hesabı engelle (CifteGirisler ile aynı mantık — config admin / kendini koru). */
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
        $u->ban_reason = 'Ban kaçağı (yasaklıyla aynı IP)';
        $u->banned_by = auth()->id();
        $u->save();
        $this->memo = null; // yeniden render taze hesaplasın
        Cache::forget('ban_evasion_count');
        Notification::make()->title(($u->nickname ?: $u->email).' engellendi.')->success()->send();
    }

    public function banIp(string $ip): void
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
            ['reason' => 'Ban kaçağı şüphesi', 'created_by' => auth()->id(), 'created_at' => now()],
        );
        Shield::flushIpBans();
        Shield::audit(auth()->id(), 'ip_ban', "IP yasaklandı (ban kaçağı): {$ip}", 2);
        $this->memo = null;
        Notification::make()->title("{$ip} yasaklandı.")->success()->send();
    }
}
