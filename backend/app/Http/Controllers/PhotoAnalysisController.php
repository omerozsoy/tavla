<?php

namespace App\Http\Controllers;

use App\Jobs\AnalyzePhotoJob;
use App\Models\PhotoAnalysis;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Fotograftan Pozisyon Analizi: tahta fotografi yukle -> kuyruga al (AnalyzePhotoJob) -> poll.
 * Foto private disk'te (local); tanima+gnubg ARKA PLANDA (CPU'lu, istek-disi).
 */
class PhotoAnalysisController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,webp', 'max:12288'], // 12MB
            'flip' => ['sometimes', 'boolean'],
        ]);

        $path = $request->file('image')->store('photo-analysis', 'local');

        $pa = PhotoAnalysis::create([
            'user_id' => $request->user()?->id,
            'image_path' => $path,
            'status' => 'pending',
            'flip' => (bool) ($data['flip'] ?? false),
        ]);

        AnalyzePhotoJob::dispatch($pa->id);

        return response()->json(['id' => $pa->id, 'status' => $pa->status], 202);
    }

    /**
     * Kullanici AYARLARI: kup (deger/sahip) + mac (uzunluk/skor/crawford). Tanima kupu bulur + sahibini
     * konumdan cikarir ama DEGERI ve SKORU okuyamaz (model yok) -> kullanici secer, AYNI taninan konum
     * yeni ayarlarla gnubg'ye yeniden gonderilir (foto yeniden yuklenmez, tanima yeniden calismaz).
     * Kurallar: ortadaki kup degeri 1 ve sahipsiz; sahipli kup >= 2. match_length 0 = para oyunu
     * (skor/crawford yok sayilir). Macta skor < uzunluk; crawford yalniz TAM BIR oyuncu maca 1 kalaysa.
     */
    public function settings(Request $request, PhotoAnalysis $photoAnalysis, GnuBgClient $gnubg)
    {
        abort_unless($photoAnalysis->user_id === $request->user()?->id, 403);
        abort_unless(
            $photoAnalysis->status === 'done' && $photoAnalysis->valid && is_array($photoAnalysis->position),
            422,
            'analysis_not_ready'
        );

        $data = $request->validate([
            'cube_value' => ['required', 'integer', Rule::in([1, 2, 4, 8, 16, 32, 64])],
            'cube_owner' => ['nullable', Rule::in(['white', 'black'])],
            'match_length' => ['sometimes', 'integer', 'min:0', 'max:25'],
            'score_me' => ['sometimes', 'integer', 'min:0', 'max:24'],
            'score_opp' => ['sometimes', 'integer', 'min:0', 'max:24'],
            'crawford' => ['sometimes', 'boolean'],
        ]);
        $value = (int) $data['cube_value'];
        $owner = $data['cube_owner'] ?? null;
        if ($value === 1) {
            $owner = null; // ortadaki kup
        } elseif ($owner === null) {
            return response()->json(['message' => 'owner_required'], 422);
        }

        $ml = (int) ($data['match_length'] ?? 0);
        $me = $ml > 0 ? (int) ($data['score_me'] ?? 0) : 0;
        $opp = $ml > 0 ? (int) ($data['score_opp'] ?? 0) : 0;
        if ($ml > 0 && ($me >= $ml || $opp >= $ml)) {
            return response()->json(['message' => 'score_out_of_range'], 422);
        }
        $oneAway = $ml > 0 && (($me === $ml - 1) xor ($opp === $ml - 1));
        $crawford = $oneAway && (bool) ($data['crawford'] ?? false);

        $position = $photoAnalysis->position;
        $position['cube'] = ['value' => $value, 'owner' => $owner];
        $position['matchLength'] = $ml;
        $position['score'] = ['white' => $me, 'black' => $opp];
        $position['crawford'] = $crawford;

        $hint = $gnubg->analyze(AnalyzePhotoJob::gnubgPosition($position));
        if ($hint === null) {
            return response()->json(['message' => 'gnubg_unavailable'], 503);
        }

        $photoAnalysis->update(['position' => $position, 'hint' => $hint]);

        return $this->show($request, $photoAnalysis);
    }

    public function show(Request $request, PhotoAnalysis $photoAnalysis)
    {
        abort_unless($photoAnalysis->user_id === $request->user()?->id, 403);

        return response()->json([
            'id' => $photoAnalysis->id,
            'status' => $photoAnalysis->status,
            'valid' => $photoAnalysis->valid,
            'position' => $photoAnalysis->position,
            'hint' => $photoAnalysis->hint,
            'debug' => $photoAnalysis->debug,
            'error' => $photoAnalysis->error,
        ]);
    }
}
