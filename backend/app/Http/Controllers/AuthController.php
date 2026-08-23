<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Password;
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
            'country'    => ['nullable', 'string', 'max:80'],
            'avatar'     => ['nullable', 'string', 'max:300000'],
            'birth_date' => ['nullable', 'date'],
            'nickname'   => ['required', 'string', 'max:40', 'unique:users,nickname'],
            'email'      => ['required', 'email', 'max:120', 'unique:users,email'],
            'password'   => ['required', 'string', 'min:6', 'max:100'],
        ]);

        // Ulke bos/eksikse '' ata (kolon NOT NULL olsa bile kayit patlamaz)
        $data['country'] = $data['country'] ?? '';

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

        if ($user->isBanned()) {
            throw ValidationException::withMessages([
                'login' => ['Bu hesap askıya alınmış.'],
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
                'avatar'     => $p['picture'] ?? null, // Google profil fotografi (onerilir, degistirilebilir)
                'nickname'   => $nick,
                'email'      => $email,
                'password'   => Hash::make(Str::random(40)), // Google kullanicisi sifre kullanmaz
            ]);
        }

        if ($user->isBanned()) {
            return response()->json(['message' => 'Bu hesap askıya alınmış.'], 403);
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
        $user = $request->user();
        // Kendi rating siralamasi (kacinci sirada)
        $rank = User::where('rating', '>', $user->rating ?? 1500)->count() + 1;
        $total = User::count();
        return response()->json(['user' => $user, 'rank' => $rank, 'total_players' => $total]);
    }

    // Profil guncelle
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name'  => ['required', 'string', 'max:80'],
            'country'    => ['nullable', 'string', 'max:80'],
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
        $user->games_played = ($user->games_played ?? 0) + 1;
        if ($data['won']) {
            $user->wins = ($user->wins ?? 0) + 1;
        } else {
            $user->losses = ($user->losses ?? 0) + 1;
        }
        $user->save();

        // Basarim rozetleri: yeni hak kazanilanlari ekle + bildirim gonder
        $this->awardBadges($user, $newRating);

        // Mac gecmisine kaydet (yonetim panelinde gorunur)
        \App\Models\MatchResult::create([
            'user_id'         => $user->id,
            'won'             => (bool) $data['won'],
            'opponent_rating' => $rb,
            'rating_before'   => (int) $ra,
            'rating_after'    => $newRating,
            'delta'           => $newRating - (int) $ra,
        ]);

        return response()->json(['rating' => $newRating, 'user' => $user]);
    }

    // Rozet tanimlari (id => [ad, ikon]) — frontend ile ayni id'ler
    private const BADGE_LABELS = [
        'first_win'    => ['İlk Galibiyet', 'medal'],
        'games_10'     => ['10 Maç', 'medal'],
        'games_50'     => ['50 Maç', 'medal'],
        'games_100'    => ['100 Maç', 'medal'],
        'games_500'    => ['500 Maç', 'medal'],
        'wins_10'      => ['10 Galibiyet', 'trophy'],
        'wins_50'      => ['50 Galibiyet', 'trophy'],
        'wins_100'     => ['100 Galibiyet', 'trophy'],
        'rating_1600'  => ['Usta (1600)', 'crown'],
        'rating_1800'  => ['Master (1800)', 'crown'],
        'rating_2000'  => ['Grandmaster (2000)', 'crown'],
        'rating_2200'  => ['Efsane (2200)', 'crown'],
    ];

    // Yeni hak kazanilan rozetleri ekle + her biri icin bildirim gonder
    private function awardBadges(User $user, int $rating): void
    {
        $earned = $user->badges ?? [];
        $games = $user->games_played ?? 0;
        $wins = $user->wins ?? 0;

        $qualify = [];
        if ($wins >= 1) {
            $qualify[] = 'first_win';
        }
        foreach ([10, 50, 100, 500] as $g) {
            if ($games >= $g) {
                $qualify[] = "games_$g";
            }
        }
        foreach ([10, 50, 100] as $w) {
            if ($wins >= $w) {
                $qualify[] = "wins_$w";
            }
        }
        foreach ([1600, 1800, 2000, 2200] as $r) {
            if ($rating >= $r) {
                $qualify[] = "rating_$r";
            }
        }

        $new = array_values(array_diff($qualify, $earned));
        if (empty($new)) {
            return;
        }
        $user->badges = array_values(array_unique(array_merge($earned, $new)));
        $user->save();

        foreach ($new as $b) {
            $label = self::BADGE_LABELS[$b][0] ?? $b;
            $icon = self::BADGE_LABELS[$b][1] ?? 'medal';
            \App\Models\Notification::notify($user->id, "Yeni rozet: {$label}", null, $icon);
        }
    }

    // Liderlik tablosu: rating'e gore en iyi oyuncular (halka acik)
    public function leaderboard(Request $request)
    {
        $limit = min(100, max(1, (int) $request->query('limit', 100)));
        $byCoins = $request->query('by') === 'coins';
        $users = User::orderByDesc($byCoins ? 'coins' : 'rating')
            ->orderByDesc('wins')
            ->limit($limit)
            ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'coins', 'wins', 'losses', 'games_played']);

        $rows = $users->values()->map(function ($u, $i) {
            return [
                'rank'    => $i + 1,
                'id'      => $u->id,
                'name'    => $u->nickname ?: $u->first_name ?: 'Oyuncu',
                'avatar'  => $u->avatar,
                'frame'   => $u->avatar_frame,
                'country' => $u->country,
                'rating'  => $u->rating ?? 1500,
                'coins'   => $u->coins ?? 0,
                'wins'    => $u->wins ?? 0,
                'losses'  => $u->losses ?? 0,
                'games'   => $u->games_played ?? 0,
            ];
        });

        return response()->json(['players' => $rows]);
    }

    // Herkese acik oyuncu profili: temel istatistik + son mac formu (W/L)
    public function publicProfile(Request $request, User $user)
    {
        $recent = \App\Models\MatchResult::where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(10)
            ->get(['won', 'delta', 'created_at']);
        $form = $recent->map(fn ($m) => (bool) $m->won)->all(); // en yeni once
        $rank = User::where('rating', '>', $user->rating ?? 1500)->count() + 1;

        return response()->json([
            'id' => $user->id,
            'name' => $user->nickname ?: $user->first_name ?: 'Oyuncu',
            'avatar' => $user->avatar,
            'frame' => $user->avatar_frame,
            'country' => $user->country,
            'rating' => $user->rating ?? 1500,
            'coins' => $user->coins ?? 0,
            'wins' => $user->wins ?? 0,
            'losses' => $user->losses ?? 0,
            'games' => $user->games_played ?? 0,
            'rank' => $rank,
            'form' => $form,
            'badges' => $user->badges ?? [],
        ]);
    }

    // Giris yapan kullanicinin son maclari (mac gecmisi)
    public function myMatches(Request $request)
    {
        $me = $request->user();
        $matches = \App\Models\MatchResult::where('user_id', $me->id)
            ->orderByDesc('id')
            ->limit(30)
            ->get(['won', 'opponent_rating', 'rating_before', 'rating_after', 'delta', 'created_at'])
            ->map(fn ($m) => [
                'won' => (bool) $m->won,
                'opponent_rating' => $m->opponent_rating,
                'rating_before' => $m->rating_before,
                'rating_after' => $m->rating_after,
                'delta' => $m->delta,
                'created_at' => optional($m->created_at)->toIso8601String(),
            ]);

        return response()->json(['matches' => $matches]);
    }

    // Sifremi unuttum -> sifirlama linki e-postala
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);
        // Google hesaplari sifre kullanmasa da guvenlik icin ayni yaniti veririz
        Password::sendResetLink($request->only('email'));
        return response()->json(['message' => 'ok']);
    }

    // Sifreyi sifirla (link'teki token + yeni sifre)
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'    => ['required', 'string'],
            'email'    => ['required', 'email'],
            'password' => ['required', 'string', 'min:6', 'max:100'],
        ]);

        $status = Password::reset(
            [
                'email'                 => $request->email,
                'password'              => $request->password,
                'password_confirmation' => $request->password,
                'token'                 => $request->token,
            ],
            function (User $user, string $password) {
                $user->password = Hash::make($password);
                $user->save();
                $user->tokens()->delete(); // eski oturumlari kapat
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'ok']);
        }
        return response()->json(['message' => 'Sıfırlama başarısız. Link geçersiz veya süresi dolmuş.'], 400);
    }

    // Takma isim musait mi? (kayit formu icin, halka acik)
    public function nicknameAvailable(Request $request)
    {
        $nickname = (string) $request->query('nickname', '');
        $taken = User::where('nickname', $nickname)->exists();
        return response()->json(['available' => $nickname !== '' && ! $taken]);
    }
}
