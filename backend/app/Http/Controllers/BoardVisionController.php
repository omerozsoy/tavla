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
You are an expert backgammon board reader. Read the EXACT checker position from the photo.

NUMBERING (standard): 4 quadrants split by the central bar (vertical) + horizontal middle.
- TOP-LEFT = points 13,14,15,16,17,18 (left to right)
- TOP-RIGHT = points 19,20,21,22,23,24 (left to right)
- BOTTOM-LEFT = points 12,11,10,9,8,7 (left to right)
- BOTTOM-RIGHT = points 6,5,4,3,2,1 (left to right)
- If the board is rotated/mirrored, infer the mapping so it matches this standard layout.
Two checker colors: LIGHTER color = POSITIVE (white), DARKER = NEGATIVE (black).

STEP 1 — Reason out loud. Go quadrant by quadrant, then each of its 6 points left-to-right. For every point that has checkers state: point number, color, and how many (count carefully; stacks overlap). Also count the central bar and both borne-off trays. This reasoning is REQUIRED.

STEP 2 — Sanity check: each color must total EXACTLY 15 (points + bar + off). If not, RE-EXAMINE and fix before answering.

STEP 3 — Output the FINAL answer as a JSON object inside a ```json fenced code block:
```json
{"points":[24 ints, index0=point1..index23=point24, +light/-dark],"bar":{"white":n,"black":n},"off":{"white":n,"black":n},"confidence":0..1}
```
"points" MUST be EXACTLY 24 integers. A point holds only ONE color.
PROMPT;

        $headers = [
            'x-api-key' => $key,
            'anthropic-version' => '2023-06-01',
            'content-type' => 'application/json',
        ];
        // Kimlige-bagli anahtar: workspace id basligi sart (yoksa 400 doner).
        if ($ws = config('services.anthropic.workspace')) {
            $headers['anthropic-workspace-id'] = $ws;
        }

        try {
            $resp = Http::withHeaders($headers)->timeout(60)->post('https://api.anthropic.com/v1/messages', [
                'model' => config('services.anthropic.model', 'claude-sonnet-4-5'),
                'max_tokens' => 2500,
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
            report($e);
            return response()->json(['message' => 'Gorsel servisi hatasi.'], 502);
        }

        if (! $resp->ok()) {
            \Log::warning('vision upstream error', ['status' => $resp->status(), 'body' => mb_substr($resp->body(), 0, 300)]);
            return response()->json(['message' => 'Gorsel servisi hatasi.'], 502);
        }

        $text = $resp->json('content.0.text', '');
        $pos = $this->parsePosition($text);
        if (! $pos) {
            return response()->json(['message' => 'Pozisyon okunamadi. Daha net/tepeden bir fotograf deneyin.'], 422);
        }

        return response()->json($pos);
    }

    /** Model muhakeme edip SON ```json blogunda cevap verir; onu ayikla (yoksa ilk{..son}). */
    private function parsePosition(string $text): ?array
    {
        $json = null;
        if (preg_match_all('/```json\s*(\{.*?\})\s*```/s', $text, $mm) && $mm[1]) {
            $json = end($mm[1]); // son fenced JSON blogu
        } else {
            $start = strpos($text, '{');
            $end = strrpos($text, '}');
            if ($start === false || $end === false || $end <= $start) {
                return null;
            }
            $json = substr($text, $start, $end - $start + 1);
        }
        $d = json_decode($json, true);
        if (! is_array($d) || ! isset($d['points']) || ! is_array($d['points'])) {
            return null;
        }

        // 24'e normalize et (model bazen 23/25 dondurur): eksigi 0'la doldur, fazlayi kirp.
        $raw = array_values($d['points']);
        $points = [];
        for ($i = 0; $i < 24; $i++) {
            $points[] = max(-15, min(15, (int) ($raw[$i] ?? 0)));
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
