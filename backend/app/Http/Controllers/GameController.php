<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class GameController extends Controller
{
    // Kullanicinin kayitli oyununu getir
    public function show(Request $request)
    {
        return response()->json(['game' => $request->user()->game_state]);
    }

    // Oyunu kaydet (sunucuda, yarim kalmasin).
    // GUVENLIK: 'game' dogrulanmamis serbest input olamaz -> tip + boyut siniri
    // (devasa payload ile DB sisirme engellenir). Bos/null -> kaydi temizler.
    public function save(Request $request)
    {
        $data = $request->validate([
            'game' => ['nullable', 'array'],
        ]);
        // Kaba boyut tavani: serialize edilmis JSON ~256KB'i asmasin.
        if (! empty($data['game']) && strlen(json_encode($data['game'])) > 262144) {
            return response()->json(['message' => 'Oyun durumu çok büyük.'], 422);
        }
        $user = $request->user();
        $user->game_state = $data['game'] ?? null;
        $user->save();
        return response()->json(['ok' => true]);
    }

    // Kaydi sil
    public function clear(Request $request)
    {
        $user = $request->user();
        $user->game_state = null;
        $user->save();
        return response()->json(['ok' => true]);
    }
}
