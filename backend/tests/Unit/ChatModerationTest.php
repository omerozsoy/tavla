<?php

namespace Tests\Unit;

use App\Models\User;
use App\Support\ChatModeration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatModerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_filter_masks_profanity_and_keeps_clean_words(): void
    {
        [$clean, $hit] = ChatModeration::filter('iyi oyundu dostum');
        $this->assertFalse($hit);
        $this->assertSame('iyi oyundu dostum', $clean);

        // Küfür (varsayılan liste) -> token **** olur, temiz kelimeler kalır.
        [$masked, $hit2] = ChatModeration::filter('seni amk dostum');
        $this->assertTrue($hit2);
        $this->assertSame('seni **** dostum', $masked);

        // Kaçış (leet/nokta) da yakalanır.
        [$masked2, $hit3] = ChatModeration::filter('a.m.k');
        $this->assertTrue($hit3);
        $this->assertSame('****', $masked2);
    }

    public function test_penalize_warns_first_then_escalates_24h_1w_1mo_1y(): void
    {
        $u = User::factory()->create();

        // 1. ihlal = YALNIZ UYARI (yasak yok); 2=24s, 3=1h, 4=1ay, 5+=1yıl.
        $expectMin = [0, 1440, 10080, 43200, 525600, 525600];
        $expectLabel = ['warn', '24h', '1w', '1mo', '1y', '1y'];

        foreach ($expectMin as $i => $m) {
            $before = now();
            $r = ChatModeration::penalize($u->fresh());
            $this->assertSame($i + 1, $r['level']);
            $this->assertSame($expectLabel[$i], $r['label']);
            if ($m === 0) {
                $this->assertTrue($r['warning_only']);
                $this->assertNull($r['until']); // ilk ihlal: yasak YOK
            } else {
                $this->assertFalse($r['warning_only']);
                $expUntil = $before->copy()->addMinutes($m)->getTimestamp();
                $this->assertEqualsWithDelta($expUntil, strtotime($r['until']), 60);
            }
        }

        // İlk ihlalden sonra (yalnız uyarı) kullanıcı yasaklı DEĞİL; ikinciden sonra yasaklı.
        $fresh = User::factory()->create();
        ChatModeration::penalize($fresh->fresh());
        $this->assertNull(ChatModeration::mutedSeconds($fresh->fresh())); // 1. ihlal: yasak yok
        ChatModeration::penalize($fresh->fresh());
        $this->assertNotNull(ChatModeration::mutedSeconds($fresh->fresh())); // 2. ihlal: 24s yasak
    }
}
