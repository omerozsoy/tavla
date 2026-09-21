<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * tavla:purge-test-accounts — throwaway test hesaplarini guvenli sil.
 * Kapsam: desen-guvenligi, admin-korumasi, dry-run kapisi, gercek silme.
 */
class PurgeTestAccountsTest extends TestCase
{
    use RefreshDatabase;

    private function mk(string $email, bool $admin = false): User
    {
        $u = User::factory()->create(['email' => $email]);
        // is_admin fillable degil -> dogrudan ata.
        $u->is_admin = $admin;
        $u->save();

        return $u;
    }

    public function test_dry_run_deletes_nothing(): void
    {
        $u = $this->mk('prtest_dry@example.com');
        $this->artisan('tavla:purge-test-accounts', ['--email' => 'prtest_%@example.com'])
            ->assertExitCode(0);
        $this->assertDatabaseHas('users', ['id' => $u->id]);
    }

    public function test_force_deletes_matching_but_spares_admin_and_others(): void
    {
        $victim = $this->mk('prtest_a@example.com');
        $admin = $this->mk('prtest_admin@example.com', admin: true); // desene uyar AMA admin -> korunur
        $bystander = $this->mk('real_user@example.com');             // desene uymaz -> korunur

        $this->artisan('tavla:purge-test-accounts', ['--email' => 'prtest_%@example.com', '--force' => true])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('users', ['id' => $victim->id]);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
        $this->assertDatabaseHas('users', ['id' => $bystander->id]);
    }

    public function test_rejects_too_general_pattern(): void
    {
        $u = $this->mk('prtest_safe@example.com');
        $this->artisan('tavla:purge-test-accounts', ['--email' => '%', '--force' => true])
            ->assertExitCode(1);
        $this->assertDatabaseHas('users', ['id' => $u->id]); // hicbir sey silinmedi
    }
}
