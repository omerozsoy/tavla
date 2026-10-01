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

    public function test_penalize_escalates_24h_1w_1mo_1y(): void
    {
        $u = User::factory()->create();

        $mins = ChatModeration::BAN_MINUTES; // [1440, 10080, 43200, 525600]
        $expect = [$mins[0], $mins[1], $mins[2], $mins[3], $mins[3]]; // 5. ihlal hâlâ 1 yıl

        foreach ($expect as $i => $m) {
            $before = now();
            $r = ChatModeration::penalize($u->fresh());
            $this->assertSame($i + 1, $r['level']);
            $this->assertSame(['24h', '1w', '1mo', '1y', '1y'][$i], $r['label']);
            // Yasak bitişi ~ now + dakika (±60sn tolerans).
            $expUntil = $before->copy()->addMinutes($m)->getTimestamp();
            $this->assertEqualsWithDelta($expUntil, strtotime($r['until']), 60);
        }

        // Yasak aktifken mutedSeconds pozitif döner.
        $this->assertNotNull(ChatModeration::mutedSeconds($u->fresh()));
    }
}
