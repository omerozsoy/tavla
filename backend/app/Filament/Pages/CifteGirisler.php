<?php

namespace App\Filament\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Çifte Girişler — AYNI IP'den giren BİRDEN FAZLA hesabı gösterir (çoklu-hesap / multi-account sinyali).
 * Kaynak: shield_presence (son ~2 gün, ShieldTracker canlı tutar) + sessions (aktif oturumlar) — ikisinden
 * (user_id, ip) çiftleri birleştirilip 2+ farklı kullanıcılı IP'ler listelenir. SİNYAL'dir, KANIT değil:
 * aynı ev/ofis/kafe/mobil-NAT normalde paylaşılır; yönetici satırdan kullanıcıya gidip inceler/engeller.
 * Daha uzun geçmiş istenirse kalıcı (user_id,ip) log'u ayrıca eklenmeli (shield_presence 2 günde prune olur).
 */
class CifteGirisler extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-finger-print';

    protected static ?string $navigationLabel = 'Çifte Girişler';

    protected static ?string $title = 'Çifte Girişler — Aynı IP, Birden Fazla Hesap';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 2;

    protected static string $view = 'filament.pages.cifte-girisler';

    /** En az kaç farklı hesap aynı IP'de olmalı (varsayılan 2). */
    public int $minUsers = 2;

    public static function getNavigationBadge(): ?string
    {
        $n = count(self::buildSharedIps(2));

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public function sharedIps(): array
    {
        return self::buildSharedIps(max(2, $this->minUsers));
    }

    /**
     * (ip -> [user_id => son_görülme]) haritasını shield_presence + sessions'tan kur, minUsers+ farklı
     * kullanıcılı IP'leri kullanıcı detaylarıyla döndür. En çok hesaplı + en yeni üstte.
     *
     * @return array<int,array{ip:string,count:int,last_seen:?string,users:array<int,array>}>
     */
    private static function buildSharedIps(int $minUsers): array
    {
        $pairs = []; // ip => [user_id => son_görülme (string)]

        if (Schema::hasTable('shield_presence')) {
            foreach (DB::table('shield_presence')->whereNotNull('user_id')->whereNotNull('ip')
                ->get(['user_id', 'ip', 'last_seen_at']) as $r) {
                $ts = (string) ($r->last_seen_at ?? '');
                $pairs[$r->ip][$r->user_id] = max($pairs[$r->ip][$r->user_id] ?? '', $ts);
            }
        }
        if (Schema::hasTable('sessions')) {
            foreach (DB::table('sessions')->whereNotNull('user_id')->whereNotNull('ip_address')
                ->get(['user_id', 'ip_address', 'last_activity']) as $r) {
                $ts = $r->last_activity ? date('Y-m-d H:i:s', (int) $r->last_activity) : '';
                $pairs[$r->ip_address][$r->user_id] = max($pairs[$r->ip_address][$r->user_id] ?? '', $ts);
            }
        }

        // 2+ farklı hesaplı IP'ler
        $shared = array_filter($pairs, fn ($users) => count($users) >= $minUsers);
        if ($shared === []) {
            return [];
        }

        // Kullanıcı detaylarını tek sorguda çek (string-anahtarlı $shared -> spread yerine döngü)
        $ids = [];
        foreach ($shared as $u) {
            foreach (array_keys($u) as $uid) {
                $ids[$uid] = true;
            }
        }
        $ids = array_keys($ids);
        $users = DB::table('users')->whereIn('id', $ids)
            ->get(['id', 'nickname', 'first_name', 'email', 'banned_at', 'created_at', 'rating'])
            ->keyBy('id');

        $out = [];
        foreach ($shared as $ip => $u) {
            arsort($u); // en son görülen hesap üstte
            $list = [];
            foreach ($u as $uid => $lastSeen) {
                $usr = $users[$uid] ?? null;
                $list[] = [
                    'id' => (int) $uid,
                    'name' => $usr?->nickname ?: ($usr?->first_name ?: ('#'.$uid)),
                    'email' => $usr?->email,
                    'rating' => $usr?->rating,
                    'banned' => (bool) ($usr?->banned_at),
                    'created_at' => $usr?->created_at,
                    'last_seen' => $lastSeen ?: null,
                    'url' => $usr ? self::editUrl((int) $uid) : null,
                ];
            }
            $out[] = [
                'ip' => (string) $ip,
                'count' => count($list),
                'last_seen' => $list ? max(array_column($list, 'last_seen')) : null,
                'users' => $list,
            ];
        }

        // En çok hesaplı, eşitse en yeni görülen üstte
        usort($out, fn ($a, $b) => [$b['count'], (string) $b['last_seen']] <=> [$a['count'], (string) $a['last_seen']]);

        return array_slice($out, 0, 200);
    }

    /** UserResource edit URL (panel bağlamı yoksa — CLI/test — null döner, patlamaz). */
    private static function editUrl(int $uid): ?string
    {
        try {
            return UserResource::getUrl('edit', ['record' => $uid]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Üst kart özetleri. */
    public function stats(): array
    {
        $shared = self::buildSharedIps(2);
        $accounts = [];
        foreach ($shared as $row) {
            foreach ($row['users'] as $u) {
                $accounts[$u['id']] = true;
            }
        }

        return [
            'ips' => count($shared),
            'accounts' => count($accounts),
            'maxPerIp' => $shared ? max(array_column($shared, 'count')) : 0,
        ];
    }

    /** Bir hesabı engelle (GuvenlikKalkani ile aynı mantık — config admin / kendini koru). */
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
}
