<?php

namespace App\Http\Controllers;

use App\Models\PhotoAnalysis;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * Admin foto düzeltme SPA sayfası (/foto-duzelt/<id>) API'si. show: tanınan konum + okunan zar/küp +
 * imzalı görsel URL (<img> Bearer gönderemez → signed route). label: admin'in gerçek Board'da düzelttiği
 * konumu ground_truth olarak kaydeder (eğitim etiketi). İkisi de ['auth:sanctum','admin'] arkasında.
 */
class AdminPhotoAnalysisController extends Controller
{
    public function show(PhotoAnalysis $photoAnalysis)
    {
        $pos = is_array($photoAnalysis->position) ? $photoAnalysis->position : [];

        return response()->json([
            'id' => $photoAnalysis->id,
            'position' => $photoAnalysis->position,
            'recognized' => ['dice' => $pos['dice'] ?? [], 'cube' => $pos['cube'] ?? null],
            'flip' => (bool) $photoAnalysis->flip,
            'photographer' => $photoAnalysis->debug['photographer'] ?? null,
            'status' => $photoAnalysis->status,
            'valid' => (bool) $photoAnalysis->valid,
            'image_url' => URL::temporarySignedRoute('admin.photo-analysis.image', now()->addMinutes(30), ['photoAnalysis' => $photoAnalysis->id]),
        ]);
    }

    public function label(Request $request, PhotoAnalysis $photoAnalysis)
    {
        $data = $request->validate([
            'ground_truth' => ['required', 'array'],
            'ground_truth.points' => ['required', 'array', 'size:24'],
            'ground_truth.bar' => ['required', 'array'],
            'ground_truth.turn' => ['required', 'in:white,black'],
            'ground_truth.dice' => ['present', 'array'],
            'ground_truth.cube' => ['required', 'array'],
        ]);

        $photoAnalysis->labelCorrected($data['ground_truth']);

        return response()->json(['ok' => true]);
    }
}
