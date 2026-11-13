<?php

namespace App\Http\Controllers;

use App\Models\Tournament;
use App\Models\TournamentAccess;
use Illuminate\Http\Request;

/**
 * CANLI TURNUVA SİSTEMİ (dernek/grup paneli): /canli-turnuva-sistemi sayfasının şifreli alanı.
 * - login: admin'in tanımladığı (isim+şifre) erişimle şifreyi doğrular -> formu açar.
 * - create: şifreyi TEKRAR doğrular (istemciye güvenilmez) + turnuvayı kurar.
 * Şifre gizlilik gerektirmeyen paylaşılan grup şifresidir (join_password gibi düz metin).
 */
class LiveTournamentController extends Controller
{
    /** Şifre doğru mu? Doğruysa grup adını döndür (formu aç). */
    public function login(Request $request)
    {
        $data = $request->validate(['password' => ['required', 'string', 'max:60']]);
        $access = TournamentAccess::match($data['password']);
        if (! $access) {
            return $this->fail('Şifre hatalı veya giriş kapalı.', 401);
        }

        return response()->json(['ok' => true, 'name' => $access->name]);
    }

    /** Şifreyi doğrula + turnuvayı kur (grup adına). */
    public function create(Request $request)
    {
        $access = TournamentAccess::match($request->input('password'));
        if (! $access) {
            return $this->fail('Şifre hatalı veya giriş kapalı.', 401);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'type' => ['nullable', 'string', 'in:'.implode(',', array_keys(Tournament::TYPES))],
            'size' => ['required', 'integer', 'in:0,4,8,16,32,64,128,256'], // 0 = sınırsız
            'match_length' => ['nullable', 'integer', 'in:'.implode(',', Tournament::LENGTHS)],
            'swiss_lives' => ['nullable', 'integer', 'in:1,2,3'], // Swiss hak sayısı (bracket yok sayar)
            'swiss_auto_draw' => ['nullable', 'boolean'], // Swiss bye/kura: false=elle, true=otomatik
            'register_until' => ['required', 'date'], // başlangıç ZORUNLU (turnuva o saatte başlar)
            'join_password' => ['nullable', 'string', 'max:60'], // boş = halka açık
        ]);

        $type = $data['type'] ?? 'bracket';
        if ($type === 'swiss_triple' && ! config('tournament.swiss.enabled', true)) {
            return $this->fail('3 Haklı Swiss şu an kapalı.', 422);
        }

        $t = Tournament::create([
            'name' => $data['name'],
            'type' => $type,
            'size' => $data['size'],
            'status' => 'open',
            'register_until' => $data['register_until'] ?? null,
            'creator_id' => null,            // grup kurdu (kullanıcı değil)
            'venue' => $access->name,        // "Düzenleyen": dernek/grup adı
            'join_password' => ($data['join_password'] ?? '') !== '' ? $data['join_password'] : null,
            'premium_only' => false,         // dernek turnuvası: tüm üyeler katılabilir
            'match_length' => $data['match_length'] ?? 1,
            'swiss_lives' => $type === 'swiss_triple' ? ($data['swiss_lives'] ?? 3) : 3,
            'swiss_auto_draw' => $type === 'swiss_triple' ? (bool) ($data['swiss_auto_draw'] ?? false) : false,
            'players' => [],
        ]);

        $access->increment('created_count');
        $access->update(['last_used_at' => now()]);

        return response()->json(['ok' => true, 'id' => $t->id, 'name' => $t->name]);
    }
}
