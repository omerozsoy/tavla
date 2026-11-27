<?php

namespace App\Http\Controllers;

use App\Jobs\AnalyzePhotoJob;
use App\Models\PhotoAnalysis;
use Illuminate\Http\Request;

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
