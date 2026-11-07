<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\CareerPrService;
use App\Support\DuelService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

// Herkese acik liderlik/siralama READ uclari. AuthController god-object'inden ayristirildi
// (denetim K3): bu metodlar auth/oturum DEGIL, salt-okunur public listelerdir ve AuthController-
// private hicbir seye bagli degildir. Davranis BIREBIR korundu (yalnizca tasindi).
class LeaderboardController extends Controller
{
    // Liderlik tablosu: rating'e gore en iyi oyuncular (halka acik)
    public function leaderboard(Request $request)
    {
        $limit = min(100, max(1, (int) $request->query('limit', 100)));
        // Siralama kriteri: rating (varsayilan) | coins | wxp (cached users.total_wxp)
        $by = $request->query('by');
        $sortCol = $by === 'coins' ? 'coins' : ($by === 'wxp' ? 'total_wxp' : 'rating');
        // Liderlik tablosu TÜM bakanlar için AYNI (herkese açık, kimliksiz). Her poll'de full-table
        // filesort yerine 30sn önbellek: binlerce kullanıcıda tekrarlanan sıralama maliyetini keser.
        // online/status alanları ≤30sn bayatlar (presence penceresi 2dk -> kabul). (topRanks/roles ile aynı desen.)
        $rows = Cache::remember("leaderboard:{$sortCol}:{$limit}", 30, function () use ($sortCol, $limit) {
            $users = User::orderByDesc($sortCol)
                // Resmi/sistem hesabı ("Tavla TV Yönetim") liderlik tablosunda görünmesin.
                ->when(Schema::hasColumn('users', 'is_system'), fn ($q) => $q->where('is_system', false))
                ->notDeleted()
                ->orderByDesc('wins')
                ->limit($limit)
                // plan + plan_until -> plan_active accessor (premium rozeti/taç için).
                ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'coins', 'total_wxp', 'wins', 'losses', 'games_played', 'plan', 'plan_until', 'last_seen', 'presence_status', 'is_admin', 'is_support']);

            return $users->values()->map(function ($u, $i) {
                // Isim yani nokta: cevrimiciyse gercek durum (busy -> kirmizi), degilse 'offline' (gri).
                // 'ghost' (yönetici hayalet modu) de 'offline' gibi gri -> hiçbir yerde çevrimiçi görünmez.
                $online = $u->last_seen && ! in_array($u->presence_status, ['offline', 'ghost'], true)
                    && Carbon::parse($u->last_seen)->gt(now()->subMinutes(2));

                return [
                    'rank' => $i + 1,
                    'id' => $u->id,
                    'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
                    'avatar' => $u->avatar,
                    'frame' => $u->avatar_frame,
                    'country' => $u->country,
                    'rating' => $u->rating ?? 1500,
                    'coins' => $u->coins ?? 0,
                    'wxp' => $u->total_wxp ?? 0,
                    'wins' => $u->wins ?? 0,
                    'losses' => $u->losses ?? 0,
                    'games' => $u->games_played ?? 0,
                    'premium' => $u->plan_active !== 'free', // süresi geçerli ücretli plan -> taç
                    'is_admin' => (bool) $u->is_admin, // yönetici -> isim yanı kırmızı kalkan
                    'is_support' => (bool) $u->is_support, // destek -> isim yanı krem kalkan
                    'status' => $online ? ($u->presence_status ?: 'available') : 'offline',
                ];
            });
        });

        return response()->json(['players' => $rows]);
    }

    // Herkese acik: BIREYSEL DUELLO SIRALAMASI + takım düello sıralaması. 30sn cache (rating gibi).
    // individual: düello galibiyeti (duels.winner_id COUNT); teams: kazananın takımı toplamı.
    public function duelLeaderboard(Request $request)
    {
        $limit = min(100, max(1, (int) $request->query('limit', 100)));
        $data = Cache::remember("duel_leaderboard:{$limit}", 30, fn () => [
            'individual' => DuelService::individualLeaderboard($limit),
            'teams' => DuelService::teamLeaderboard($limit),
        ]);

        return response()->json($data);
    }

    // Herkese acik: PR SIRALAMASI (Career PR). Havuzlanmis PR (dusuk=iyi). Asgari maç + karar
    // sartini saglayan oyuncular; career_pr ASC (tam hassasiyet), esitlikte cok karar/maç önce.
    public function prLeaderboard(Request $request)
    {
        if (! Schema::hasColumn('users', 'career_pr')) {
            return response()->json(['players' => [], 'min_matches' => 0, 'min_decisions' => 0]);
        }
        $limit = min(100, max(1, (int) $request->query('limit', 10)));
        $minM = CareerPrService::minMatches();
        $minD = CareerPrService::minDecisions();

        // PR Sıralaması da herkese açık + viewer-bağımsız: 30sn önbellek (iki range filtre + career_pr
        // sort full-table filesort maliyetini tekrarlı poll'de keser). online ≤30sn bayatlar (kabul).
        $rows = Cache::remember("leaderboard:pr:{$minM}:{$minD}:{$limit}", 30, function () use ($minM, $minD, $limit) {
            $users = User::whereNotNull('career_pr')
                ->where('is_system', false) // resmi/sistem hesabı ("Tavla TV Yönetim") listede görünmesin
                ->notDeleted()
                ->where('career_pr_matches', '>=', $minM)
                ->where('career_pr_decisions', '>=', $minD)
                ->orderBy('career_pr', 'asc')                 // dusuk PR = iyi -> 1. sira
                ->orderByDesc('career_pr_decisions')          // esitlik: daha cok karar
                ->orderByDesc('career_pr_matches')            // sonra daha cok maç
                ->limit($limit)
                ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'career_pr', 'career_pr_matches', 'career_pr_decisions', 'plan', 'plan_until', 'last_seen', 'presence_status', 'is_admin', 'is_support']);

            return $users->values()->map(function ($u, $i) {
                $online = $u->last_seen && ! in_array($u->presence_status, ['offline', 'ghost'], true)
                    && Carbon::parse($u->last_seen)->gt(now()->subMinutes(2));

                return [
                    'rank' => $i + 1,
                    'id' => $u->id,
                    'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
                    'avatar' => $u->avatar,
                    'frame' => $u->avatar_frame,
                    'country' => $u->country,
                    'rating' => (int) $u->rating, // isim altindaki rutbe: site geneli TEK kaynak rating'dir (PR degil)
                    'career_pr' => $u->career_pr, // TAM hassasiyet (UI 2 ondalik gosterir; siralama full)
                    'matches' => (int) $u->career_pr_matches,
                    'decisions' => (int) $u->career_pr_decisions,
                    'premium' => $u->plan_active !== 'free',
                    'is_admin' => (bool) $u->is_admin, // yönetici -> isim yanı kırmızı kalkan
                    'is_support' => (bool) $u->is_support, // destek -> isim yanı krem kalkan
                    'status' => $online ? ($u->presence_status ?: 'available') : 'offline',
                ];
            });
        });

        return response()->json(['players' => $rows, 'min_matches' => $minM, 'min_decisions' => $minD]);
    }

    // Herkese acik: LIDERLIK ARAMASI. Ilk 100'de olmayan oyuncular kendini burada bulur.
    // Isme gore (nickname/first_name) eslesen oyuncular + GERCEK global siralari (rank).
    // by: rating|coins|wxp -> standart satir (LeaderRow); pr -> PR satiri (yalniz uygun oyuncular).
    public function leaderboardSearch(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['players' => []]); // en az 2 harf
        }
        // KELİME-BAŞI eşleşme (substring DEĞİL): "si" -> "Sinan"/"Selim Sinan" bulur ama
        // "Mehmet hulu-si"nin ortasını bulmaz (kullanıcı görünmeyen ada göre "rastgele" sonuç sanıyordu).
        $esc = str_replace(['%', '_'], ['\%', '\_'], $q); // LIKE joker karakterlerini kacir
        $pre = $esc.'%';      // adın/takma adın başı
        $mid = '% '.$esc.'%'; // ad içindeki sonraki kelimelerin başı ("... hulusi")
        $by = $request->query('by');
        $nameMatch = fn ($w) => $w->where('nickname', 'like', $pre)
            ->orWhere('first_name', 'like', $pre)->orWhere('first_name', 'like', $mid);

        if ($by === 'pr') {
            if (! Schema::hasColumn('users', 'career_pr')) {
                return response()->json(['players' => []]);
            }
            $minM = CareerPrService::minMatches();
            $minD = CareerPrService::minDecisions();
            $base = fn () => User::whereNotNull('career_pr')->where('is_system', false)->notDeleted()
                ->where('career_pr_matches', '>=', $minM)->where('career_pr_decisions', '>=', $minD);
            $users = $base()->where($nameMatch)->orderBy('career_pr', 'asc')->limit(15)
                ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'career_pr', 'career_pr_matches', 'career_pr_decisions', 'plan', 'plan_until', 'last_seen', 'presence_status', 'is_admin', 'is_support']);
            $rows = $users->map(function ($u) use ($base) {
                // ponytail: N+1 sira sayimi, sonuc <=15 -> onemsiz
                $rank = $base()->where('career_pr', '<', $u->career_pr)->count() + 1;
                $online = $u->last_seen && ! in_array($u->presence_status, ['offline', 'ghost'], true)
                    && Carbon::parse($u->last_seen)->gt(now()->subMinutes(2));

                return [
                    'rank' => $rank,
                    'id' => $u->id,
                    'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
                    'avatar' => $u->avatar,
                    'frame' => $u->avatar_frame,
                    'country' => $u->country,
                    'rating' => (int) $u->rating,
                    'career_pr' => $u->career_pr,
                    'matches' => (int) $u->career_pr_matches,
                    'decisions' => (int) $u->career_pr_decisions,
                    'premium' => $u->plan_active !== 'free',
                    'is_admin' => (bool) $u->is_admin,
                    'is_support' => (bool) $u->is_support,
                    'status' => $online ? ($u->presence_status ?: 'available') : 'offline',
                ];
            });

            return response()->json(['players' => $rows->values()]);
        }

        $sortCol = $by === 'coins' ? 'coins' : ($by === 'wxp' ? 'total_wxp' : 'rating');
        $users = User::where('is_system', false)->notDeleted()->where($nameMatch)
            ->orderByDesc($sortCol)->orderByDesc('wins')->limit(15)
            ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'coins', 'total_wxp', 'wins', 'losses', 'games_played', 'plan', 'plan_until', 'last_seen', 'presence_status', 'is_admin', 'is_support']);
        $rows = $users->map(function ($u) use ($sortCol) {
            // ponytail: N+1 sira sayimi, sonuc <=15 -> onemsiz. Rank = kendisinden ustte kac kisi var + 1.
            $rank = User::where('is_system', false)->notDeleted()->where($sortCol, '>', $u->{$sortCol})->count() + 1;
            $online = $u->last_seen && ! in_array($u->presence_status, ['offline', 'ghost'], true)
                && Carbon::parse($u->last_seen)->gt(now()->subMinutes(2));

            return [
                'rank' => $rank,
                'id' => $u->id,
                'name' => $u->nickname ?: $u->first_name ?: 'Oyuncu',
                'avatar' => $u->avatar,
                'frame' => $u->avatar_frame,
                'country' => $u->country,
                'rating' => $u->rating ?? 1500,
                'coins' => $u->coins ?? 0,
                'wxp' => $u->total_wxp ?? 0,
                'wins' => $u->wins ?? 0,
                'losses' => $u->losses ?? 0,
                'games' => $u->games_played ?? 0,
                'premium' => $u->plan_active !== 'free',
                'is_admin' => (bool) $u->is_admin,
                'is_support' => (bool) $u->is_support,
                'status' => $online ? ($u->presence_status ?: 'available') : 'offline',
            ];
        });

        return response()->json(['players' => $rows->values()]);
    }

    // Herkese acik: SITE GENELI top-3 rozet haritasi. PR sIralamasInda ilk 3 (madalya) +
    // Rating sIralamasInda ilk 3 (kupa) oyuncunun id+rank'i. Isim yanIndaki rozetler bunu
    // okur (frontend TopRanksProvider). Siralama kriterleri leaderboard/prLeaderboard ile
    // AYNI olmali ki #1 rozeti tablodaki #1 ile ortusssun. Kisa sureli cache (~120s) —
    // liste her istemcide gorunur, sik degismez.
    public function topRanks()
    {
        $data = Cache::remember('top_ranks_v1', 120, function () {
            // Rating: leaderboard ile ayni sira (rating DESC, wins DESC), ilk 3.
            $rating = User::where('is_system', false)->notDeleted() // resmi/sistem + silinmiş rozetlerde çıkmasın
                ->orderByDesc('rating')
                ->orderByDesc('wins')
                ->limit(3)
                ->pluck('id')
                ->values()
                ->map(fn ($id, $i) => ['id' => (int) $id, 'rank' => $i + 1])
                ->all();

            // PR: prLeaderboard ile ayni sira/esik (career_pr ASC + asgari mac/karar), ilk 3.
            $pr = [];
            if (Schema::hasColumn('users', 'career_pr')) {
                $pr = User::whereNotNull('career_pr')
                    ->where('is_system', false)->notDeleted() // resmi/sistem + silinmiş rozetlerde çıkmasın
                    ->where('career_pr_matches', '>=', CareerPrService::minMatches())
                    ->where('career_pr_decisions', '>=', CareerPrService::minDecisions())
                    ->orderBy('career_pr', 'asc')
                    ->orderByDesc('career_pr_decisions')
                    ->orderByDesc('career_pr_matches')
                    ->limit(3)
                    ->pluck('id')
                    ->values()
                    ->map(fn ($id, $i) => ['id' => (int) $id, 'rank' => $i + 1])
                    ->all();
            }

            return ['pr' => $pr, 'rating' => $rating];
        });

        return response()->json($data);
    }
}
