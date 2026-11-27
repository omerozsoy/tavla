<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;
use App\Services\CareerPrService;

/**
 * RÜTBE İLERLEMESİ — bir oyuncunun YENİ rütbe sisteminde (rating + PR + EP) kullanacağı
 * iki türetilmiş değeri hesaplar: güncel pencere-PR ve toplam EP (tecrübe).
 *
 *  - EP (tecrübe)  = Σ match_length (rütbe-geçerli maçlar). Kademe "min EP" kapısı bununla.
 *  - Pencere PR    = SON {WINDOW_EP} EP'lik maçlarda karar-ağırlıklı otoriter gnubg_pr:
 *                    Σ(gnubg_pr × pr_decisions) / Σ pr_decisions  (CareerPrService ile AYNI
 *                    ölçek/konvansiyon; ama kariyer-ömrü değil, YAKIN DÖNEM penceresi).
 *                    Neden pencere: oyuncu 20 PR'dan 4 PR'a geliştikçe eski kötü maçlar
 *                    ömür-boyu ortalamayı kirletmesin -> güncel seviyeyi yansıtsın.
 *
 * Geçerli maç kümesi = CareerPrService::eligibleMatches (gerçek + online + rated + ≥MIN karar
 * + analizli) ARTI: 1 ve 3 puanlık maçlar HARİÇ (EP tanımı gereği; kısa maç PR'ı da gürültülü).
 *
 * Maliyet: oyuncu başına TEK sorgu (3 kolon). me() çağrısında inline — ucuz. Yoğunlaşırsa
 * users'a türetilmiş kolon cache'i eklenir (ponytail: cache sonra, me() gecikmesi ölçülürse).
 */
class RankProgress
{
    /** PR penceresi varsayılanı: son bu kadar EP'lik maç. Admin "Rating Ayar"dan düzenlenir. */
    public const WINDOW_EP = 400;

    /** Yürürlükteki PR penceresi (EP) — admin ayarı, 50 tabanlı. */
    public static function windowEp(): int
    {
        return max(50, Setting::int('rank_pr_window_ep', self::WINDOW_EP));
    }

    /**
     * @return array{window_pr: float|null, ep: int, window_ep: int}
     *                                                               window_pr: güncel pencere PR (null = yeterli analizli maç yok)
     *                                                               ep: toplam tecrübe (Σ match_length)
     *                                                               window_ep: PR'ın hesaplandığı gerçek EP aralığı (≤ WINDOW_EP)
     */
    public static function forUser(User $user): array
    {
        $rows = app(CareerPrService::class)->eligibleMatches($user->id)
            ->whereNotNull('gnubg_pr')
            ->whereNotNull('match_length')
            ->whereNotIn('match_length', [1, 3])     // 1 ve 3 puanlık maçlar EP dışı
            ->orderByDesc('created_at')->orderByDesc('id') // en yeni önce (pencere baştan)
            ->get(['match_length', 'gnubg_pr', 'pr_decisions']);

        $totalEp = 0;
        foreach ($rows as $r) {
            $totalEp += (int) $r->match_length;
        }

        // En yeniden geriye: pencereye (EP) ulaşana kadar karar-ağırlıklı gnubg_pr havuzla.
        $window = self::windowEp();
        $wsum = 0.0;
        $wdec = 0;
        $accEp = 0;
        foreach ($rows as $r) {
            if ($accEp >= $window) {
                break;
            }
            $dec = (int) $r->pr_decisions;
            $wsum += (float) $r->gnubg_pr * $dec;
            $wdec += $dec;
            $accEp += (int) $r->match_length;
        }

        return [
            'window_pr' => $wdec > 0 ? round($wsum / $wdec, 2) : null,
            'ep' => $totalEp,
            'window_ep' => min($accEp, $window),
        ];
    }
}
