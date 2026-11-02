<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\WelcomeGrant;
use App\Support\Brand;
use App\Support\EmailVerification;
use App\Support\Sms;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

// E-posta + telefon DOĞRULAMA uclari. AuthController god-object'inden ayristirildi (denetim K3):
// kayit/giris/token mantigindan bagimsiz, kendi icinde kapali bir dogrulama kumesidir. Hosgeldin
// odulleri ortak WelcomeGrant servisine tasindi (Google OAuth da ayni servisi kullanir). Davranis
// BIREBIR korundu (yalnizca tasindi). verifyEmail: web rotasi (signed); digerleri auth'lu API.
class VerificationController extends Controller
{
    public function verifyEmail(Request $request, int $id, string $hash)
    {
        // Çoklu-domain: doğrulama linki hangi markada tıklandıysa SPA'ya oraya dön.
        $base = rtrim((string) (Brand::current()['origin'] ?? config('app.frontend_url', config('app.url'))), '/');
        $user = User::find($id);
        if (! $user || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return redirect("{$base}/?verified=0");
        }
        $this->completeEmailVerification($user); // TEK KAYNAK: damgala + hoşgeldin ödülleri (idempotent)

        return redirect("{$base}/?verified=1");
    }

    /**
     * E-POSTA DOĞRULAMASININ TEK TAMAMLAYICISI — e-postayı damgala + hoşgeldin ödüllerini
     * (coin + 3 ay Premium) ver. TÜM e-posta doğrulama yolları BUNU çağırmalı:
     *   • verifyEmail  (doğrulama LİNKİ)
     *   • verifyEmailCode (6-haneli KOD)
     * Böylece bir yol ödül vermeyi "UNUTAMAZ" -> 2026-10'daki kod-yolu welcome bug'ı
     * (kodla doğrulayan coin+premium alamıyordu) BİR DAHA OLMAZ. Hepsi idempotent:
     * markEmailAsVerified + welcome_granted + trial_used flag'leri çift-vermeyi engeller.
     * YENİ bir e-posta doğrulama yolu eklersen YALNIZ bunu çağır; grant'ları ELLE EKLEME.
     * (Google OAuth bilinçli olarak AYRI: premium yalnız YENİ kayıtta verilir — bkz AuthController::google().)
     */
    private function completeEmailVerification(User $user): void
    {
        if ($user->hasVerifiedEmail()) {
            return; // zaten doğrulanmış -> tekrar damgalama/ödül yok
        }
        $user->markEmailAsVerified();
        event(new Verified($user));
        app(WelcomeGrant::class)->coins($user->id);   // hoşgeldin coin'i (idempotent: welcome_granted)
        app(WelcomeGrant::class)->premium($user->id); // 3 ay hoşgeldin Premium (idempotent: trial_used)
    }

    // Dogrulama e-postasini tekrar gonder (giris yapmis kullanici)
    public function resendVerification(Request $request)
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'already_verified']);
        }
        // 60sn cooldown (tekrar-gonder spam'i) — telefon OTP ile ayni desen.
        $cd = 'eotp-cd:'.$user->id;
        if (Cache::has($cd)) {
            return response()->json(['message' => 'cooldown'], 429);
        }
        Cache::put($cd, 1, now()->addSeconds(60));
        // TEK e-postada kod + imzali link. Mail patlarsa sessiz -> kullanici tekrar deneyebilir.
        try {
            EmailVerification::send($user); // TEK kaynak (Filament toplu aksiyonu da kullanır)
        } catch (\Throwable $e) {
            Log::warning('email verify mail failed', ['e' => $e->getMessage()]);
        }

        return response()->json(['message' => 'sent']);
    }

    // E-posta kodu dogrula: dogruysa email_verified_at damgalanir. 5 yanlista kod iptal.
    // Telefon OTP (verifyPhoneOtp) ile birebir ayni desen; kod cache'te 'eotp:{id}'.
    public function verifyEmailCode(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['user' => $user, 'message' => 'already_verified']);
        }
        $key = 'eotp:'.$user->id;
        $rec = Cache::get($key);
        // A-13: kod GÖNDERİLDİĞİ e-postaya bağlı. Kod alındıktan sonra e-posta değiştirildiyse eski
        // kod yeni (sahipliği kanıtlanmamış) adresi doğrulayamaz. (Eski kayıtlar 'email' taşımaz -> geçersiz.)
        if (! $rec || ($rec['email'] ?? null) !== strtolower((string) $user->email)) {
            Cache::forget($key);

            return response()->json(['message' => 'expired'], 422);
        }
        if (($rec['tries'] ?? 0) >= 5) {
            Cache::forget($key);

            return response()->json(['message' => 'too_many'], 422);
        }
        if (! hash_equals((string) $rec['code'], $data['code'])) {
            $rec['tries'] = ($rec['tries'] ?? 0) + 1;
            Cache::put($key, $rec, now()->addMinutes(15));

            return response()->json(['message' => 'wrong'], 422);
        }
        Cache::forget($key);
        // TEK KAYNAK: link yolu (verifyEmail) ile BİREBİR aynı -> damgala + hoşgeldin ödülleri.
        $this->completeEmailVerification($user);

        return response()->json(['user' => $user->fresh(), 'message' => 'verified']);
    }

    // Telefon OTP gonder: kullanicinin kayitli cep numarasina 6 haneli kod (5 dk gecerli).
    // 60sn cooldown (tekrar-gonder spam'i). IYS MUAF islemsel dogrulama SMS'i. Kod ASLA
    // yanitta donmez (yalniz SMS ile gider). Netgsm yapilandirilmamissa Sms::send loglar.
    public function sendPhoneOtp(Request $request)
    {
        $user = $request->user();
        if ($user->phone_verified_at) {
            return response()->json(['message' => 'already_verified']);
        }
        $phone = (string) ($user->phone ?? '');
        if (! preg_match('/^0?5\d{9}$/', $phone)) {
            return response()->json(['message' => 'no_phone'], 422);
        }
        // Hesap-bazli kilit: cok yanlis denemede yeni kod uretimi de durur (aksi halde
        // saldirgan cooldown sonrasi surekli yeni kod uretip her birine 5 deneme yapar).
        if (Cache::has('otp-lock:'.$user->id)) {
            return response()->json(['message' => 'locked'], 429);
        }
        $cd = 'otp-cd:'.$user->id;
        if (Cache::has($cd)) {
            return response()->json(['message' => 'cooldown'], 429);
        }
        $code = (string) random_int(100000, 999999);
        Cache::put('otp:'.$user->id, ['code' => $code, 'tries' => 0], now()->addMinutes(5));
        Cache::put($cd, 1, now()->addSeconds(60));
        Sms::send($phone, 'Tavla TV dogrulama kodunuz: '.$code.'. Kod 5 dakika gecerlidir.');

        return response()->json(['message' => 'sent']);
    }

    // Telefon OTP dogrula: dogruysa phone_verified_at damgalanir. 5 yanlista kod iptal.
    public function verifyPhoneOtp(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);
        $user = $request->user();
        if ($user->phone_verified_at) {
            return response()->json(['user' => $user, 'message' => 'already_verified']);
        }
        // Kalici kilit: kod yenilense bile toplam yanlis denemeyi sayar. Esik asilinca
        // 30 dk hem dogrulama hem yeni kod uretimi durur -> 10^6 kod brute-force edilemez.
        $lock = 'otp-lock:'.$user->id;
        $fails = 'otp-fails:'.$user->id;
        if (Cache::has($lock)) {
            return response()->json(['message' => 'locked'], 429);
        }
        $key = 'otp:'.$user->id;
        $rec = Cache::get($key);
        if (! $rec) {
            return response()->json(['message' => 'expired'], 422);
        }
        if (($rec['tries'] ?? 0) >= 5) {
            Cache::forget($key);

            return response()->json(['message' => 'too_many'], 422);
        }
        if (! hash_equals((string) $rec['code'], $data['code'])) {
            $rec['tries'] = ($rec['tries'] ?? 0) + 1;
            Cache::put($key, $rec, now()->addMinutes(5));
            $total = (int) Cache::get($fails, 0) + 1;
            Cache::put($fails, $total, now()->addMinutes(30));
            if ($total >= 10) {
                Cache::put($lock, 1, now()->addMinutes(30));
                Cache::forget($key);

                return response()->json(['message' => 'locked'], 429);
            }

            return response()->json(['message' => 'wrong'], 422);
        }
        Cache::forget($fails);
        $user->phone_verified_at = now(); // fillable disi -> guvenli dogrudan atama
        $user->save();
        Cache::forget($key);

        return response()->json(['user' => $user, 'message' => 'verified']);
    }
}
