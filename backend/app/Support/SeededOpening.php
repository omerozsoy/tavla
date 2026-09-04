<?php

namespace App\Support;

/**
 * Açılış zarının SUNUCU tarafı kopyası (para maçı güvenliği, BAĞIMSIZ Faz 1).
 *
 * Online oyunda her oyunun AÇILIŞ eli oda kodu + oyun no'dan DETERMINISTIK üretilir
 * (src/App.tsx `seededOpening`): iki istemci ekstra senkron olmadan aynı sonucu üretir.
 * Açılış eli serverRoll'dan GELMEZ; bu yüzden update() zar-eşleşmesinde açılışı tanıyıp
 * MUAF tutmak için sunucu aynı deterministik değeri yeniden hesaplar (byte-exact JS portu).
 *
 * FNV-1a benzeri 32-bit karma + Math.imul; JS 32-bit tamsayı semantiği birebir taklit edilir.
 */
class SeededOpening
{
    /**
     * @return array{0:int,1:int} [white_die, black_die] — asla eşit değil (JS ile aynı kaydırma).
     */
    public static function dice(string $code, int $gameNo): array
    {
        $seed = $code.':'.$gameNo;
        $h = 2166136261; // FNV offset basis
        $len = strlen($seed);
        for ($i = 0; $i < $len; $i++) {
            $h = self::toInt32($h ^ ord($seed[$i]));
            $h = self::imul($h, 16777619); // FNV prime
        }
        $w = (self::abs32($h) % 6) + 1;
        $b = (self::abs32(self::sar32($h, 5)) % 6) + 1;
        if ($b === $w) {
            $b = ($b % 6) + 1; // eşitse kaydır (asla berabere olmaz)
        }

        return [$w, $b];
    }

    /** JS Math.imul(a,b): 32-bit imzalı çarpım. PHP 64-bit tamsayı çarpımı TAM -> düşük 32 bit. */
    private static function imul(int $a, int $b): int
    {
        $product = self::toInt32($a) * self::toInt32($b); // 32x32 -> 64-bit'te taşmaz (exact)

        return self::toInt32($product);
    }

    /** JS ToInt32: düşük 32 biti imzalı 32-bit'e sar. */
    private static function toInt32(int $x): int
    {
        $x &= 0xFFFFFFFF;
        if ($x >= 0x80000000) {
            $x -= 0x100000000;
        }

        return $x;
    }

    /** JS aritmetik sağ kaydırma (h >> n) — imzalı 32-bit. */
    private static function sar32(int $x, int $n): int
    {
        return self::toInt32(self::toInt32($x) >> $n);
    }

    /** JS Math.abs — imzalı 32-bit değerin mutlağı (INT_MIN -> 2^31, 64-bit'te sığar). */
    private static function abs32(int $x): int
    {
        $x = self::toInt32($x);

        return $x < 0 ? -$x : $x;
    }
}
