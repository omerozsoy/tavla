<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Pozisyon Analizi "fotograftan diz": yuklenen tavla fotografini Anthropic (Claude)
 * vision modeline gonderir, pozisyonu points[24] + bar + off JSON'i olarak dondurur.
 *
 * Konvansiyon (frontend engine ile AYNI): points index i = hane (i+1).
 *   pozitif = ACIK renk taslar (white), negatif = KOYU renk taslar (black).
 */
class BoardVisionController extends Controller
{
    public function analyze(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'max:8192'], // <= 8MB
        ]);

        $key = config('services.anthropic.key');
        if (! $key) {
            return response()->json([
                'message' => 'Gorsel analizi yapilandirilmadi (ANTHROPIC_API_KEY yok).',
            ], 503);
        }

        $file = $request->file('image');
        $media = $file->getMimeType() ?: 'image/jpeg';
        $data = base64_encode(file_get_contents($file->getRealPath()));

        $prompt = <<<'PROMPT'
You are a precise backgammon board reader. Look at the photo of a backgammon board and output the exact checker position as JSON.

COORDINATE SYSTEM (must follow exactly):
- The board has 24 triangular points, numbered 1..24 using STANDARD backgammon numbering.
- Divide the board into 4 quadrants by the central bar (vertical) and the horizontal middle line:
  - TOP-LEFT quadrant  = points 13,14,15,16,17,18 (left to right)
  - TOP-RIGHT quadrant = points 19,20,21,22,23,24 (left to right)
  - BOTTOM-LEFT quadrant  = points 12,11,10,9,8,7 (left to right)
  - BOTTOM-RIGHT quadrant = points 6,5,4,3,2,1 (left to right)
  - If the board in the photo is rotated/mirrored, infer the mapping so it matches this standard layout.
- There are two checker colors. Treat the LIGHTER color as POSITIVE (white) and the DARKER color as NEGATIVE (black).

OUTPUT (JSON only, no prose, no markdown fences):
{
  "points": [24 integers],   // index 0 = point 1 ... index 23 = point 24. +N = N light checkers, -N = N dark checkers, 0 = empty.
  "bar":  { "white": <light checkers on the central bar>, "black": <dark checkers on the central bar> },
  "off":  { "white": <light checkers borne off / in the tray>, "black": <dark checkers borne off> },
  "confidence": <0..1 overall confidence>
}

RULES:
- Each color has at most 15 checkers total (points + bar + off). Count carefully; stacked checkers may overlap.
- A single point holds only ONE color (never mix signs on one index).
- Respond with ONLY the JSON object.
PROMPT;

        try {
            $resp = Http::withHeaders([
                'x-api-key' => $key,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])->timeout(60)->post('https://api.anthropic.com/v1/messages', [
                'model' => config('services.anthropic.model', 'claude-sonnet-4-5'),
                'max_tokens' => 1024,
                'messages' => [[
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'image',
                            'source' => ['type' => 'base64', 'media_type' => $media, 'data' => $data],
                        ],
                        ['type' => 'text', 'text' => $prompt],
                    ],
                ]],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Gorsel servisi hatasi.'], 502);
        }

        if (! $resp->ok()) {
            return response()->json(['message' => 'Gorsel servisi hatasi.'], 502);
        }

        $text = $resp->json('content.0.text', '');
        $pos = $this->parsePosition($text);
        if (! $pos) {
            return response()->json(['message' => 'Pozisyon okunamadi. Daha net/tepeden bir fotograf deneyin.'], 422);
        }

        return response()->json($pos);
    }

    /** Model metnindeki ilk JSON blogunu ayikla + dogrula/temizle. */
    private function parsePosition(string $text): ?array
    {
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false || $end <= $start) {
            return null;
        }
        $json = substr($text, $start, $end - $start + 1);
        $d = json_decode($json, true);
        if (! is_array($d) || ! isset($d['points']) || ! is_array($d['points']) || count($d['points']) !== 24) {
            return null;
        }

        $points = [];
        foreach ($d['points'] as $v) {
            $n = (int) $v;
            // Tek hanede en fazla 15 tas; makul sinira kirp.
            $points[] = max(-15, min(15, $n));
        }
        $bar = [
            'white' => max(0, (int) ($d['bar']['white'] ?? 0)),
            'black' => max(0, (int) ($d['bar']['black'] ?? 0)),
        ];
        $off = [
            'white' => max(0, (int) ($d['off']['white'] ?? 0)),
            'black' => max(0, (int) ($d['off']['black'] ?? 0)),
        ];

        return [
            'points' => $points,
            'bar' => $bar,
            'off' => $off,
            'confidence' => isset($d['confidence']) ? (float) $d['confidence'] : null,
        ];
    }
}
