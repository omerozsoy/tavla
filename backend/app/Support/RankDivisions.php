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

    public const PR_SETTING_KEY = 'rank_pr_max';

    public const EP_SETTING_KEY = 'rank_ep_min';

    /**
     * Kademe anahtarı (frontend `badges.ts` DIVISIONS key'leri ile AYNI)
     *   => [etiket, varsayılan rating alt eşiği, varsayılan PR üst eşiği, varsayılan min EP].
     *
     * Sıra DÜŞÜKTEN YÜKSEĞE (rating) — form, doğrulama ve /api çıktısı bu sırayı korur.
     * PR ters yönde çalışır (PR düşük = iyi): kademe yükseldikçe prMax DÜŞER. Rookie'nin
     * prMax'i SONSUZDUR (null) — hiçbir PR onun dışında kalmaz, bu yüzden düzenlenemez.
     * EP (tecrübe) kademe yükseldikçe ARTAR ama PLATO olabilir (eşit komşu eşik geçerli;
     * rating+PR zaten ayırır) -> validateEp AZALMAYAN ister (artan değil).
     */
    public const TIERS = [
        'div.rookie' => ['Rookie', 0, null, 0],
        'div.novice' => ['Novice', 1200, 40.0, 0],
        'div.beginner' => ['Beginner', 1400, 30.0, 0],
        'div.developing' => ['Developing', 1450, 22.0, 20],
        'div.i3' => ['Intermediate I3', 1500, 16.0, 50],
        'div.i2' => ['Intermediate I2', 1600, 14.0, 100],
        'div.i1' => ['Intermediate I1', 1700, 12.0, 150],
        'div.a3' => ['Advanced A3', 1800, 10.0, 200],
        'div.a2' => ['Advanced A2', 1900, 8.5, 250],
        'div.a1' => ['Advanced A1', 1950, 7.5, 300],
        'div.m3' => ['Master M3', 2000, 6.5, 300],
        'div.m2' => ['Master M2', 2050, 5.5, 350],
        'div.m1' => ['Master M1', 2100, 4.75, 400],
        'div.g3' => ['Grandmaster G3', 2150, 4.0, 400],
        'div.g2' => ['Grandmaster G2', 2200, 3.5, 450],
        'div.g1' => ['Grandmaster G1', 2250, 3.0, 500],
        'div.g0' => ['Grandmaster G0', 2300, 2.75, 500],
        'div.sgm3' => ['Super Grandmaster S3', 2350, 2.5, 600],
        'div.sgm2' => ['Super Grandmaster S2', 2400, 2.25, 600],
        'div.sgm1' => ['Super Grandmaster S1', 2500, 2.0, 600],
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

    /** Tüm ayarları sil -> kod varsayılanlarına dön (rating + PR + EP). */
    public static function resetToDefaults(): void
    {
        Setting::put(self::SETTING_KEY, '');
        Setting::put(self::PR_SETTING_KEY, '');
        Setting::put(self::EP_SETTING_KEY, '');
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

    // ---- PR (Performance Rating) ÜST EŞİKLERİ ----
    // PR düşük = iyi. `divisionOfPR(pr)` PR'ın girdiği EN İYİ bandı seçer -> eşikler kademe
    // yükseldikçe KESİN AZALAN olmalı. Rookie sonsuzdur (null) ve düzenlenmez.

    /** Kod varsayılanı: kademe anahtarı => prMax (rookie hariç). */
    public static function defaultPrThresholds(): array
    {
        $out = [];
        foreach (self::TIERS as $key => [, , $prMax]) {
            if ($prMax !== null) {
                $out[$key] = (float) $prMax;
            }
        }

        return $out;
    }

    /** Yürürlükteki PR üst eşikleri: kademe anahtarı => prMax (rookie hariç, düşükten yükseğe). */
    public static function prThresholds(): array
    {
        $out = self::defaultPrThresholds();
        $raw = trim(Setting::get(self::PR_SETTING_KEY, ''));
        if ($raw === '') {
            return $out;
        }
        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            return $out; // bozuk JSON -> varsayılana düş
        }
        foreach ($out as $key => $default) {
            if (isset($decoded[$key]) && is_numeric($decoded[$key]) && (float) $decoded[$key] > 0) {
                $out[$key] = round((float) $decoded[$key], 2);
            }
        }

        return $out;
    }

    /** PR üst eşiklerini kaydet (yalnız BİLİNEN anahtarlar; rookie yok sayılır). */
    public static function putPr(array $prMax): void
    {
        $clean = [];
        foreach (self::defaultPrThresholds() as $key => $default) {
            $clean[$key] = isset($prMax[$key]) && is_numeric($prMax[$key]) && (float) $prMax[$key] > 0
                ? round((float) $prMax[$key], 2)
                : (float) $default;
        }
        Setting::put(self::PR_SETTING_KEY, json_encode($clean));
    }

    /**
     * KESİN AZALAN mı? Değilse kullanıcıya gösterilecek hata metni, uygunsa null.
     * (Artan/eşit bir prMax o bandı erişilemez yapar -> kademe hiçbir PR'a denk gelmez.)
     */
    public static function validatePr(array $prMax): ?string
    {
        $prev = null;
        $prevLabel = '';
        foreach (self::defaultPrThresholds() as $key => $default) {
            $label = self::TIERS[$key][0];
            $value = isset($prMax[$key]) && is_numeric($prMax[$key]) ? round((float) $prMax[$key], 2) : (float) $default;
            if ($value <= 0) {
                return "“{$label}” PR eşiği sıfırdan büyük olmalı.";
            }
            if ($prev !== null && $value >= $prev) {
                return "“{$label}” PR eşiği ({$value}) bir önceki kademeden küçük olmalı ({$prevLabel}: {$prev}) — PR düşük = iyi.";
            }
            $prev = $value;
            $prevLabel = $label;
        }

        return null;
    }

    // ---- EP (Experience Points / Tecrübe) MİN EŞİKLERİ ----
    // EP = geçerli maçların hedef puanları toplamı (Σ match_length). Kademe yükseldikçe min EP
    // ARTAR ama PLATO olabilir (rating+PR zaten ayırdığı için eşit komşu eşik geçerli). Rookie 0.

    /** Kod varsayılanı: kademe anahtarı => minEP (tüm kademeler, rookie 0 dahil). */
    public static function defaultEpThresholds(): array
    {
        $out = [];
        foreach (self::TIERS as $key => $row) {
            $out[$key] = (int) ($row[3] ?? 0);
        }

        return $out;
    }

    /** Yürürlükteki min EP eşikleri: kademe anahtarı => minEP (düşükten yükseğe). */
    public static function epThresholds(): array
    {
        $out = self::defaultEpThresholds();
        $raw = trim(Setting::get(self::EP_SETTING_KEY, ''));
        if ($raw === '') {
            return $out;
        }
        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            return $out; // bozuk JSON -> varsayılana düş
        }
        foreach ($out as $key => $default) {
            if (isset($decoded[$key]) && is_numeric($decoded[$key])) {
                $out[$key] = max(0, (int) $decoded[$key]);
            }
        }

        return $out;
    }

    /** Min EP eşiklerini kaydet (yalnız BİLİNEN anahtarlar; bilinmeyenler atılır). */
    public static function putEp(array $mins): void
    {
        $clean = [];
        foreach (self::defaultEpThresholds() as $key => $default) {
            $clean[$key] = isset($mins[$key]) && is_numeric($mins[$key])
                ? max(0, (int) $mins[$key])
                : (int) $default;
        }
        Setting::put(self::EP_SETTING_KEY, json_encode($clean));
    }

    /**
     * AZALMAYAN mı? Değilse hata metni, uygunsa null. (EP rating/PR gibi KESİN artan OLMAK
     * ZORUNDA DEĞİL — eşit komşu eşik geçerli; rating+PR kademeyi zaten ayırır. Yalnız bir
     * üst kademenin alttan DÜŞÜK EP istemesi mantıksız -> onu engelle.)
     */
    public static function validateEp(array $mins): ?string
    {
        $prev = null;
        $prevLabel = '';
        foreach (self::TIERS as $key => $row) {
            $label = $row[0];
            $default = (int) ($row[3] ?? 0);
            $value = isset($mins[$key]) && is_numeric($mins[$key]) ? max(0, (int) $mins[$key]) : $default;
            if ($prev !== null && $value < $prev) {
                return "“{$label}” min EP ({$value}) bir önceki kademeden küçük olamaz ({$prevLabel}: {$prev}).";
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
