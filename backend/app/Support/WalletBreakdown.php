<?php

namespace App\Support;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bir kullanıcının coin'inin NEREDEN geldiğini defterden (wallet_transactions) çıkarır:
 *  - kategori bazında kazanç/harcama dökümü (tavla / slot / çark / günlük / turnuva / admin ...)
 *  - bakiye ile defter toplamını KARŞILAŞTIRIR → "izahı olmayan para" (kaçak) tespiti
 *  - admin müdahalelerini (kim, ne zaman, ne kadar) ayrı listeler
 *  - DB'nin doğrudan kurcalanmasını (mutation audit trigger'ları) rapor eder
 *
 * Tamamen okuma amaçlı; hiçbir yazma yapmaz. Filament üye detay "Cüzdan" sekmesi ve
 * tavla:wallet-audit komutu bunu ortak kullanır.
 */
class WalletBreakdown
{
    /** type → [okunur etiket, ikon, kategori anahtarı] */
    public const TYPES = [
        'match_settlement_credit' => ['Tavla maçı kazancı', '🎲', 'match'],
        'match_settlement_debit'  => ['Tavla maçı kaybı', '🎲', 'match'],
        'dice_slot_payout'        => ['Zar Slotu kazancı', '🎰', 'slot'],
        'dice_slot_spin'          => ['Zar Slotu çevirme', '🎰', 'slot'],
        'lucky_wheel_reward'      => ['Çark ödülü', '🎡', 'wheel'],
        'lucky_wheel_spin'        => ['Çark çevirme', '🎡', 'wheel'],
        'daily_reward'            => ['Günlük ödül', '🎁', 'daily'],
        'achievement_reward'      => ['Rozet ödülü', '🏅', 'achievement'],
        'welcome_reward'          => ['Hoş geldin bonusu', '🎉', 'welcome'],
        'tournament_prize'        => ['Turnuva ödülü', '🏆', 'tournament'],
        'tournament_pool_prize'   => ['Turnuva havuz ödülü', '🏆', 'tournament'],
        'tournament_refund'       => ['Turnuva iadesi', '🏆', 'tournament'],
        'tournament_entry'        => ['Turnuva katılım', '🏆', 'tournament'],
        'shop_purchase'           => ['Mağaza alışverişi', '🛒', 'shop'],
        'product_purchase'        => ['Ürün alımı', '🛒', 'shop'],
        'payment'                 => ['Ödeme (gerçek para)', '💳', 'payment'],
        'payment_cart'            => ['Ödeme · sepet (gerçek para)', '💳', 'payment'],
        'admin_adjustment'        => ['Admin bakiye düzenleme', '🛠️', 'admin'],
        'admin_reset_coins'       => ['Admin toplu sıfırlama', '🛠️', 'admin'],
    ];

    /** kategori anahtarı → [okunur etiket, ikon] (döküm sırası da budur) */
    public const CATEGORIES = [
        'match'       => ['Tavla (para maçı)', '🎲'],
        'slot'        => ['Zar Slotu', '🎰'],
        'wheel'       => ['Şans Çarkı', '🎡'],
        'daily'       => ['Günlük ödül', '🎁'],
        'achievement' => ['Rozet / başarım', '🏅'],
        'welcome'     => ['Hoş geldin', '🎉'],
        'tournament'  => ['Turnuva', '🏆'],
        'shop'        => ['Mağaza harcaması', '🛒'],
        'payment'     => ['Gerçek para ile alım', '💳'],
        'admin'       => ['⚠ ADMIN müdahalesi', '🛠️'],
        'other'       => ['Diğer / sınıflandırılmamış', '❔'],
    ];

    public static function typeLabel(string $type): string
    {
        return self::TYPES[$type][0] ?? $type;
    }

    public static function categoryOf(string $type): string
    {
        return self::TYPES[$type][2] ?? 'other';
    }

    /**
     * Hızlı reconciliation (toplu tarama için): sadece bakiye ↔ defter tutarlılığı.
     * for()'un ağır kısımlarını (recent/admin/tamper) atlar; ~3 ucuz aggregate sorgu.
     *
     * @return array{clean:bool,unexplained:int,internal_ok:bool,balance_ok:bool,baseline:int,ledger_net:int,expected:int,count:int}
     */
    public static function quickRecon(int $uid, int $coins): array
    {
        $agg = WalletTransaction::query()->where('user_id', $uid)
            ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(amount),0) as net')->first();
        $count = (int) ($agg->cnt ?? 0);
        $net = (int) ($agg->net ?? 0);

        if ($count === 0) {
            return ['clean' => true, 'unexplained' => 0, 'internal_ok' => true, 'balance_ok' => true,
                'baseline' => 0, 'ledger_net' => 0, 'expected' => $coins, 'count' => 0];
        }

        $baseline = (int) WalletTransaction::query()->where('user_id', $uid)->orderBy('id')->value('balance_before');
        $expected = (int) WalletTransaction::query()->where('user_id', $uid)->orderByDesc('id')->value('balance_after');

        $internalOk = ($baseline + $net) === $expected;
        $unexplained = $coins - $expected;
        $balanceOk = $unexplained === 0;

        return ['clean' => $internalOk && $balanceOk, 'unexplained' => $unexplained,
            'internal_ok' => $internalOk, 'balance_ok' => $balanceOk,
            'baseline' => $baseline, 'ledger_net' => $net, 'expected' => $expected, 'count' => $count];
    }

    /**
     * @return array Blade'in doğrudan kullandığı yapı.
     */
    public static function for(User $user): array
    {
        $uid = (int) $user->id;
        $coins = (int) ($user->coins ?? 0);
        $reserved = (int) ($user->coins_reserved ?? 0);

        if (! Schema::hasTable('wallet_transactions')) {
            return [
                'available' => false,
                'coins' => $coins,
                'reserved' => $reserved,
            ];
        }

        // --- Kategori dökümü (SQL group-by; büyük hesaplarda da hızlı) ---
        $rows = WalletTransaction::query()
            ->where('user_id', $uid)
            ->selectRaw('type,
                COUNT(*) as cnt,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credited,
                SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) as debited')
            ->groupBy('type')
            ->get();

        $cats = [];
        foreach (self::CATEGORIES as $key => [$label, $icon]) {
            $cats[$key] = [
                'key' => $key, 'label' => $label, 'icon' => $icon,
                'credited' => 0, 'debited' => 0, 'net' => 0, 'count' => 0, 'types' => [],
            ];
        }
        $totalCredited = 0;
        $totalDebited = 0;
        $totalCount = 0;
        foreach ($rows as $r) {
            $cat = self::categoryOf((string) $r->type);
            $credited = (int) $r->credited;
            $debited = (int) $r->debited;
            $cats[$cat]['credited'] += $credited;
            $cats[$cat]['debited'] += $debited;
            $cats[$cat]['net'] += $credited - $debited;
            $cats[$cat]['count'] += (int) $r->cnt;
            $cats[$cat]['types'][] = [
                'type' => (string) $r->type,
                'label' => self::typeLabel((string) $r->type),
                'credited' => $credited,
                'debited' => $debited,
                'count' => (int) $r->cnt,
            ];
            $totalCredited += $credited;
            $totalDebited += $debited;
            $totalCount += (int) $r->cnt;
        }
        // Boş kategorileri gizle
        $cats = array_values(array_filter($cats, fn ($c) => $c['count'] > 0));

        // --- Reconciliation (izahı olmayan para) ---
        $first = WalletTransaction::query()->where('user_id', $uid)->orderBy('id')->first();
        $last = WalletTransaction::query()->where('user_id', $uid)->orderByDesc('id')->first();
        $ledgerNet = $totalCredited - $totalDebited;

        $recon = [
            'has_ledger' => $totalCount > 0,
            'baseline' => $first ? (int) $first->balance_before : 0,      // ledger öncesi başlangıç bakiyesi
            'ledger_net' => $ledgerNet,
            'expected' => $last ? (int) $last->balance_after : $coins,     // defterin dediği son bakiye
            'coins' => $coins,
        ];
        if ($totalCount > 0) {
            // İç tutarlılık: baseline + net == son balance_after (silinen/değişen satır bunu bozar)
            $recon['internal_ok'] = ($recon['baseline'] + $ledgerNet) === $recon['expected'];
            // Bakiye tutarlılığı: güncel coin == defterin son bakiyesi (defter dışı ekleme bunu bozar)
            $recon['unexplained'] = $coins - $recon['expected'];
            $recon['balance_ok'] = $recon['unexplained'] === 0;
        } else {
            $recon['internal_ok'] = true;
            $recon['unexplained'] = 0;
            $recon['balance_ok'] = true;
        }
        $recon['clean'] = $recon['internal_ok'] && $recon['balance_ok'];

        // --- Aktör (hangi admin) çözümleme ---
        $actorIds = WalletTransaction::query()
            ->where('user_id', $uid)
            ->whereNotNull('actor_user_id')
            ->distinct()->pluck('actor_user_id')->all();
        $actorMap = empty($actorIds)
            ? collect()
            : User::whereIn('id', $actorIds)->get(['id', 'nickname'])->keyBy('id');

        $actorName = function (?int $id) use ($actorMap): ?string {
            if ($id === null) {
                return null;
            }
            return $actorMap[$id]->nickname ?? ('#'.$id);
        };

        // --- Admin müdahaleleri (ayrı, vurgulu liste) ---
        $adminEvents = WalletTransaction::query()
            ->where('user_id', $uid)
            ->whereIn('type', ['admin_adjustment', 'admin_reset_coins'])
            ->orderByDesc('id')->limit(100)->get()
            ->map(fn (WalletTransaction $t) => [
                'date' => $t->created_at,
                'type' => self::typeLabel((string) $t->type),
                'amount' => (int) $t->amount,
                'balance_after' => (int) $t->balance_after,
                'actor' => $actorName($t->actor_user_id),
            ])->all();

        // --- Son işlemler ---
        $recent = WalletTransaction::query()
            ->where('user_id', $uid)
            ->orderByDesc('id')->limit(100)->get()
            ->map(fn (WalletTransaction $t) => [
                'date' => $t->created_at,
                'type' => self::typeLabel((string) $t->type),
                'raw_type' => (string) $t->type,
                'amount' => (int) $t->amount,
                'balance_after' => (int) $t->balance_after,
                'actor' => $actorName($t->actor_user_id),
                'ref' => $t->reference_type ? (class_basename($t->reference_type).'#'.$t->reference_id) : null,
            ])->all();

        // --- Doğrudan DB kurcalama denetimi (MySQL trigger audit) ---
        $tamper = [];
        if (Schema::hasTable('wallet_transaction_mutations')) {
            $tamper = DB::table('wallet_transaction_mutations')
                ->where('old_user_id', $uid)->orWhere('new_user_id', $uid)
                ->orderByDesc('id')->limit(50)->get()
                ->map(fn ($m) => [
                    'date' => $m->created_at,
                    'operation' => $m->operation,
                    'old_amount' => $m->old_amount,
                    'new_amount' => $m->new_amount,
                    'db_actor' => $m->db_actor,
                ])->all();
        }

        return [
            'available' => true,
            'coins' => $coins,
            'reserved' => $reserved,
            'categories' => $cats,
            'total_credited' => $totalCredited,
            'total_debited' => $totalDebited,
            'total_count' => $totalCount,
            'recon' => $recon,
            'admin_events' => $adminEvents,
            'recent' => $recent,
            'tamper' => $tamper,
        ];
    }
}
