<?php

namespace Tests\Feature;

use App\Models\Content;
use App\Models\ContentComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Haber yorumlari: kayitli kullanici yorum birakir -> ONAY BEKLER (pending); yalniz onayli
// yorumlar public listede gorunur; misafir yorum yapamaz; yalniz haber (news) altina. (Kullanici direktifi.)
class ContentCommentTest extends TestCase
{
    use RefreshDatabase;

    private function news(): Content
    {
        return Content::create(['type' => 'news', 'title' => 'Haber', 'body' => 'x', 'sort' => 0, 'published' => true]);
    }

    public function test_guest_cannot_comment(): void
    {
        $n = $this->news();
        $this->postJson("/api/contents/{$n->id}/comments", ['body' => 'Merhaba dünya'])
            ->assertUnauthorized();
        $this->assertDatabaseCount('content_comments', 0);
    }

    public function test_registered_user_comment_is_pending(): void
    {
        $n = $this->news();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/contents/{$n->id}/comments", ['body' => 'Güzel haber'])
            ->assertOk()
            ->assertJson(['status' => 'pending']);

        $this->assertDatabaseHas('content_comments', [
            'content_id' => $n->id,
            'body' => 'Güzel haber',
            'status' => 'pending',
        ]);
    }

    public function test_pending_comment_not_in_public_list(): void
    {
        $n = $this->news();
        $u = User::factory()->create();
        ContentComment::create(['content_id' => $n->id, 'user_id' => $u->id, 'body' => 'bekleyen', 'status' => 'pending']);

        $this->getJson("/api/contents/{$n->id}/comments")
            ->assertOk()
            ->assertJsonCount(0, 'comments');
    }

    public function test_approved_comment_visible_publicly(): void
    {
        $n = $this->news();
        $u = User::factory()->create(['nickname' => 'Ahmet']);
        ContentComment::create(['content_id' => $n->id, 'user_id' => $u->id, 'body' => 'onayli', 'status' => 'approved']);

        $this->getJson("/api/contents/{$n->id}/comments")
            ->assertOk()
            ->assertJsonCount(1, 'comments')
            ->assertJsonPath('comments.0.body', 'onayli')
            ->assertJsonPath('comments.0.author', 'Ahmet');
    }

    public function test_cannot_comment_on_non_news(): void
    {
        $makale = Content::create(['type' => 'makale', 'title' => 'Makale', 'body' => 'x', 'sort' => 0, 'published' => true]);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/contents/{$makale->id}/comments", ['body' => 'yorum'])
            ->assertStatus(422);
        $this->assertDatabaseCount('content_comments', 0);
    }

    public function test_empty_body_rejected(): void
    {
        $n = $this->news();
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/contents/{$n->id}/comments", ['body' => ' '])
            ->assertStatus(422);
    }
}
