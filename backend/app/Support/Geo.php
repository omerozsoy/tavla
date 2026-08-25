<?php

namespace App\Support;

// Ulke kodlari (ISO 3166-1 alpha-2). Frontend ile ayni; kayitli deger = kod (or. 'TR').
// Yonetim panelinde dropdown icin kod => Turkce isim uretilir (ext-intl varsa).
class Geo
{
    public const COUNTRY_CODES = [
        'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT',
        'BO','BA','BW','BR','BN','BG','BF','BI','KH','CM','CA','CV','CF','TD','CL','CN','CO','KM','CG','CD',
        'CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI',
        'FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU','IS','IN','ID','IR','IQ',
        'IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI',
        'LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM',
        'NA','NR','NP','NL','NZ','NI','NE','NG','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL','PT',
        'QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB','SO',
        'ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM',
        'TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE','ZM','ZW','MK','XK','PS',
    ];

    // Yonetim dropdown'u icin kod => Turkce ulke adi. ext-intl yoksa kod => kod (fallback).
    public static function countries(): array
    {
        $out = [];
        $hasIntl = function_exists('locale_get_display_region');
        foreach (self::COUNTRY_CODES as $code) {
            $out[$code] = $hasIntl
                ? (\Locale::getDisplayRegion('-' . $code, 'tr') ?: $code)
                : $code;
        }
        asort($out);
        return $out;
    }
}
