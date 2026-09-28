<?php

namespace App\Support;

use App\Models\Setting;

/**
 * RÜTBE (division) RATING EŞİKLERİ — TEK doğruluk kaynağı.
 *
 * Eşikler artık KODDA SABİT DEĞİL: yönetim paneli > Ayarlar > "Rating Ayar" sayfasından
 * düzenlenir, `settings` tablosunda TEK bir JSON satırında (`rank_divisions`) tutulur.
 * Kayıt yoksa/bozuksa aşağıdaki VARSAYILANLAR kullanılır -> migration/deploy güvenli.
 *
 * ÜÇ tüketici de buradan okur (eşikler bir yerde):
 *  - PanelController::levelLabel()  -> eski panel + Filament UserResource "Seviye" sütunu
 *  - RankDivisionController         -> /api/rank-divisions (SPA `src/badges.ts` hidrasyonu)
 *  - RatingSettings (Filament)      -> düzenleme formu
 *
 * INVARYANT: eşikler KESİN ARTAN olmalı. `divisionOf`/`rankOf` "rating'in ulaştığı en yüksek
 * kademe"yi seçtiği için azalan bir eşik kademeyi ERİŞİLEMEZ yapar -> validate() bunu engeller.
 */
class RankDivisions
{
    public const SETTING_KEY = 'rank_divisions';

    /**
     * Kademe anahtarı (frontend `badges.ts` DIVISIONS key'leri ile AYNI) => [etiket, varsayılan eşik].
     * Sıra DÜŞÜKTEN YÜKSEĞE — form, doğrulama ve /api çıktısı bu sırayı korur.
     */
    public const TIERS = [
        'div.rookie' => ['Rookie', 0],
        'div.novice' => ['Novice', 1200],
        'div.beginner' => ['Beginner', 1400],
        'div.developing' => ['Developing', 1450],
        'div.i3' => ['Intermediate I3', 1500],
        'div.i2' => ['Intermediate I2', 1600],
        'div.i1' => ['Intermediate I1', 1700],
        'div.a3' => ['Advanced A3', 1800],
        'div.a2' => ['Advanced A2', 1900],
        'div.a1' => ['Advanced A1', 1950],
        'div.m3' => ['Master M3', 2000],
        'div.m2' => ['Master M2', 2050],
        'div.m1' => ['Master M1', 2100],
        'div.g3' => ['Grandmaster G3', 2150],
        'div.g2' => ['Grandmaster G2', 2200],
        'div.g1' => ['Grandmaster G1', 2250],
        'div.g0' => ['Grandmaster G0', 2300],
        'div.sgm3' => ['Super Grandmaster S3', 2350],
        'div.sgm2' => ['Super Grandmaster S2', 2400],
        'div.sgm1' => ['Super Grandmaster S1', 2500],
    ];

    /** Filament form alan adı: state path'te NOKTA iç içe dizi demek -> '.' yerine '_'. */
    public static function formKey(string $tierKey): string
    {
        return str_replace('.', '_', $tierKey);
    }

    /** Yürürlükteki eşikler: kademe anahtarı => rating alt eşiği (düşükten yükseğe). */
    public static function thresholds(): array
    {
        $out = [];
        foreach (self::TIERS as $key => [, $default]) {
            $out[$key] = (int) $default;
        }
        $raw = trim(Setting::get(self::SETTING_KEY, ''));
        if ($raw === '') {
            return $out; // hiç kaydedilmemiş -> varsayılan tablo
        }
        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            return $out; // bozuk JSON -> varsayılana düş (site rütbesiz kalmasın)
        }
        foreach ($out as $key => $default) {
            if (isset($decoded[$key]) && is_numeric($decoded[$key])) {
                $out[$key] = max(0, (int) $decoded[$key]);
            }
        }

        return $out;
    }

    /** Eşikleri kaydet (yalnız BİLİNEN anahtarlar; bilinmeyenler atılır). */
    public static function put(array $mins): void
    {
        $clean = [];
        foreach (self::TIERS as $key => [, $default]) {
            $clean[$key] = isset($mins[$key]) && is_numeric($mins[$key])
                ? max(0, (int) $mins[$key])
                : (int) $default;
        }
        Setting::put(self::SETTING_KEY, json_encode($clean));
    }

    /** Ayarı sil -> kod varsayılanlarına dön. */
    public static function resetToDefaults(): void
    {
        Setting::put(self::SETTING_KEY, '');
    }

    /** Kod varsayılanları (kademe anahtarı => eşik). */
    public static function defaults(): array
    {
        $out = [];
        foreach (self::TIERS as $key => [, $default]) {
            $out[$key] = (int) $default;
        }

        return $out;
    }

    /**
     * KESİN ARTAN mı? Değilse kullanıcıya gösterilecek hata metni, uygunsa null.
     * (Azalan/eşit eşik bir kademeyi erişilemez yapar -> rütbe atlanır.)
     */
    public static function validate(array $mins): ?string
    {
        $prev = null;
        $prevLabel = '';
        foreach (self::TIERS as $key => [$label, $default]) {
            $value = isset($mins[$key]) && is_numeric($mins[$key]) ? (int) $mins[$key] : (int) $default;
            if ($prev !== null && $value <= $prev) {
                return "“{$label}” eşiği ({$value}) bir önceki kademeden büyük olmalı ({$prevLabel}: {$prev}).";
            }
            $prev = $value;
            $prevLabel = $label;
        }

        return null;
    }

    /**
     * Etiket => eşik, YÜKSEKTEN DÜŞÜĞE. PanelController::levelLabel() bu sırada ilk eşleşeni alır;
     * UserResource'taki "Seviye" seçim kutusu da bunu kullanır.
     */
    public static function levels(): array
    {
        $out = [];
        foreach (array_reverse(self::thresholds(), true) as $key => $min) {
            $out[self::TIERS[$key][0]] = $min;
        }

        return $out;
    }
}
