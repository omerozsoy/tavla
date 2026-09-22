<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * İletişim / turnuva organizasyonu talep formu ucu (POST /api/contact). Footer "İletişim"
 * + turnuva organizasyonu landing'lerinden gonderilir; misafir de gonderebilir.
 */
class ContactMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_submit_contact_request(): void
    {
        $res = $this->postJson('/api/contact', [
            'name' => 'Ahmet Yılmaz',
            'org' => 'Örnek Belediyesi',
            'email' => 'ahmet@ornek.gov.tr',
            'subject' => 'belediye',
            'city' => 'İzmir',
            'event_date' => 'Kasım 2026',
            'participants' => 128,
            'message' => 'Festival için tavla turnuvası düzenlemek istiyoruz.',
            'source_page' => 'belediye-tavla-turnuvasi',
        ]);

        $res->assertCreated()->assertJson(['ok' => true]);

        $this->assertDatabaseHas('contact_messages', [
            'name' => 'Ahmet Yılmaz',
            'subject' => 'belediye',
            'participants' => 128,
            'source_page' => 'belediye-tavla-turnuvasi',
            'status' => 'new',
        ]);
    }

    public function test_name_and_message_are_required(): void
    {
        $this->postJson('/api/contact', ['email' => 'a@b.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'message']);
    }

    public function test_at_least_one_contact_channel_required(): void
    {
        // E-posta VE telefon yoksa 422 (geri donus kanali sart).
        $this->postJson('/api/contact', [
            'name' => 'Test Kullanıcı',
            'message' => 'Merhaba, bilgi almak istiyorum.',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertSame(0, ContactMessage::count());
    }

    public function test_phone_alone_is_sufficient(): void
    {
        $this->postJson('/api/contact', [
            'name' => 'Test Kullanıcı',
            'phone' => '05551112233',
            'message' => 'Kurumsal turnuva için arayabilir misiniz?',
            'subject' => 'kurumsal',
        ])->assertCreated();

        $this->assertSame(1, ContactMessage::count());
    }
}
