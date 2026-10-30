<?php

namespace Tests\Feature;

use App\Filament\Resources\UserResource;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

// "Küfür şüphesi" filtresinin çekirdeği: flaggedNicknameIds() takma adı NicknameFilter'a
// takılan AKTİF üyeleri döndürür. Leetspeak/TR-kaçış (4mk->amk) yakalanmalı, temiz ad
// GİRMEMELİ, silinmiş/anonimleştirilmiş hesap HARİÇ.
class UserResourceProfanityFilterTest extends TestCase
{
    use RefreshDatabase;

    private function mk(string $nick, array $force = []): User
    {
        $u = User::create([
            'nickname' => $nick, 'email' => $nick.'@e.com', 'password' => bcrypt('secret123'),
            'first_name' => 'X', 'last_name' => 'Y', 'country' => 'TR',
        ]);
        if ($force) {
            $u->forceFill($force)->save(); // ban_reason mass-assignable değil -> forceFill
        }

        return $u;
    }

    public function test_flags_only_profane_active_nicks(): void
    {
        Cache::flush(); // flaggedNicknameIds 60sn cache'li -> taze hesapla
        $bad = $this->mk('4mk_player');                               // leetspeak -> amk
        $clean = $this->mk('kibar_oyuncu');                           // temiz
        $deleted = $this->mk('siktir99', ['ban_reason' => 'account_deleted']); // küfür AMA silinmiş

        $ids = UserResource::flaggedNicknameIds();

        $this->assertContains($bad->id, $ids);
        $this->assertNotContains($clean->id, $ids);
        $this->assertNotContains($deleted->id, $ids);
    }
}
