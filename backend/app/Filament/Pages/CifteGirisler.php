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
        return $this->withInterMatches(self::buildSharedIps(max(2, $this->minUsers)));
    }

    /**
     * HİLE SİNYALİ: her paylaşılan IP için, o IP'deki hesapların BİRBİRİYLE oynadığı online maçları
     * (match_type=match, aynı room_code'da ikisi de o IP'de) say — çift başına maç adedi + toplam stake
     * (coin transfer) + galibiyet dağılımı (boost/danışıklı deseni: biri hep kaybediyorsa şüpheli).
     * Ağır sorgu; YALNIZ sayfa görünümünde (sharedIps) çalışır, nav rozetinde DEĞİL.
     */
    private function withInterMatches(array $rows): array
    {
        if ($rows === [] || ! Schema::hasTable('match_results')) {
            return $rows;
        }
        $all = [];
        foreach ($rows as $r) {
            foreach ($r['users'] as $u) {
                $all[$u['id']] = true;
            }
        }
        $all = array_keys($all);

        // Bu kullanıcıların online maçları: room_code -> [user_id => {won, stake}]
        $byRoom = [];
        foreach (DB::table('match_results')
            ->whereIn('user_id', $all)->whereNotNull('room_code')
            ->where('match_type', 'match')
            ->get(['room_code', 'user_id', 'won', 'stake']) as $m) {
            $byRoom[$m->room_code][(int) $m->user_id] = ['won' => (bool) $m->won, 'stake' => (int) ($m->stake ?? 0)];
        }

        foreach ($rows as &$row) {
            $set = array_fill_keys(array_column($row['users'], 'id'), true);
            $names = [];
            foreach ($row['users'] as $u) {
                $names[$u['id']] = $u['name'];
            }
            $pairs = [];
            $count = 0;
            $stakeTotal = 0;
            foreach ($byRoom as $players) {
                $here = array_values(array_filter(array_keys($players), fn ($uid) => isset($set[$uid])));
                if (count($here) < 2) {
                    continue; // ikisi de bu IP'de değil -> self-play sayılmaz
                }
                $n = count($here);
                for ($i = 0; $i < $n; $i++) {
                    for ($j = $i + 1; $j < $n; $j++) {
                        $a = min($here[$i], $here[$j]);
                        $b = max($here[$i], $here[$j]);
                        $key = $a.'-'.$b;
                        $st = max($players[$a]['stake'], $players[$b]['stake']);
                        $pairs[$key]['a'] = $a;
                        $pairs[$key]['b'] = $b;
                        $pairs[$key]['aName'] = $names[$a] ?? ('#'.$a);
                        $pairs[$key]['bName'] = $names[$b] ?? ('#'.$b);
                        $pairs[$key]['n'] = ($pairs[$key]['n'] ?? 0) + 1;
                        $pairs[$key]['stake'] = ($pairs[$key]['stake'] ?? 0) + $st;
                        $winner = $players[$a]['won'] ? $a : ($players[$b]['won'] ? $b : 0);
                        $pairs[$key]['awins'] = ($pairs[$key]['awins'] ?? 0) + ($winner === $a ? 1 : 0);
                        $pairs[$key]['bwins'] = ($pairs[$key]['bwins'] ?? 0) + ($winner === $b ? 1 : 0);
                        $count++;
                        $stakeTotal += $st;
                    }
                }
            }
            usort($pairs, fn ($x, $y) => $y['n'] <=> $x['n']);
            $row['inter'] = ['count' => $count, 'stake' => $stakeTotal, 'pairs' => array_values($pairs)];
        }
        unset($row);

        // Kendi aralarında maç yapan IP'ler (HİLE ŞÜPHESİ) EN ÜSTTE; sonra hesap sayısı.
        usort($rows, fn ($a, $b) => [$b['inter']['count'], $b['count']] <=> [$a['inter']['count'], $a['count']]);

        return $rows;
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
