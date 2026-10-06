<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Makale/haber KAPAK görsellerini JPEG'e çevir (sayfa + paylaşım ağırlık düşürme).
 *
 * SORUN: Admin yüklemeleri optimize EDİLMEDEN saklanıyordu -> kapaklar ~2-2.6 MB PNG.
 * Sayfalar ağır açılıyor; WhatsApp ~600 KB üstü og:image'ı göstermiyordu (bkz SeoMeta::ogVariant).
 *
 * BU MIGRATION: content.image'ı .png olan makale/haber satırları için, kapak dosyasını
 * 1280px genişliğe küçültülmüş JPEG'e çevirir (q82, ~150 KB), referansı .jpg'e günceller
 * ve eski .png'yi siler. DOSYA-FARKINDA ve GÜVENLİ: yalnızca .jpg gerçekten oluştuğunda
 * referansı değiştirir -> kırık görsel oluşmaz. Repo'daki makale kapakları zaten .jpg olarak
 * commit'li (bu migration prod DB referanslarını + prod-only admin yüklemelerini kapsar).
 * GD yoksa no-op. Tek yönlü (down: no-op; eski PNG geri gelmez).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) {
            return; // GD yok -> dokunma
        }

        $rows = DB::table('content')
            ->whereIn('type', ['makale', 'news'])
            ->where('image', 'like', '%.png')
            ->get(['id', 'image']);

        foreach ($rows as $row) {
            try {
                $rel = ltrim((string) $row->image, '/'); // uploads/makale/x.png
                $srcAbs = public_path($rel);
                $jpgRel = preg_replace('/\.png$/i', '.jpg', $rel);
                $jpgAbs = public_path($jpgRel);

                // .jpg henüz yoksa png'den üret (prod admin yüklemeleri); repo kapakları zaten .jpg.
                if (! is_file($jpgAbs)) {
                    if (! is_file($srcAbs) || ! $this->toJpeg($srcAbs, $jpgAbs, 1280, 82)) {
                        continue; // kaynak yok / üretilemedi -> referansa DOKUNMA
                    }
                }

                DB::table('content')->where('id', $row->id)->update(['image' => '/' . $jpgRel]);

                if (is_file($srcAbs)) {
                    @unlink($srcAbs); // eski ağır png (ref artık jpg)
                }
            } catch (\Throwable $e) {
                // tek satır patlasa migration durmasın
                continue;
            }
        }
    }

    public function down(): void
    {
        // Tek yönlü: küçültülmüş JPEG'ler kalır (eski PNG geri yüklenmez).
    }

    private function toJpeg(string $srcAbs, string $jpgAbs, int $maxW, int $quality): bool
    {
        $data = @file_get_contents($srcAbs);
        if ($data === false) {
            return false;
        }
        $src = @imagecreatefromstring($data);
        if (! $src) {
            return false;
        }
        $w = imagesx($src);
        $h = imagesy($src);
        if ($w > $maxW) {
            $nh = max(1, (int) round($h * $maxW / $w));
            $d = imagecreatetruecolor($maxW, $nh);
            imagecopyresampled($d, $src, 0, 0, 0, 0, $maxW, $nh, $w, $h);
            imagedestroy($src);
            $src = $d;
            $w = $maxW;
            $h = $nh;
        }
        // JPEG alfa desteklemez -> beyaz zemine düzleştir.
        $dst = imagecreatetruecolor($w, $h);
        $white = imagecolorallocate($dst, 255, 255, 255);
        imagefilledrectangle($dst, 0, 0, $w, $h, $white);
        imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);
        @mkdir(dirname($jpgAbs), 0755, true);
        $ok = imagejpeg($dst, $jpgAbs, $quality);
        imagedestroy($src);
        imagedestroy($dst);

        return (bool) $ok;
    }
};
