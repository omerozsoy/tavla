<?php

namespace Tests\Feature;

use App\Support\AvatarStore;
use Tests\TestCase;

class AvatarStoreTest extends TestCase
{
    public function test_passthrough_for_non_data_values(): void
    {
        $this->assertNull(AvatarStore::store(null));
        $this->assertNull(AvatarStore::store('   '));
        $this->assertSame('/uploads/avatars/x.webp', AvatarStore::store('/uploads/avatars/x.webp'));
        $this->assertSame('https://lh3.googleusercontent.com/a/x', AvatarStore::store('https://lh3.googleusercontent.com/a/x'));
        $this->assertSame('frame.gold', AvatarStore::store('frame.gold'));
    }

    public function test_base64_is_converted_to_small_webp_url(): void
    {
        if (! function_exists('imagewebp')) {
            $this->markTestSkipped('GD WebP yok');
        }
        // 300×300 test görseli -> büyük base64 data URI
        $im = imagecreatetruecolor(300, 300);
        imagefilledrectangle($im, 0, 0, 300, 300, imagecolorallocate($im, 10, 120, 200));
        ob_start();
        imagejpeg($im, null, 90);
        $jpeg = ob_get_clean();
        imagedestroy($im);
        $dataUri = 'data:image/jpeg;base64,'.base64_encode($jpeg);

        $url = AvatarStore::store($dataUri);

        $this->assertMatchesRegularExpression('#^/uploads/avatars/[0-9a-f]{40}\.webp$#', $url);
        $file = public_path(ltrim($url, '/'));
        $this->assertFileExists($file);
        // 128×128 WebP, kaynaktan (ve 68KB tavandan) küçük olmalı
        $this->assertLessThan(strlen($jpeg), filesize($file));
        $this->assertLessThan(15000, filesize($file));
        [$w, $h] = getimagesize($file);
        $this->assertSame(128, $w);
        $this->assertSame(128, $h);

        // İdempotent: URL tekrar verilince aynen döner (yeniden yazmaz)
        $this->assertSame($url, AvatarStore::store($url));

        @unlink($file);
    }
}
