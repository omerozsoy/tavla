<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\ContentComment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * Haber yorumlari. Public: bir haberin ONAYLI yorumlarini listeler. Kayitli kullanici:
 * yorum birakir (ONAY BEKLER -> pending). Yorumlar yalniz haber (type='news') altinadir.
 */
class ContentCommentController extends Controller
{
    // Herkese acik: bir haberin onaylanmis yorumlari (en yeni once).
    public function index(Content $content)
    {
        // Yorumlar OPSIYONEL bir ozelliktir: migration (content_comments) canlida henuz
        // uygulanmadiysa haber sayfasini 500 ile KIRMA -> bos liste don. Tablo geldiginde
        // (migrate --force) endpoint kendiliginden calismaya devam eder.
        if (! Schema::hasTable('content_comments')) {
            return response()->json(['comments' => []]);
        }

        $comments = ContentComment::where('content_id', $content->id)
            ->where('status', 'approved')
            ->with('user:id,nickname,first_name,avatar,avatar_frame')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (ContentComment $c) => [
                'id' => $c->id,
                'body' => $c->body,
                'author' => $c->authorName(),
                'avatar' => $c->user?->avatar,
                'frame' => $c->user?->avatar_frame,
                'created_at' => $c->created_at,
            ]);

        return response()->json(['comments' => $comments]);
    }

    // Kayitli kullanici (auth:sanctum): yorum birak -> onay bekler. Yalniz haber altina.
    public function store(Request $request, Content $content)
    {
        if ($content->type !== 'news' || ! $content->published) {
            return $this->fail('Bu içeriğe yorum yapılamaz.', 422);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:2000'],
        ]);

        $comment = ContentComment::create([
            'content_id' => $content->id,
            'user_id' => $request->user()->id,
            'body' => trim($data['body']),
            'status' => 'pending',
        ]);

        // pending -> public listede HENUZ gorunmez; istemci "onay bekliyor" bilgilendirmesi gosterir.
        return response()->json(['status' => 'pending', 'id' => $comment->id]);
    }
}
