<?php

namespace Tests\Feature;

use App\Filament\Pages\AyniTelefon;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Aynı-telefon çoklu-hesap tespiti: biçim farkları (0543../+90543../543..) son 10 haneyle
// birleşmeli; account_deleted elenmeli; tek-numaralı hesap gruba girmemeli.
class AyniTelefonTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $phone, ?string $banReason = null): User
    {
        $u = User::factory()->create();
        $u->forceFill(['phone' => $phone, 'ban_reason' => $banReason])->save();

        return $u;
    }

    public function test_groups_same_phone_across_formats_and_excludes_noise(): void
    {
        $this->user('05432662050');        // A
        $this->user('+90 543 266 20 50');  // B — normalize: son10 = 5432662050 (A ile aynı)
        $this->user('05000000000');        // tek numara -> gruba girmez
        $this->user('05432662050', 'account_deleted'); // silinmiş -> elenir

        $page = new AyniTelefon;
        $stats = $page->stats();

        $this->assertSame(1, $stats['phones'], 'tek telefon grubu olmalı');
        $this->assertSame(2, $stats['accounts'], 'yalnız A+B (silinmiş ve tek-numara hariç)');
        $this->assertSame(2, $stats['maxPerPhone']);

        $rows = $page->rows();
        $this->assertCount(1, $rows);
        $this->assertSame(2, $rows[0]['count']);
    }

    public function test_no_false_group_for_short_or_empty_phones(): void
    {
        $this->user('');        // boş
        $this->user('123');     // çok kısa (<10 hane)
        $this->user('123');     // ikinci kısa -> yine de normalize=null, grup YOK

        $this->assertSame(0, (new AyniTelefon)->stats()['phones']);
    }
}
