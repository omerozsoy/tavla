<?php

namespace Tests\Feature;

use App\Filament\Resources\MutedUserResource\Pages\ListMutedUsers;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/**
 * Yasaklılar (/admin/yasaklilar) arşivi: yasağı bitmiş (süresi dolmuş + ihlal geçmişli) kullanıcılar
 * "Yasağı Bitenleri Arşivle" ile listede gizlenir AMA ihlal geçmişi (chat_offenses) KORUNUR.
 * Aktif yasaklılar etkilenmez.
 */
class MutedUserArchiveTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->forceFill(['is_admin' => true])->save();

        return $u->fresh();
    }

    public function test_archive_expired_hides_expired_keeps_active(): void
    {
        // Yasağı bitmiş (süresi dolmuş) + ihlal geçmişli -> arşivlenecek.
        $expired = User::factory()->create(['nickname' => 'expired']);
        $expired->forceFill(['chat_offenses' => 2, 'chat_muted_until' => now()->subDay()])->save();

        // Aktif yasaklı -> arşivlenMEMELİ.
        $active = User::factory()->create(['nickname' => 'active']);
        $active->forceFill(['chat_offenses' => 1, 'chat_muted_until' => now()->addDay()])->save();

        Livewire::actingAs($this->admin())->test(ListMutedUsers::class)
            ->callTableAction('archiveExpired');

        $this->assertNotNull($expired->fresh()->chat_mute_archived_at, 'yasağı biten arşivlenmeli');
        $this->assertNull($active->fresh()->chat_mute_archived_at, 'aktif yasaklı arşivlenmemeli');
        // İhlal geçmişi KORUNUR (sıfırlanmaz).
        $this->assertSame(2, (int) $expired->fresh()->chat_offenses);

        // Varsayılan liste (getEloquentQuery + hideArchived filtresi): arşivlenen GÖRÜNMEZ, aktif GÖRÜNÜR.
        $visible = User::query()
            ->where(fn ($q) => $q->where('chat_offenses', '>', 0)->orWhere('chat_muted_until', '>', now()))
            ->whereNull('chat_mute_archived_at')
            ->pluck('nickname');
        $this->assertNotContains('expired', $visible, 'arşivlenen listede görünmemeli');
        $this->assertContains('active', $visible, 'aktif yasaklı listede görünmeli');
    }

    public function test_active_ban_can_be_archived_and_is_hidden(): void
    {
        // Aktif yasaklı da arşivlenebilmeli; arşivlenince varsayılan listede (hideArchived) GİZLENİR.
        $u = User::factory()->create(['nickname' => 'activearchive']);
        $u->forceFill(['chat_offenses' => 1, 'chat_muted_until' => now()->addDay()])->save();

        Livewire::actingAs($this->admin())->test(ListMutedUsers::class)
            ->callTableAction('archive', $u);
        $this->assertNotNull($u->fresh()->chat_mute_archived_at, 'aktif yasak arşivlenebilmeli');
        // Yasak hâlâ yürürlükte (arşiv yalnız gizler).
        $this->assertTrue($u->fresh()->chat_muted_until->isFuture(), 'arşiv yasağı kaldırmamalı');

        // hideArchived filtresi: arşivlenen aktif yasak da gizlenmeli.
        $visible = User::query()->whereNull('chat_mute_archived_at')->pluck('nickname');
        $this->assertNotContains('activearchive', $visible, 'arşivlenen aktif yasak varsayılan listede görünmemeli');
    }

    public function test_per_row_archive(): void
    {
        $u = User::factory()->create(['nickname' => 'solo']);
        $u->forceFill(['chat_offenses' => 1, 'chat_muted_until' => now()->subDay()])->save();

        Livewire::actingAs($this->admin())->test(ListMutedUsers::class)
            ->callTableAction('archive', $u);
        $this->assertNotNull($u->fresh()->chat_mute_archived_at);
    }

    public function test_unarchive_restores(): void
    {
        // Arşivli kayıt varsayılan listede GİZLİ -> önce "Yalnız arşivlenenler" filtresini aç, sonra geri al.
        $u = User::factory()->create(['nickname' => 'back']);
        $u->forceFill([
            'chat_offenses' => 1,
            'chat_muted_until' => now()->addDay(),
            'chat_mute_archived_at' => now(),
        ])->save();

        Livewire::actingAs($this->admin())->test(ListMutedUsers::class)
            ->filterTable('archived', false) // yalnız arşivlenenler
            ->callTableAction('unarchive', $u);
        $this->assertNull($u->fresh()->chat_mute_archived_at);
    }
}
