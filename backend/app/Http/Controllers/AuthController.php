<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
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
            'province'   => ['nullable', 'string', 'max:80'],
            'avatar'     => ['nullable', 'string', 'max:300000'],
            'birth_date' => ['nullable', 'date'],
            'nickname'   => ['required', 'string', 'max:40', 'unique:users,nickname'],
            'email'      => ['required', 'email', 'max:120', 'unique:users,email'],
            'password'   => ['required', 'string', 'min:6', 'max:100'],
            'start_rating' => ['nullable', 'integer', 'in:900,1100,1400,1700'],
        ]);

        // Ulke bos/eksikse '' ata (kolon NOT NULL olsa bile kayit patlamaz)
        $data['country'] = $data['country'] ?? '';

        // province kolonu (migration) henuz uygulanmamissa kayit patlamasin: atla.
        if (isset($data['province']) && ! Schema::hasColumn('users', 'province')) {
            unset($data['province']);
        }

        // Baslangic puani: oyuncu kendi seviyesini secer (Galaxy tarzi). Yoksa 1400.
        $startRating = $data['start_rating'] ?? 1400;
        unset($data['start_rating']);

        $user = User::create($data);
        $user->rating = $startRating;
        $user->save();

        // E-posta dogrulama linki gonder (teslim icin gercek SMTP gerekir; MAIL_MAILER)
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            // Mail gonderilemezse kayit yine de tamamlanir (kullanici sonra tekrar gonderebilir)
            \Illuminate\Support\Facades\Log::warning('register: verification mail failed', [
                'user_id' => $user->id, 'err' => $e->getMessage(),
            ]);
        }

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

        $user->last_login_at = now();
        $user->save();

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
            return $this->fail('Google doğrulaması başarısız.', 401);
        }
        $p = $resp->json();

        // Guvenlik: token bizim uygulamamiz icin mi + Google mi verdi?
        $clientId = config('services.google.client_id');
        $iss = $p['iss'] ?? '';
        if (($p['aud'] ?? null) !== $clientId) {
            return $this->fail('Geçersiz istemci.', 401);
        }
        if ($iss !== 'accounts.google.com' && $iss !== 'https://accounts.google.com') {
            return $this->fail('Geçersiz sağlayıcı.', 401);
        }
        $emailVerified = ($p['email_verified'] ?? false);
        $email = $p['email'] ?? null;
        if (! $email || ($emailVerified !== true && $emailVerified !== 'true')) {
            return $this->fail('E-posta doğrulanamadı.', 401);
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

        // Google e-postasi zaten dogrulanmis: HEM yeni HEM mevcut kullanicide garantiye al
        // (eski hesaplar Google'a baglaninca "e-postani dogrula" uyarisi almasin).
        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified(); // fillable disi, guvenli
        }

        if ($user->isBanned()) {
            return $this->fail('Bu hesap askıya alınmış.', 403);
        }

        $user->last_login_at = now();
        $user->save();

        $token = $user->createToken('google')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token, 'isNew' => $isNew]);
    }

    // Cikis (mevcut token'i iptal et)
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return $this->ok();
    }

    // Hesabi kalici olarak sil (yalnizca yonetici)
    public function deleteAccount(Request $request)
    {
        // Kullanici kendi hesabini silebilir (KVKK/GDPR: veri silme hakki).
        // Endpoint auth:sanctum altinda; her zaman istegi yapan kullaniciya isler.
        $user = $request->user();
        \Illuminate\Support\Facades\DB::transaction(function () use ($user) {
            // Kullanici bir kulubun SAHIBIYSE: clubs.owner_id cascadeOnDelete oldugu icin
            // hesap silinince tum kulup (ve cascade ile tum uyeleri) yok olurdu -> masum
            // uyeler kulubunu kaybederdi. leave() ile ayni nazik devir: en eski DIGER uyeye
            // sahipligi ver, baska uye yoksa kulubu kapat.
            $myMem = \App\Models\ClubMember::where('user_id', $user->id)->first();
            foreach (\App\Models\Club::where('owner_id', $user->id)->get() as $club) {
                $next = \App\Models\ClubMember::where('club_id', $club->id)
                    ->where('user_id', '!=', $user->id)
                    ->orderBy('created_at')
                    ->first();
                if ($next) {
                    $next->update(['role' => 'owner']);
                    $club->update(['owner_id' => $next->user_id]);
                } else {
                    $club->delete(); // baska uye yok -> kulup kapanir
                }
            }
            // Uye oldugu kulup hala duruyorsa uye sayisini dusur (uyeligi cascade silinecek)
            if ($myMem && \App\Models\Club::whereKey($myMem->club_id)->exists()) {
                \App\Models\Club::whereKey($myMem->club_id)->decrement('members_count');
            }

            // Not: blunders/match_results/clubs/club_members/friendships/payments FK'lari
            // cascadeOnDelete -> otomatik silinir. FK'siz notifications elle temizlenir.
            \App\Models\Notification::where('user_id', $user->id)->delete();
            $user->tokens()->delete(); // tum oturum token'lari
            $user->delete();
        });
        return $this->ok();
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
            'province'   => ['nullable', 'string', 'max:80'],
            'avatar'     => ['nullable', 'string', 'max:300000'],
            'birth_date' => ['nullable', 'date'],
            'nickname'   => ['required', 'string', 'max:40', Rule::unique('users', 'nickname')->ignore($user->id)],
            'email'      => ['required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user->id)],
        ]);
        // province kolonu (migration) henuz uygulanmamissa guncelleme patlamasin: atla.
        if (isset($data['province']) && ! Schema::hasColumn('users', 'province')) {
            unset($data['province']);
        }
        $user->update($data);
        return response()->json(['user' => $user]);
    }

    // Oyun sonucu -> Elo puanini guncelle (giris yapmis kullanici kendi puanini bildirir)
    public function reportRating(Request $request)
    {
        $data = $request->validate([
            'won'             => ['required', 'boolean'],
            'opponent_rating' => ['required', 'integer', 'min:100', 'max:4000'],
            'opponent_name'   => ['nullable', 'string', 'max:40'],
            'opponent_pr'     => ['nullable', 'numeric', 'min:0', 'max:200'],
            'match_length'    => ['nullable', 'integer', 'min:1', 'max:25'],
            'match_type'      => ['nullable', 'in:coin,match'], // Jeton (coin) vs N-puanlik mac
            'pr'              => ['nullable', 'numeric', 'min:0', 'max:200'],
            'luck'            => ['nullable', 'numeric', 'min:-100', 'max:100'],
            'score_self'      => ['nullable', 'integer', 'min:0', 'max:100'],
            'score_opp'       => ['nullable', 'integer', 'min:0', 'max:100'],
            'log'             => ['nullable', 'string', 'max:1200000'], // tam analiz JSON
            'ranked'          => ['nullable', 'boolean'],
            'room_code'       => ['nullable', 'string', 'max:20'], // online oda (friendly denetimi)
        ]);
        $user = $request->user();
        $ranked = $data['ranked'] ?? true; // null/eksik -> puanli (geriye uyum)

        // YETKILI KURAL: oda 'friendly' (davet kodu maci) ise KESINLIKLE puansiz — istemci
        // ranked=true gonderse veya refresh/rejoin ile bayrak kaybolsa bile oda mode'u belirler.
        if (! empty($data['room_code'])) {
            $room = \App\Models\Room::where('code', $data['room_code'])->first();
            if ($room && $room->mode === 'friendly') {
                $ranked = false;
            }
        }

        $ra = $user->rating ?? 1500;
        $rb = $data['opponent_rating'];

        if ($ranked) {
            // PUANLI: Elo + galibiyet/maglubiyet + kulup + rozet/cerceve
            $k = 32;
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

            // Kulup lig puani: uyeyse galibiyet +3, katilim +1. Kulup toplami da artar.
            $mem = \App\Models\ClubMember::where('user_id', $user->id)->first();
            if ($mem) {
                $gain = $data['won'] ? 3 : 1;
                $mem->increment('points', $gain);
                if ($data['won']) {
                    $mem->increment('wins');
                } else {
                    $mem->increment('losses');
                }
                \App\Models\Club::where('id', $mem->club_id)->increment('points', $gain);
            }

            $this->awardBadges($user, $newRating);
            $this->awardFrames($user);
        } else {
            // CASUAL: rating/istatistik DEGISMEZ; mac yine gecmise kaydedilir (delta=0).
            $newRating = (int) $ra;
        }

        // Mac gecmisine kaydet (yonetim panelinde + profil analizinde gorunur)
        $mr = [
            'user_id'         => $user->id,
            'won'             => (bool) $data['won'],
            'opponent_rating' => $rb,
            'rating_before'   => (int) $ra,
            'rating_after'    => $newRating,
            'delta'           => $newRating - (int) $ra,
            'match_length'    => $data['match_length'] ?? null,
            'pr'              => $data['pr'] ?? null,
            'coins_after'     => $user->coins ?? 0,
        ];
        // luck/score_* migration ile geldi -> kolonlar varsa ekle (yoksa kayit yine olussun)
        if (\Illuminate\Support\Facades\Schema::hasColumn('match_results', 'luck')) {
            $mr['luck'] = $data['luck'] ?? null;
            $mr['score_self'] = $data['score_self'] ?? null;
            $mr['score_opp'] = $data['score_opp'] ?? null;
        }
        if (\Illuminate\Support\Facades\Schema::hasColumn('match_results', 'opponent_name')) {
            $mr['opponent_name'] = $data['opponent_name'] ?? null;
            $mr['opponent_pr'] = $data['opponent_pr'] ?? null;
        }
        if (\Illuminate\Support\Facades\Schema::hasColumn('match_results', 'log')) {
            $mr['log'] = $data['log'] ?? null;
        }
        // Oyun turu: Jeton (coin) mi N-puanlik mac mi (Median "Jeton" kategorisi + WXP).
        if (\Illuminate\Support\Facades\Schema::hasColumn('match_results', 'match_type')) {
            $mr['match_type'] = $data['match_type'] ?? \App\Support\StatsConfig::MATCH_TYPE_MATCH;
        }
        $result = \App\Models\MatchResult::create($mr);

        // WXP odullendir (kazanan + desteklenen tur/uzunluk). Idempotent + transaction-safe.
        // Ayri, bagimsiz domain akisi: WXP source of truth ledger'dir (rating'den bagimsiz).
        try {
            app(\App\Services\WxpService::class)->awardForMatchResult($result);
        } catch (\Throwable $e) {
            // WXP verilemezse mac kaydi yine de gecerli; sessizce veri kaybetme -> logla.
            \Illuminate\Support\Facades\Log::warning('WXP award failed', [
                'match_result_id' => $result->id, 'user_id' => $user->id,
            ]);
        }
        // Yeni mac -> median cache'ini (tum filtreler) gecersiz kil.
        app(\App\Services\PlayerStatisticsService::class)->invalidate($user->id);

        // Hata Gunlugu: bu macin log'unu karar-karar analiz et (siniflandirma+pip).
        // Motor CALISMAZ; log'daki hazir equity/loss kullanilir. Hata olursa mac
        // kaydi yine gecerli -> sessizce yutma, logla.
        try {
            app(\App\Services\ErrorJournalService::class)->analyzeMatch($result);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Error journal analyze failed', [
                'match_result_id' => $result->id, 'user_id' => $user->id, 'err' => $e->getMessage(),
            ]);
        }

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

    // Kazanilan avatar cerceveleri: 1000 galibiyet + top-100 (rating siralamasi).
    // unlocks'a 'frame.<id>' ekler (magaza ile ayni mekanizma) + bildirim gonderir.
    // Kazanilan avatar cerceveleri KALDIRILDI (eski frame sistemi temizlendi). No-op birakildi
    // ki cagiranlar kirilmasin ve orphan 'frame.*' unlock uretilmesin.
    private function awardFrames(User $user): void
    {
        unset($user);
    }

    // Liderlik tablosu: rating'e gore en iyi oyuncular (halka acik)
    public function leaderboard(Request $request)
    {
        $limit = min(100, max(1, (int) $request->query('limit', 100)));
        // Siralama kriteri: rating (varsayilan) | coins | wxp (cached users.total_wxp)
        $by = $request->query('by');
        $sortCol = $by === 'coins' ? 'coins' : ($by === 'wxp' ? 'total_wxp' : 'rating');
        $users = User::orderByDesc($sortCol)
            ->orderByDesc('wins')
            ->limit($limit)
            ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'coins', 'total_wxp', 'wins', 'losses', 'games_played']);

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
                'wxp'     => $u->total_wxp ?? 0,
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
        // SAVUNMACI: luck/score_* kolonlari migration ile eklendi. Migration henuz
        // calismadiysa o kolonlari SECME (aksi halde "unknown column" -> tum liste bos).
        $hasNew = \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'luck');
        $hasOpp = \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'opponent_name');
        $hasLog = \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'log');
        // Listede LOG'un kendisini CEKME (buyuk); yalnizca var mi diye bak (has_log).
        $cols = ['id', 'won', 'opponent_rating', 'rating_before', 'rating_after', 'delta', 'match_length', 'pr', 'coins_after', 'created_at'];
        if ($hasNew) {
            $cols = array_merge($cols, ['luck', 'score_self', 'score_opp']);
        }
        if ($hasOpp) {
            $cols = array_merge($cols, ['opponent_name', 'opponent_pr']);
        }
        $q = \App\Models\MatchResult::where('user_id', $me->id)->orderByDesc('id')->limit(30)->select($cols);
        if ($hasLog) {
            // has_log yalniz GERCEK karar iceren log icin true. Bos sarmalayici
            // ({"hc":"white","log":[]} ~24 karakter; online/PvP mac) yanlis pozitif vermesin.
            $q->addSelect(\Illuminate\Support\Facades\DB::raw('(log IS NOT NULL AND CHAR_LENGTH(log) > 40) as has_log'));
        }
        $matches = $q->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'won' => (bool) $m->won,
                'opponent_rating' => $m->opponent_rating,
                'opponent_name' => $hasOpp ? $m->opponent_name : null,
                'opponent_pr' => $hasOpp ? $m->opponent_pr : null,
                'rating_before' => $m->rating_before,
                'rating_after' => $m->rating_after,
                'delta' => $m->delta,
                'match_length' => $m->match_length,
                'pr' => $m->pr,
                'coins_after' => $m->coins_after,
                'luck' => $hasNew ? $m->luck : null,
                'score_self' => $hasNew ? $m->score_self : null,
                'score_opp' => $hasNew ? $m->score_opp : null,
                'has_log' => $hasLog ? (bool) $m->has_log : false,
                'created_at' => optional($m->created_at)->toIso8601String(),
            ]);

        return response()->json(['matches' => $matches]);
    }

    // Bir macin tam analiz log'u (hamle-hamle MatchReport icin). Sahiplik kontrolu.
    public function matchLog(Request $request, \App\Models\MatchResult $match)
    {
        if ($match->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Yetkisiz.'], 403);
        }
        if (! \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'log')) {
            return response()->json(['log' => null]);
        }
        return response()->json(['log' => $match->log]); // JSON string (istemci parse eder)
    }

    // Profil analizi: rating/coin gecmisi + mac-uzunluguna gore kazanma%/PR + WXP
    public function analytics(Request $request)
    {
        $me = $request->user();
        $rows = \App\Models\MatchResult::where('user_id', $me->id)
            ->orderBy('id')
            ->get(['won', 'rating_after', 'coins_after', 'match_length', 'pr']);

        $ratingHistory = $rows->map(fn ($r) => (int) $r->rating_after)->values();
        $coinsHistory = $rows->filter(fn ($r) => $r->coins_after !== null)
            ->map(fn ($r) => (int) $r->coins_after)->values();

        // Maç uzunluguna gore grupla (kazanma% + ortalama PR)
        $byLen = [];
        $wxp = 0;
        foreach ($rows as $r) {
            if ($r->won) {
                $wxp += (int) ($r->match_length ?? 1);
            }
            $len = $r->match_length;
            if (! $len) {
                continue;
            }
            if (! isset($byLen[$len])) {
                $byLen[$len] = ['length' => (int) $len, 'games' => 0, 'wins' => 0, 'pr_sum' => 0.0, 'pr_n' => 0];
            }
            $byLen[$len]['games']++;
            if ($r->won) {
                $byLen[$len]['wins']++;
            }
            if ($r->pr !== null) {
                $byLen[$len]['pr_sum'] += (float) $r->pr;
                $byLen[$len]['pr_n']++;
            }
        }
        ksort($byLen);
        $byLength = array_values(array_map(fn ($g) => [
            'length' => $g['length'],
            'games' => $g['games'],
            'wins' => $g['wins'],
            'win_pct' => $g['games'] > 0 ? round($g['wins'] / $g['games'] * 100, 1) : 0,
            'avg_pr' => $g['pr_n'] > 0 ? round($g['pr_sum'] / $g['pr_n'], 2) : null,
        ], $byLen));

        return response()->json([
            'rating_history' => $ratingHistory,
            'coins_history' => $coinsHistory,
            'by_length' => $byLength,
            'wxp' => $wxp,
            'games' => $me->games_played ?? 0,
            'wins' => $me->wins ?? 0,
            'losses' => $me->losses ?? 0,
        ]);
    }

    // WXP kirilimi (yalniz kendi): ledger'dan kategori bazli WXP nasil olustu.
    // Kural: coin galibiyeti +1; N-puanlik mac galibiyeti +N (desteklenen: 1,3,5,7).
    // Her kategori: kazanilan mac sayisi (wins), mac basina WXP (per), toplam WXP (wxp).
    public function wxpBreakdown(Request $request)
    {
        $me = $request->user();
        $txs = \App\Models\UserWxpTransaction::where('user_id', $me->id)
            ->where('source', \App\Services\WxpService::SOURCE_MATCH_WIN)
            ->get(['amount', 'metadata']);

        // Sabit kategori sirasi: coin, 1, 3, 5, 7 (hepsi gorunur; 0 olsa da)
        $cats = ['coin' => ['wins' => 0, 'wxp' => 0, 'per' => \App\Support\StatsConfig::WXP_COIN]];
        foreach (\App\Support\StatsConfig::WXP_SUPPORTED_LENGTHS as $L) {
            $cats[(string) $L] = ['wins' => 0, 'wxp' => 0, 'per' => $L];
        }

        foreach ($txs as $tx) {
            $m = $tx->metadata ?? [];
            $type = $m['match_type'] ?? \App\Support\StatsConfig::MATCH_TYPE_MATCH;
            $key = \App\Support\StatsConfig::categoryKey($type, $m['match_length'] ?? null);
            if ($key === null || ! isset($cats[$key])) {
                continue;
            }
            $cats[$key]['wins']++;
            $cats[$key]['wxp'] += (int) $tx->amount;
        }

        $categories = [];
        foreach ($cats as $key => $c) {
            $categories[] = ['key' => $key, 'wins' => $c['wins'], 'per' => $c['per'], 'wxp' => $c['wxp']];
        }

        return response()->json([
            'total' => (int) array_sum(array_column($categories, 'wxp')),
            'categories' => $categories,
        ]);
    }

    // Profil performans istatistikleri (tek endpoint): Medyan Hata Orani + WXP/G/M/Kaz%.
    // period: all|7d|30d|90d|1y (median tarih filtresi). Yalnizca kendi (/me) verisi.
    public function performanceStats(Request $request)
    {
        $me = $request->user();
        $period = (string) $request->query('period', 'all');

        $stats = app(\App\Services\PlayerStatisticsService::class)->performanceStats($me, $period);

        return response()->json($stats);
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
        return $this->fail('Sıfırlama başarısız. Link geçersiz veya süresi dolmuş.', 400);
    }

    // E-posta dogrulama linki (imzali). Basari/hata sonrasi SPA'ya yonlendirir.
    public function verifyEmail(Request $request, int $id, string $hash)
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $user = User::find($id);
        if (! $user || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return redirect("{$base}/?verified=0");
        }
        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new \Illuminate\Auth\Events\Verified($user));
        }
        return redirect("{$base}/?verified=1");
    }

    // Dogrulama e-postasini tekrar gonder (giris yapmis kullanici)
    public function resendVerification(Request $request)
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'already_verified']);
        }
        $user->sendEmailVerificationNotification();
        return response()->json(['message' => 'sent']);
    }

    // Takma isim musait mi? (kayit formu icin, halka acik)
    public function nicknameAvailable(Request $request)
    {
        $nickname = (string) $request->query('nickname', '');
        $taken = User::where('nickname', $nickname)->exists();
        return response()->json(['available' => $nickname !== '' && ! $taken]);
    }
}
