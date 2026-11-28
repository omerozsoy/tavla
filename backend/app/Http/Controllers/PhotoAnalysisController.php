<?php

namespace App\Http\Controllers;

use App\Jobs\AnalyzePhotoJob;
use App\Models\PhotoAnalysis;
use App\Services\GnuBg\GnuBgClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
     * CEKILMIS kup (cube_offer = ceken: white/black; tahtanin ortasinda, kimsenin degil): cube_value =
     * teklif edilen deger V (>= 2); gnubg'ye CEKENIN sirasi + kupun cekilmeden ONCEKI hali (V/2; 1 ise
     * ortada) + zarsiz gider -> kup analizi al/pas kararini verir. Teklif yoksa sira/zar tanimaya doner.
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
            'cube_offer' => ['nullable', Rule::in(['white', 'black'])],
            // Kullanici zar okumasini duzeltir (tanima yanlis okuyabilir) -> [] veya [d1,d2]
            'dice' => ['sometimes', 'array', 'max:2'],
            'dice.*' => ['integer', 'min:1', 'max:6'],
            // Kullanici sirayi duzeltir (white = fotografi ceken / bende, black = rakip / karsida)
            'turn' => ['sometimes', Rule::in(['white', 'black'])],
        ]);
        $value = (int) $data['cube_value'];
        $owner = $data['cube_owner'] ?? null;
        $offerBy = $data['cube_offer'] ?? null;
        if ($offerBy !== null) {
            if ($value < 2) {
                return response()->json(['message' => 'offer_value_required'], 422);
            }
        } elseif ($value === 1) {
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
        // tanimanin buldugu sira/zar (eski kayitlarda 'recognized' yok -> mevcut deger)
        $recognized = $position['recognized'] ?? ['turn' => $position['turn'] ?? 'white', 'dice' => $position['dice'] ?? []];
        // Kullanici zar duzeltti -> recognized'a yaz (sonraki kup/mac degisimlerinde de kalici olsun).
        if ($request->has('dice')) {
            $recognized['dice'] = array_values(array_filter(
                $data['dice'] ?? [],
                fn ($d) => $d >= 1 && $d <= 6
            ));
        }
        // Sira duzeltmesi recognized'a kalici yazilir (sonraki kup/mac/zar degisimlerinde de gecerli).
        // Cekilmis kup (offer) dalinda sira katlayan oyuncudur -> asagida offerBy ezer, override gecmez.
        if ($request->has('turn')) {
            $recognized['turn'] = $data['turn'];
        }
        $position['recognized'] = $recognized;
        if ($offerBy !== null) {
            $pre = max(1, intdiv($value, 2));
            $position['cube'] = ['value' => $pre, 'owner' => $pre === 1 ? null : $offerBy];
            $position['cube_offer'] = ['by' => $offerBy, 'value' => $value];
            $position['turn'] = $offerBy;
            $position['dice'] = [];
        } else {
            $position['cube'] = ['value' => $value, 'owner' => $owner];
            $position['cube_offer'] = null;
            $position['turn'] = $recognized['turn'];
            $position['dice'] = $recognized['dice'];
        }
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

    /**
     * Kullanici "hatali tarama bildir" -> kayit admin incelemesine isaretlenir (reported_at). Admin
     * panelde resme bakip dogru konumu girer (ground_truth) -> yeniden egitim etiketi. Idempotent.
     */
    public function report(Request $request, PhotoAnalysis $photoAnalysis)
    {
        abort_unless($photoAnalysis->user_id === $request->user()?->id, 403);
        if ($photoAnalysis->reported_at === null) {
            $photoAnalysis->update(['reported_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Admin panel foto onizlemesi: private disk'teki tahta fotografini akitir (yukleme downscale ile
     * JPEG). Yalniz admin (web rotasi 'admin' middleware); kullanici-sahiplik kontrolu YOK (admin hepsini
     * inceler). Egitim etiketleme icin admin resmi gormeli.
     */
    public function adminImage(PhotoAnalysis $photoAnalysis)
    {
        abort_unless(Storage::disk('local')->exists($photoAnalysis->image_path), 404);

        return response(Storage::disk('local')->get($photoAnalysis->image_path), 200, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=600',
        ]);
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
