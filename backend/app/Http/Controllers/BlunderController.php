<?php

namespace App\Http\Controllers;

use App\Models\Blunder;
use Illuminate\Http\Request;

class BlunderController extends Controller
{
    // Kullanicinin hata gunlugu: en kotu hamleler (loss'a gore)
    public function index(Request $request)
    {
        $rows = Blunder::where('user_id', $request->user()->id)
            ->orderByDesc('loss')
            ->limit(60)
            ->get(['loss', 'played', 'best', 'created_at']);

        return response()->json(['blunders' => $rows]);
    }

    // Mac sonunda en kotu hamleleri kaydet (istemci gonderir)
    public function store(Request $request)
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'max:10'],
            'items.*.loss' => ['required', 'numeric', 'min:0', 'max:10'],
            'items.*.played' => ['required', 'string', 'max:32'],
            'items.*.best' => ['required', 'string', 'max:32'],
        ]);

        $userId = $request->user()->id;
        foreach ($data['items'] as $it) {
            Blunder::create([
                'user_id' => $userId,
                'loss' => $it['loss'],
                'played' => $it['played'],
                'best' => $it['best'],
            ]);
        }

        // Gunluk sisme -> kullanici basi en kotu 200 kaydi tut
        $keepIds = Blunder::where('user_id', $userId)
            ->orderByDesc('loss')
            ->limit(200)
            ->pluck('id');
        Blunder::where('user_id', $userId)->whereNotIn('id', $keepIds)->delete();

        return response()->json(['ok' => true]);
    }
}
