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

    // Oyunu kaydet (sunucuda, yarim kalmasin)
    public function save(Request $request)
    {
        $user = $request->user();
        $user->game_state = $request->input('game'); // JSON oyun durumu
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
