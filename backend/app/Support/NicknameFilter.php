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

    /** Ham listeyi iki kumeye ayirir:
     *   - 'sub':   substring aranan kokler (>=3 harf; 2-harf kokler mk/aq/oc scunthorpe tuzagi)
     *   - 'whole': '=' onekli TAM-KELIME kokler (normalize edilmis token'a BIREBIR esit olmali)
     * '=got'/'=pic' -> "got"/"piç" tek basina engellenir ama "ergot"/"kapıcı" serbest kalir.
     * @return array{sub:string[],whole:string[]}
     */
    private static function roots(): array
    {
        $sub = [];
        $whole = [];
        foreach (preg_split('/[\r\n,]+/', self::rawList()) ?: [] as $p) {
            $p = trim($p);
            if ($p === '') {
                continue;
            }
            if ($p[0] === '=') { // tam-kelime kok
                $w = self::normalize(substr($p, 1));
                if ($w !== '') {
                    $whole[] = $w;
                }

                continue;
            }
            $w = self::normalize($p);
            if (strlen($w) >= 3) { // kisa kokler icin tam-kelime istiyorsan '=' kullan
                $sub[] = $w;
            }
        }

        return ['sub' => array_values(array_unique($sub)), 'whole' => array_values(array_unique($whole))];
    }

    /** @return string[] substring aranan yasakli kokler (geriye donuk uyumluluk) */
    public static function words(): array
    {
        return self::roots()['sub'];
    }

    /** @return string[] tam-kelime ('=' onekli) yasakli kokler */
    public static function wholeWords(): array
    {
        return self::roots()['whole'];
    }

    /** $normalized bir yasakli koke takiliyor mu? (substring VEYA tam-kelime birebir) */
    public static function hits(string $normalized): bool
    {
        if ($normalized === '') {
            return false;
        }
        $r = self::roots();
        foreach ($r['sub'] as $w) {
            if (str_contains($normalized, $w)) {
                return true;
            }
        }

        return in_array($normalized, $r['whole'], true);
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

        return ! self::hits($n);
    }
}
