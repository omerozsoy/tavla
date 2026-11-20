<?php

namespace App\Http\Controllers;

use App\Models\QuizScore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Soru Maratonu skor tabelası. Giriş GEREKMEZ; giriş yapmışsa hesabın takma adı yazılır.
 * - submit: takma-ad + skor doğrula (tip/aralık), kaydet, tabeladaki sırayı döndür.
 * - leaderboard: score DESC, 30sn cache (poll filesort'u önler).
 * Puan istemciden gelir (spoof mümkün) — kasual tabela; sunucu yalnız tip/aralık doğrular + throttle (route).
 */
class QuizScoreController extends Controller
{
    public function submit(Request $request)
    {
        $data = $request->validate([
            'nickname' => 'nullable|string|max:40',
            'score' => 'required|integer|min:1|max:100000', // 0 puan tabelaya yazilmaz (bos/test kayitlari)
            'correct_count' => 'required|integer|min:0|max:100000',
            'mode' => 'nullable|in:checker,cube', // iki ayrı yarışma: pul (checker) / küp (cube)
        ]);
        $mode = $data['mode'] ?? 'checker';

        // Giriş yapmışsa hesabın takma adı (istemcinin gönderdiği yok sayılır); misafir kendi yazar.
        $user = $request->user('sanctum');
        $nick = trim(strip_tags((string) ($user ? ($user->nickname ?: $user->first_name) : ($data['nickname'] ?? ''))));
        $nick = $nick === '' ? 'Oyuncu' : mb_substr($nick, 0, 20);

        QuizScore::create([
            'nickname' => $nick,
            'score' => $data['score'],
            'correct_count' => $data['correct_count'],
            'ip_hash' => hash('sha256', (string) $request->ip()),
            'mode' => $mode,
        ]);

        $rank = QuizScore::where('mode', $mode)->where('score', '>', $data['score'])->count() + 1;

        return response()->json(['ok' => true, 'rank' => $rank], 201);
    }

    public function leaderboard(Request $request)
    {
        $limit = min(100, max(1, (int) $request->query('limit', 20)));
        $mode = $request->query('mode') === 'cube' ? 'cube' : 'checker';

        $rows = Cache::remember("quiz_lb:{$mode}:{$limit}", 30, function () use ($limit, $mode) {
            // Her takma-ad tabelada YALNIZ bir kez: en yüksek skoruyla. score DESC sırada
            // ilerleyip bir ad'ı ilk görüşte sabitle (o satır = o adın en yüksek rekoru).
            // ponytail: sabit 500'lük tarama; anonim havuz bunu aşarsa cap'i yükselt.
            $best = [];
            QuizScore::where('mode', $mode)->orderByDesc('score')->orderBy('created_at')
                ->limit(500)
                ->get(['nickname', 'score', 'correct_count'])
                ->each(function ($r) use (&$best) {
                    $best[$r->nickname] ??= $r;
                });

            return collect(array_values($best))
                ->take($limit)
                ->map(fn ($r, $i) => [
                    'rank' => $i + 1,
                    'nickname' => $r->nickname,
                    'score' => (int) $r->score,
                    'correct_count' => (int) $r->correct_count,
                ]);
        });

        return response()->json(['players' => $rows]);
    }
}
