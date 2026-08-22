<?php

namespace App\Http\Controllers;

use App\Models\Content;
use Illuminate\Http\Request;

class ContentController extends Controller
{
    private const TYPES = ['service', 'blog', 'news', 'event', 'club'];

    // Herkese acik: bir turun yayinlanmis icerikleri (uygun siralamayla)
    public function index(Request $request)
    {
        $type = (string) $request->query('type', '');
        if (! in_array($type, self::TYPES, true)) {
            return response()->json(['message' => 'Geçersiz tür.'], 422);
        }

        $q = Content::where('type', $type)->where('published', true);
        // Siralama: etkinlik -> tarihe gore; blog/haber -> en yeni; kulup -> il; hizmet -> sort
        if ($type === 'event') {
            $q->orderBy('event_at');
        } elseif ($type === 'blog' || $type === 'news') {
            $q->orderByDesc('event_at')->orderByDesc('created_at');
        } elseif ($type === 'club') {
            $q->orderBy('province')->orderBy('title');
        } else {
            $q->orderBy('sort')->orderBy('id');
        }

        return response()->json(['items' => $q->limit(500)->get()]);
    }

    // Yonetici: tur fark etmeksizin tum kayitlar (yayinsizlar dahil)
    public function adminIndex(Request $request)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }
        $type = (string) $request->query('type', '');
        $q = Content::query();
        if (in_array($type, self::TYPES, true)) {
            $q->where('type', $type);
        }
        return response()->json(['items' => $q->orderByDesc('id')->limit(1000)->get()]);
    }

    public function store(Request $request)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }
        $data = $this->validated($request);
        $c = Content::create($data);
        return response()->json(['item' => $c]);
    }

    public function update(Request $request, Content $content)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }
        $data = $this->validated($request);
        $content->update($data);
        return response()->json(['item' => $content->fresh()]);
    }

    public function destroy(Request $request, Content $content)
    {
        if (! $request->user()?->is_admin) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }
        $content->delete();
        return response()->json(['ok' => true]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'type' => ['required', 'string', 'in:'.implode(',', self::TYPES)],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:20000'],
            'organizer' => ['nullable', 'string', 'max:200'],
            'place' => ['nullable', 'string', 'max:300'],
            'province' => ['nullable', 'string', 'max:60'],
            'contact' => ['nullable', 'string', 'max:200'],
            'image' => ['nullable', 'string', 'max:500'],
            'event_at' => ['nullable', 'date'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'published' => ['nullable', 'boolean'],
        ]);
    }
}
