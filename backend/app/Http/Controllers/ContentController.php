<?php

namespace App\Http\Controllers;

use App\Models\Content;
use Illuminate\Http\Request;

class ContentController extends Controller
{
    private const TYPES = ['service', 'blog', 'news', 'event', 'club', 'ad', 'quiz', 'magazine', 'kurum', 'otel'];

    // Herkese acik: bir turun yayinlanmis icerikleri (uygun siralamayla)
    public function index(Request $request)
    {
        $type = (string) $request->query('type', '');
        if (! in_array($type, self::TYPES, true)) {
            return $this->fail('Geçersiz tür.', 422);
        }

        $q = Content::where('type', $type)->where('published', true);
        // Siralama: etkinlik -> tarihe gore; blog/haber -> en yeni; kulup -> il; hizmet -> sort
        if ($type === 'event') {
            $q->orderBy('event_at');
        } elseif ($type === 'blog' || $type === 'news') {
            $q->orderByDesc('event_at')->orderByDesc('created_at');
        } elseif ($type === 'magazine') {
            $q->orderBy('sort')->orderBy('id'); // seri + playlist sirasi
        } elseif ($type === 'club') {
            $q->orderBy('province')->orderBy('title');
        } elseif ($type === 'ad') {
            $q->orderBy('sort')->orderBy('id');
        } else {
            $q->orderBy('sort')->orderBy('id');
        }

        return response()->json(['items' => $q->limit(500)->get()]);
    }

    // Yonetici: tur fark etmeksizin tum kayitlar (yayinsizlar dahil)
    public function adminIndex(Request $request)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yetkisiz.', 403);
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
            return $this->fail('Yetkisiz.', 403);
        }
        $data = $this->validated($request);
        $c = Content::create($data);
        return response()->json(['item' => $c]);
    }

    public function update(Request $request, Content $content)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yetkisiz.', 403);
        }
        $data = $this->validated($request);
        $content->update($data);
        return response()->json(['item' => $content->fresh()]);
    }

    public function destroy(Request $request, Content $content)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yetkisiz.', 403);
        }
        $content->delete();
        return $this->ok();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'type' => ['required', 'string', 'in:'.implode(',', self::TYPES)],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:20000'],
            'organizer' => ['nullable', 'string', 'max:200'],
            'place' => ['nullable', 'string', 'max:300'],
            'hotel' => ['nullable', 'string', 'max:200'],
            'province' => ['nullable', 'string', 'max:60'],
            'country' => ['nullable', 'string', 'max:60'],
            'contact' => ['nullable', 'string', 'max:200'],
            'links' => ['nullable', 'array'],
            'links.instagram' => ['nullable', 'string', 'max:300'],
            'links.youtube' => ['nullable', 'string', 'max:300'],
            'links.website' => ['nullable', 'string', 'max:300'],
            'links.maps' => ['nullable', 'string', 'max:500'],
            'image' => ['nullable', 'string', 'max:500'],
            'event_at' => ['nullable', 'date'],
            'event_end' => ['nullable', 'date'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'published' => ['nullable', 'boolean'],
        ]);
    }
}
