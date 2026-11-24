<?php

namespace App\Filament\Pages;

use App\Filament\Resources\UserResource;
use App\Models\User;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aynı Telefon — AYNI telefon numarasına kayıtlı BİRDEN FAZLA hesabı gösterir (çoklu-hesap sinyali).
 * CifteGirisler'in (IP-tabanlı) kardeşi: telefon IP'den çok daha güçlü bir kimlik sinyalidir
 * (paylaşılan ev/kafe/NAT gibi masum değil) ve FARKLI IP'lerden giren alt hesapları yakalar
 * (CifteGirisler onları kaçırır: 418/2138 Arda Şahan vakası — aynı telefon, farklı IP). Telefon
 * biçim farklarını (0543.. / +90543.. / 543..) yutmak için SON 10 HANE ile normalize edilir.
 * SİNYAL'dir, KANIT değil: aile tek telefonu paylaşabilir; yönetici satırdan kullanıcıya gider.
 */
class AyniTelefon extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-device-phone-mobile';

    protected static ?string $navigationLabel = 'Aynı Telefon';

    protected static ?string $title = 'Aynı Telefon — Tek Numara, Birden Fazla Hesap';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.pages.ayni-telefon';

    public static function getNavigationBadge(): ?string
    {
        $n = count(self::buildPhoneGroups());

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    /** Telefonu normalize et: yalnız rakamlar, son 10 hane (TR numaraları için ülke/0 önekini eler). */
    private static function normalizePhone(?string $raw): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $raw);
        if ($digits === null || strlen($digits) < 10) {
            return null; // çok kısa / boş -> gruplamaya alma (gürültü)
        }

        return substr($digits, -10);
    }

    public function rows(): array
    {
        return $this->withInterMatches(self::buildPhoneGroups());
    }

    /**
     * Normalize telefona göre 2+ hesaplı grupları kullanıcı detaylarıyla döndür.
     * account_deleted (anonimleştirilmiş) hesaplar elenir; grup eleme sonrası 2'nin altına düşerse gösterilmez.
     *
     * @return array<int,array{phone:string,count:int,users:array<int,array>}>
     */
    private static function buildPhoneGroups(): array
    {
        $groups = []; // normPhone => [ user rows ]
        DB::table('users')
            ->whereNotNull('phone')->where('phone', '!=', '')
            ->where(fn ($q) => $q->whereNull('ban_reason')->orWhere('ban_reason', '!=', 'account_deleted'))
            ->select(['id', 'nickname', 'first_name', 'last_name', 'email', 'phone', 'rating', 'banned_at', 'created_at', 'last_login_at'])
            ->orderByDesc('id')
            ->chunk(2000, function ($chunk) use (&$groups) {
                foreach ($chunk as $u) {
                    $key = self::normalizePhone($u->phone);
                    if ($key === null) {
                        continue;
                    }
                    $groups[$key][] = $u;
                }
            });

        $out = [];
        foreach ($groups as $key => $users) {
            if (count($users) < 2) {
                continue;
            }
            // En yeni görülen/kayıtlı üstte
            usort($users, fn ($a, $b) => (string) ($b->last_login_at ?? $b->created_at) <=> (string) ($a->last_login_at ?? $a->created_at));
            $list = [];
            foreach ($users as $u) {
                $name = $u->nickname ?: trim(($u->first_name ?? '').' '.($u->last_name ?? '')) ?: ('#'.$u->id);
                $list[] = [
                    'id' => (int) $u->id,
                    'name' => $name,
                    'email' => $u->email,
                    'rating' => $u->rating,
                    'banned' => (bool) $u->banned_at,
                    'created_at' => $u->created_at,
                    'last_seen' => $u->last_login_at,
                    'url' => self::editUrl((int) $u->id),
                ];
            }
            $out[] = [
                'phone' => (string) ($users[0]->phone), // temsilci ham numara (normalize anahtar değil)
                'count' => count($list),
                'last_seen' => max(array_map(fn ($x) => (string) $x['last_seen'], $list)) ?: null,
                'users' => $list,
            ];
        }

        // En çok hesaplı, eşitse en yeni üstte
        usort($out, fn ($a, $b) => [$b['count'], (string) $b['last_seen']] <=> [$a['count'], (string) $a['last_seen']]);

        return array_slice($out, 0, 300);
    }

    /**
     * HİLE SİNYALİ: her telefon grubundaki hesapların BİRBİRİYLE oynadığı coinli maçları say
     * (çift başına adet + toplam stake + galibiyet dağılımı). self-play coin-transfer / boost deseni.
     * ponytail: CifteGirisler::withInterMatches ile AYNI (gruplamadan bağımsız saf mantık); üçüncü
     * eksen (device_id) gelirse ortak bir trait'e çıkar.
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
        $byRoom = [];
        foreach (DB::table('match_results')
            ->whereIn('user_id', array_keys($all))->whereNotNull('room_code')
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
                    continue;
                }
                $n = count($here);
                for ($i = 0; $i < $n; $i++) {
                    for ($j = $i + 1; $j < $n; $j++) {
                        $a = min($here[$i], $here[$j]);
                        $b = max($here[$i], $here[$j]);
                        $key = $a.'-'.$b;
                        $st = max($players[$a]['stake'], $players[$b]['stake']);
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

        // Kendi aralarında maç yapanlar (HİLE ŞÜPHESİ) EN ÜSTTE; sonra hesap sayısı.
        usort($rows, fn ($a, $b) => [$b['inter']['count'], $b['count']] <=> [$a['inter']['count'], $a['count']]);

        return $rows;
    }

    public function stats(): array
    {
        $groups = self::buildPhoneGroups();
        $accounts = 0;
        foreach ($groups as $g) {
            $accounts += $g['count'];
        }

        return [
            'phones' => count($groups),
            'accounts' => $accounts,
            'maxPerPhone' => $groups ? max(array_column($groups, 'count')) : 0,
        ];
    }

    /** Bir hesabı engelle (CifteGirisler/GuvenlikKalkani ile aynı mantık — config admin / kendini koru). */
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

    /** UserResource edit URL (panel bağlamı yoksa — CLI/test — null döner, patlamaz). */
    private static function editUrl(int $uid): ?string
    {
        try {
            return UserResource::getUrl('edit', ['record' => $uid]);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
