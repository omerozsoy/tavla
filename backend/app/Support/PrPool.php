<?php

namespace App\Support;

/**
 * PR havuzlama yardimcisi. Match PR = (Σ sayılan-karar prAdjustedEquityLoss / Σ sayılan karar) × 500.
 * "Sayılan karar" = log girdisinde countsForPR===true (zorunlu/obvious hamleler + eski cube-yok
 * girdileri HARIÇ; checker VE cube kararlari DAHIL). Bu, AuthController::prTotalsFromLog ile AYNI
 * tanimdir (Career PR ayni matematigi kullanir). Eski maçlarda (pr_equity_lost/pr_decisions null)
 * bu yardimci ile log'dan totaller yeniden üretilebilir (backfill).
 */
final class PrPool
{
    /**
     * Log JSON'undan {loss, decisions} havuz toplamlari. Sayilan karar yoksa null.
     *
     * @return array{loss: float, decisions: int}|null
     */
    public static function totalsFromLog(?string $json): ?array
    {
        if (! $json) {
            return null;
        }
        $data = json_decode($json, true);
        $log = is_array($data['log'] ?? null) ? $data['log'] : (is_array($data) ? $data : null);
        if (! is_array($log)) {
            return null;
        }
        $sum = 0.0;
        $n = 0;
        foreach ($log as $e) {
            if (! is_array($e)) {
                continue;
            }
            if (! empty($e['fill'])) {
                continue; // XG dolgu girdisi (analiz yok) -> sayma
            }
            if (array_key_exists('countsForPR', $e)) {
                if (! $e['countsForPR']) {
                    continue; // zorunlu/obvious (checker VEYA cube) -> paydaya girmez
                }
                $sum += max(0.0, (float) ($e['prAdjustedEquityLoss'] ?? $e['loss'] ?? 0));
                $n++;
            } elseif (array_key_exists('cube', $e)) {
                continue; // ESKİ cube log (PR alanı yok) -> phantom 0-karar sayma
            } else {
                // Eski checker log (countsForPR yok): ham loss ortalamasina dus.
                $sum += max(0.0, (float) ($e['loss'] ?? 0));
                $n++;
            }
        }

        return $n > 0 ? ['loss' => $sum, 'decisions' => $n] : null;
    }
}
