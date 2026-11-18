<?php

namespace App\Http\Controllers;

use App\Models\AdClick;
use App\Models\AdSlot;
use Illuminate\Http\Request;

class AdSlotController extends Controller
{
    // Herkese acik: ana sayfada paneller arasinda gosterilen yayindaki reklam seritleri.
    // Slota gore siralanir; frontend her konumda ilgili slotun ilk reklamini gosterir.
    public function index()
    {
        $ads = AdSlot::where('published', true)
            ->whereNotNull('image')
            ->orderBy('sort')
            ->orderBy('id')
            ->limit(30)
            ->get()
            ->map(fn (AdSlot $ad) => [
                'id' => $ad->id,
                'slot' => $ad->slot,
                'image' => $ad->image,
                'image_mobile' => $ad->image_mobile,
                'link' => $ad->link,
                'hide_in_app' => $ad->hide_in_app,
            ]);

        return response()->json(['ads' => $ads]);
    }

    // "Saka reklami" tiklamasini kaydet. Yalniz giris yapmis kullanici (liste adlari gosterir;
    // misafirin adi yok). ADMIN kontrol icin bakar -> KAYDEDILMEZ (listeyi kirletmesin; destek
    // DAHIL DEGIL). Kullanici basina TEK satir -> created_at ilk tiklama anini korur.
    public function click(Request $request, int $ad)
    {
        $user = $request->user('sanctum');
        if ($user && ! $user->is_admin) {
            AdClick::firstOrCreate(['ad_id' => $ad, 'user_id' => $user->id]);
        }

        return response()->json(['ok' => true]);
    }

    // Reklama tiklayan kullanicilarin adlari (yeni -> eski, en fazla 100). Modal icinde gosterilir.
    public function clickers(int $ad)
    {
        $names = AdClick::where('ad_id', $ad)
            ->whereNotNull('user_id')
            ->join('users', 'users.id', '=', 'ad_clicks.user_id')
            // Silinmiş/anonimleşmiş (silinmisN) + yasaklı hesaplar listede görünmesin (User::notDeleted ile aynı koşul).
            ->whereNull('users.banned_at')
            ->where(fn ($w) => $w->whereNull('users.ban_reason')->orWhere('users.ban_reason', '!=', 'account_deleted'))
            ->orderByDesc('ad_clicks.created_at')
            ->limit(100)
            ->pluck('users.nickname')
            ->filter()
            ->unique()
            ->values();

        return response()->json(['names' => $names, 'count' => $names->count()]);
    }
}
