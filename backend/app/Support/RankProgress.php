<?php

namespace App\Support;

use App\Models\User;
use App\Services\CareerPrService;

/**
 * RÜTBE İLERLEMESİ — bir oyuncunun YENİ rütbe sisteminde (rating + PR + EP) kullanacağı
 * iki türetilmiş değeri hesaplar: PR ve toplam EP (tecrübe).
 *
 *  - EP (tecrübe) = Σ match_length (rütbe-geçerli maçlar). Kademe "min EP" kapısı bununla.
 *  - PR           = TEK PR: tüm geçerli maçlarda karar-ağırlıklı otoriter gnubg_pr:
 *                   Σ(gnubg_pr × pr_decisions) / Σ pr_decisions. CareerPrService (profil "Kariyer PR")
 *                   ile AYNI formül + AYNI maç kümesi -> profil ve rütbe BİREBİR aynı PR'ı gösterir
 *                   ("tek PR"). Pencere/yakın-dönem AYRIMI YOKTUR (eskiden son N EP penceresi vardı;
 *                   kaldırıldı ki profildeki sayı ile rütbedeki sayı farklı çıkmasın).
 *
 * Geçerli maç kümesi = CareerPrService::eligibleMatches (gerçek + online + rated + ≥MIN karar +
 * analizli) — JETON (1 puanlık) maçlar orada elenir; 3+ puanlık maçlar DAHİLDİR. Tek kaynak: eligibleMatches.
 *
 * Maliyet: oyuncu başına TEK sorgu. me() çağrısında inline — ucuz.
 */
class RankProgress
{
    /**
     * @return array{window_pr: float|null, ep: int, window_ep: int}
     *                                                               window_pr: TEK PR (null = yeterli analizli maç yok) — kariyer PR ile aynı değer
     *                                                               ep: toplam tecrübe (Σ match_length, jeton hariç)
     *                                                               window_ep: = ep (pencere kavramı kaldırıldı; geriye uyum için tutuluyor)
     */
    public static function forUser(User $user): array
    {
        $rows = app(CareerPrService::class)->eligibleMatches($user->id)
            ->whereNotNull('gnubg_pr')
            ->whereNotNull('match_length')
            ->get(['match_length', 'gnubg_pr', 'pr_decisions']);

        $totalEp = 0;
        $wsum = 0.0;
        $wdec = 0;
        foreach ($rows as $r) {
            $totalEp += (int) $r->match_length;
            $dec = (int) $r->pr_decisions;
            $wsum += (float) $r->gnubg_pr * $dec;
            $wdec += $dec;
        }

        return [
            'window_pr' => $wdec > 0 ? round($wsum / $wdec, 2) : null,
            'ep' => $totalEp,
            'window_ep' => $totalEp,
        ];
    }
}
