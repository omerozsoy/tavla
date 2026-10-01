<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Takma ad (nickname) kufur/uygunsuz icerik suzgeci. Panelden yonetilir
 * (Site Ayarlari > Yasakli Takma Adlar; Setting key 'banned_nicknames', satir/virgul ayrik).
 * Admin kaydetmemisse DEFAULT_LIST devreye girer (out-of-box koruma). Admin bos kaydederse
 * (row var ama bos) suzgec kapanir -> tam panel kontrolu.
 *
 * Eslesme: nickname NORMALIZE edilir (kucuk harf + TR->ASCII + leetspeak + yalniz a-z) ve
 * yasakli kokler SUBSTRING olarak aranir -> "a.m.k", "4mk", "s_i_k_t_i_r" gibi kacislar yakalanir.
 * ponytail: substring eslesme kisa koklerde yanlis-pozitif verebilir (scunthorpe sorunu);
 * DEFAULT_LIST bu yuzden >=4 harfli/net kelimelerden secildi, admin listeyi inceltir.
 */
class NicknameFilter
{
    /** Varsayilan yasakli liste (TR + EN). Panelden duzenlenebilir; admin kaydi bunu EZER. */
    public const DEFAULT_LIST = "amk\namcik\norospu\noruspu\nsiktir\nsikik\nsikim\nsikis\nsikerim\nyarrak\nyarak\npezevenk\npezo\ngavat\nkahpe\ngotveren\ngotlek\nibne\npust\nfuck\nmotherfuck\nshit\nbitch\nnigger\nnigga\ncunt\npussy\nwhore\nasshole\nfaggot\nbastard\nslut";

    /** Panel ayarindaki ham liste (satir/virgul ayrik); kayit yoksa DEFAULT_LIST. */
    public static function rawList(): string
    {
        $all = Setting::map();

        // Row VARSA (bos olsa bile) admin tercihine saygi; yoksa varsayilan listeye dus.
        return array_key_exists('banned_nicknames', $all)
            ? (string) $all['banned_nicknames']
            : self::DEFAULT_LIST;
    }

    /** @return string[] normalize edilmis, benzersiz, bos-olmayan yasakli kokler */
    public static function words(): array
    {
        $parts = preg_split('/[\r\n,]+/', self::rawList()) ?: [];
        $out = [];
        foreach ($parts as $p) {
            $w = self::normalize($p);
            if ($w !== '') {
                $out[] = $w;
            }
        }

        return array_values(array_unique($out));
    }

    /** Kucuk harf + TR->ASCII + leetspeak + yalniz a-z (kacis-dayanikli karsilastirma anahtari). */
    public static function normalize(string $s): string
    {
        $s = mb_strtolower($s, 'UTF-8');
        $s = strtr($s, [
            'ç' => 'c', 'ğ' => 'g', 'ı' => 'i', 'ş' => 's', 'ö' => 'o', 'ü' => 'u',
            'â' => 'a', 'î' => 'i', 'û' => 'u', 'é' => 'e',
        ]);
        $s = strtr($s, ['0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '@' => 'a', '$' => 's']);

        return preg_replace('/[^a-z]/', '', $s) ?? '';
    }

    /** Takma ad uygun mu? (yasakli kok substring olarak gecmiyorsa true). */
    public static function isAllowed(string $nickname): bool
    {
        $n = self::normalize($nickname);
        if ($n === '') {
            return true; // bos/sadece-sembol: 'required' gibi diger kurallar ele alir
        }
        foreach (self::words() as $w) {
            if (str_contains($n, $w)) {
                return false;
            }
        }

        return true;
    }
}
