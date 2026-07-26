<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Uye kaydi
    public function register(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name'  => ['required', 'string', 'max:80'],
            'country'    => ['required', 'string', 'max:80'],
            'avatar'     => ['nullable', 'string', 'max:300000'],
            'birth_date' => ['nullable', 'date'],
            'nickname'   => ['required', 'string', 'max:40', 'unique:users,nickname'],
            'email'      => ['required', 'email', 'max:120', 'unique:users,email'],
            'password'   => ['required', 'string', 'min:6', 'max:100'],
        ]);

        $user = User::create($data);
        $token = $user->createToken('web')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token], 201);
    }

    // Giris (email veya takma isim + sifre)
    public function login(Request $request)
    {
        $data = $request->validate([
            'login'    => ['required', 'string'], // email veya nickname
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['login'])
            ->orWhere('nickname', $data['login'])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['E-posta/takma isim veya şifre hatalı.'],
            ]);
        }

        $token = $user->createToken('web')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token]);
    }

    // Google ile giris/kayit (Google Identity Services'ten gelen ID token)
    public function googleLogin(Request $request)
    {
        $data = $request->validate([
            'credential' => ['required', 'string'],
        ]);

        // ID token'i Google'da dogrula (imza + sona erme kontrolu Google tarafinda)
        $resp = Http::asForm()->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $data['credential'],
        ]);
        if (! $resp->ok()) {
            return response()->json(['message' => 'Google doğrulaması başarısız.'], 401);
        }
        $p = $resp->json();

        // Guvenlik: token bizim uygulamamiz icin mi + Google mi verdi?
        $clientId = config('services.google.client_id');
        $iss = $p['iss'] ?? '';
        if (($p['aud'] ?? null) !== $clientId) {
            return response()->json(['message' => 'Geçersiz istemci.'], 401);
        }
        if ($iss !== 'accounts.google.com' && $iss !== 'https://accounts.google.com') {
            return response()->json(['message' => 'Geçersiz sağlayıcı.'], 401);
        }
        $emailVerified = ($p['email_verified'] ?? false);
        $email = $p['email'] ?? null;
        if (! $email || ($emailVerified !== true && $emailVerified !== 'true')) {
            return response()->json(['message' => 'E-posta doğrulanamadı.'], 401);
        }

        $user = User::where('email', $email)->first();
        $isNew = false;
        if (! $user) {
            $isNew = true;
            // Benzersiz takma isim uret (email onekinden)
            $base = Str::slug(explode('@', $email)[0], '');
            if ($base === '') {
                $base = 'oyuncu';
            }
            $base = substr($base, 0, 30);
            $nick = $base;
            $i = 0;
            while (User::where('nickname', $nick)->exists()) {
                $i++;
                $nick = substr($base, 0, 26).$i;
            }
            // Ad/soyad: once given/family, yoksa tam adi bol
            $first = $p['given_name'] ?? '';
            $last = $p['family_name'] ?? '';
            if ($first === '' && ! empty($p['name'])) {
                $parts = preg_split('/\s+/', trim($p['name']), 2);
                $first = $parts[0] ?? '';
                $last = $parts[1] ?? '';
            }
            $user = User::create([
                'first_name' => $first,
                'last_name'  => $last,
                'country'    => '',
                'nickname'   => $nick,
                'email'      => $email,
                'password'   => Hash::make(Str::random(40)), // Google kullanicisi sifre kullanmaz
            ]);
        }

        $token = $user->createToken('google')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token, 'isNew' => $isNew]);
    }

    // Cikis (mevcut token'i iptal et)
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['ok' => true]);
    }

    // Hesabi kalici olarak sil (yalnizca yonetici)
    public function deleteAccount(Request $request)
    {
        $user = $request->user();
        if (! $user->is_admin) {
            return response()->json(['message' => 'Bu işlem için yetkin yok.'], 403);
        }
        $user->tokens()->delete(); // tum oturum token'lari
        $user->delete();
        return response()->json(['ok' => true]);
    }

    // Giris yapmis kullanici
    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()]);
    }

    // Profil guncelle
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name'  => ['required', 'string', 'max:80'],
            'country'    => ['required', 'string', 'max:80'],
            'avatar'     => ['nullable', 'string', 'max:300000'],
            'birth_date' => ['nullable', 'date'],
            'nickname'   => ['required', 'string', 'max:40', Rule::unique('users', 'nickname')->ignore($user->id)],
            'email'      => ['required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user->id)],
        ]);
        $user->update($data);
        return response()->json(['user' => $user]);
    }

    // Oyun sonucu -> Elo puanini guncelle (giris yapmis kullanici kendi puanini bildirir)
    public function reportRating(Request $request)
    {
        $data = $request->validate([
            'won'             => ['required', 'boolean'],
            'opponent_rating' => ['required', 'integer', 'min:100', 'max:4000'],
        ]);
        $user = $request->user();

        $k = 32;
        $ra = $user->rating ?? 1500;
        $rb = $data['opponent_rating'];
        $expected = 1 / (1 + pow(10, ($rb - $ra) / 400));
        $score = $data['won'] ? 1 : 0;
        $newRating = (int) round($ra + $k * ($score - $expected));
        $newRating = max(100, $newRating); // taban

        $user->rating = $newRating;
        $user->save();

        return response()->json(['rating' => $newRating, 'user' => $user]);
    }

    // Takma isim musait mi? (kayit formu icin, halka acik)
    public function nicknameAvailable(Request $request)
    {
        $nickname = (string) $request->query('nickname', '');
        $taken = User::where('nickname', $nickname)->exists();
        return response()->json(['available' => $nickname !== '' && ! $taken]);
    }
}
