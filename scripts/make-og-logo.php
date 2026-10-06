<?php
// Site logosunu (krem zeminli PNG) 1200x630 OG görseline çevir: krem (#F4EFE6) tuval,
// logo en-boy korunarak ortalanır (contain, ~%86 genişlik -> kenar boşluğu). JPEG q86.
// Logonun kendi zemini de krem olduğundan dikey bantlar dikişsiz birleşir.
// Kullanım: php scripts/make-og-logo.php <src.png> <out1.jpg> [out2.jpg ...]

if (! function_exists('imagecreatefrompng')) {
    fwrite(STDERR, "GD yok\n");
    exit(1);
}

$src = $argv[1] ?? '';
$outs = array_slice($argv, 2);
if (! is_file($src) || ! $outs) {
    fwrite(STDERR, "kullanim: php make-og-logo.php <src.png> <out.jpg> [...]\n");
    exit(1);
}

$info = getimagesize($src);
if ($info === false) {
    fwrite(STDERR, "kaynak okunamadi: $src\n");
    exit(1);
}
echo "kaynak: {$info[0]}x{$info[1]} {$info['mime']}\n";

$logo = imagecreatefrompng($src);
if (! $logo) {
    fwrite(STDERR, "png yuklenemedi\n");
    exit(1);
}
$lw = imagesx($logo);
$lh = imagesy($logo);

$TW = 1200;
$TH = 630;
$canvas = imagecreatetruecolor($TW, $TH);
// Krem zemin #F4EFE6
$cream = imagecolorallocate($canvas, 0xF4, 0xEF, 0xE6);
imagefilledrectangle($canvas, 0, 0, $TW, $TH, $cream);

// contain: tuvalin %86'sına sığdır (kenar boşluğu), en-boy koru
$maxW = (int) round($TW * 0.86);
$maxH = (int) round($TH * 0.86);
$scale = min($maxW / $lw, $maxH / $lh);
$dw = max(1, (int) round($lw * $scale));
$dh = max(1, (int) round($lh * $scale));
$dx = (int) round(($TW - $dw) / 2);
$dy = (int) round(($TH - $dh) / 2);

imagecopyresampled($canvas, $logo, $dx, $dy, 0, 0, $dw, $dh, $lw, $lh);
imagedestroy($logo);

foreach ($outs as $out) {
    @mkdir(dirname($out), 0755, true);
    if (! imagejpeg($canvas, $out, 86)) {
        fwrite(STDERR, "yazilamadi: $out\n");
        exit(1);
    }
    clearstatcache();
    echo "yazildi: $out (" . filesize($out) . "B)\n";
}
imagedestroy($canvas);
echo "TAMAM\n";
