<?php

namespace App\Http\Controllers;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class TournamentController extends Controller
{
    // Acik + devam eden turnuvalar
    public function index()
    {
        \App\Console\Commands\TourneyBots::kick(); // test botlari (yalniz bot turnuvasi varsa)
        $this->autoStartDue(); // son katilim tarihi gelenleri baslat
        // Aktif (open/running) + BİTEN (finished) turnuvalar; biten GİZLENMEZ, frontend'de
        // "Geçmiş" başlığı altında gösterilir. Aktifler önce, biten sonra (her biri yeni->eski).
        $list = Tournament::whereIn('status', ['open', 'running', 'finished'])
            ->where('active', true) // pasif (yayindan kaldirilmis) turnuvalar sitede gorunmez
            ->with('organizer')
            ->orderByRaw("CASE WHEN status = 'finished' THEN 1 ELSE 0 END")
            ->orderByDesc('created_at')
            ->limit(60)
            ->get()
            ->map(fn ($t) => $this->summary($t));
        return response()->json(['tournaments' => $list]);
    }

    public function show(Request $request, Tournament $tournament)
    {
        \App\Console\Commands\TourneyBots::kick(); // test botlari (yalniz bot turnuvasi varsa)
        $this->autoStartDue(); // acilan turnuva zamani gectiyse burada da baslasin
        $t = $tournament->fresh();
        // CANLI POLL: istemci elindeki rev'i yollar; degismediyse 204 (detay ~80KB: avatarlar gomulu).
        if ((string) $request->query('rev', '') === self::rev($t)) {
            return response()->noContent();
        }

        return response()->json(['tournament' => $this->full($t)]);
    }

    /**
     * Suren maclarin CANLI izleyici sayilari: { counts: { ODA_KODU: n } }. Detay poll'u (rev)
     * izleyici degisimiyle tetiklenmez (~80KB tam veri) -> sayilar bu hafif ucla ayri cekilir.
     * Sayim RoomController::viewers ile ayni: son 15sn'de gorunen, oyuncu olmayan izleyiciler.
     */
    public function viewers(Tournament $tournament)
    {
        $codes = [];
        foreach (is_array($tournament->bracket) ? $tournament->bracket : [] as $round) {
            foreach (is_array($round) ? $round : [] as $m) {
                if (! empty($m['room']) && empty($m['winner'])) {
                    $codes[] = strtoupper((string) $m['room']);
                }
            }
        }
        if (! $codes || $tournament->status !== 'running' || ! \Illuminate\Support\Facades\Schema::hasTable('room_viewers')) {
            return response()->json(['counts' => (object) []]);
        }
        $counts = DB::table('room_viewers')
            ->whereIn('room_code', $codes)
            ->where('last_seen', '>=', microtime(true) - 15)
            ->groupBy('room_code')
            ->selectRaw('room_code, COUNT(*) as n')
            ->pluck('n', 'room_code')
            ->map(fn ($n) => (int) $n)
            ->all();

        return response()->json(['counts' => (object) $counts]);
    }

    /**
     * Turnuva sayfasi CANLI guncelleme surumu. Kayit acikken katilimcilara (katil/cik) bagli;
     * basladiktan sonra YALNIZ mac sonuclarina (kazananlar + sampiyon) -> mac odasi acilmasi /
     * tur uzunlugu yazimi gibi ara bracket degisiklikleri poll'u tetiklemez. Durum degisimi
     * (open -> running -> finished) her zaman yeni surumdur.
     */
    private static function rev(Tournament $t): string
    {
        $parts = [$t->status, (int) ($t->champion_id ?? 0)];
        if ($t->status === 'open') {
            $parts[] = collect($t->players ?? [])->filter()->pluck('id')->sort()->values()->all();
        } else {
            $winners = [];
            foreach (is_array($t->bracket) ? $t->bracket : [] as $round) {
                foreach (is_array($round) ? $round : [] as $m) {
                    $winners[] = ($m['key'] ?? '').':'.($m['winner'] ?? '');
                }
            }
            $parts[] = $winners;
        }

        return substr(md5(json_encode($parts)), 0, 12);
    }

    public function create(Request $request)
    {
        // Yalnizca yonetici turnuva olusturabilir
        if (! $request->user()->is_admin) {
            return $this->fail('Yalnızca yönetici turnuva oluşturabilir.', 403);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'type' => ['nullable', 'string', 'in:'.implode(',', array_keys(Tournament::TYPES))],
            'size' => ['required', 'integer', 'in:0,4,8,16,32,64,128,256'], // 0 = sinirsiz
            'prize_coins' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'prize_desc' => ['nullable', 'string', 'max:120'],
            'prizes' => ['nullable', 'array', 'max:64'],
            'prizes.*.coins' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'prizes.*.desc' => ['nullable', 'string', 'max:120'],
            'entry_fee' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'register_until' => ['nullable', 'date'],
            'premium_only' => ['nullable', 'boolean'], // varsayilan true (Premium'a ozel)
            'match_length' => ['nullable', 'integer', 'in:'.implode(',', Tournament::LENGTHS)],
            'semi_length' => ['nullable', 'integer', 'in:'.implode(',', Tournament::LENGTHS)],
            'final_length' => ['nullable', 'integer', 'in:'.implode(',', Tournament::LENGTHS)],
            'round_minutes' => ['nullable', 'integer', 'min:1', 'max:180'],
            'semi_minutes' => ['nullable', 'integer', 'min:1', 'max:180'],
            'final_minutes' => ['nullable', 'integer', 'min:1', 'max:180'],
        ]);
        $type = $data['type'] ?? 'bracket';
        if ($type === 'swiss_triple' && ! config('tournament.swiss.enabled', true)) {
            return $this->fail('3 Haklı Swiss şu an kapalı.', 422);
        }
        $t = Tournament::create([
            'name' => $data['name'],
            'type' => $type,
            'size' => $data['size'],
            'status' => 'open',
            'register_until' => $data['register_until'] ?? null,
            'creator_id' => $request->user()->id,
            'prize_coins' => $data['prize_coins'] ?? 0,
            'prize_desc' => $data['prize_desc'] ?? null,
            'prizes' => $data['prizes'] ?? null,
            'entry_fee' => $data['entry_fee'] ?? 0,
            'premium_only' => (bool) ($data['premium_only'] ?? true),
            'match_length' => $data['match_length'] ?? 1,
            'semi_length' => $data['semi_length'] ?? null,
            'final_length' => $data['final_length'] ?? null,
            'round_minutes' => $data['round_minutes'] ?? null,
            'semi_minutes' => $data['semi_minutes'] ?? null,
            'final_minutes' => $data['final_minutes'] ?? null,
            'players' => [],
        ]);
        // Olusturan otomatik katilir
        $this->addPlayer($t, $request->user());
        return response()->json(['tournament' => $this->full($t->fresh())]);
    }

    public function join(Request $request, Tournament $tournament)
    {
        $me = $request->user();
        $fee = $tournament->entry_fee ?? 0;
        // Katilim kapisi turnuva basina: premium_only ise yalniz Premium (eskiden route'ta EnsurePremium
        // TUM turnuvalara uygulanıyordu). Misafir buraya hic ulasmaz (auth:sanctum). Zaten kayitliysa
        // (plan sonradan dustu) idempotent join'i engelleme -> asagida addPlayer no-op.
        $alreadyIn = collect($tournament->players ?? [])->contains(fn ($p) => ($p['id'] ?? null) === $me->id);
        if ($tournament->premium_only && $me->plan_active === 'free' && ! $alreadyIn) {
            return response()->json([
                'message' => 'Bu turnuva Premium üyelere özeldir.',
                'code' => 'premium_required',
            ], 403);
        }

        // ATOMIK: turnuva satirini kilitle -> kapasite/kayit/ucret kontrolu tutarli
        // (cift katilim, cift ucret tahsili, eksi bakiye yaris korumasi).
        $out = DB::transaction(function () use ($tournament, $me, $fee) {
            $t = Tournament::lockForUpdate()->find($tournament->id);
            if (! $t || $t->status !== 'open') {
                return ['err' => 'Turnuva kayıtları kapalı.', 'code' => 422];
            }
            $players = $t->players ?? [];
            if ($t->size > 0 && count($players) >= $t->size) {
                return ['err' => 'Turnuva dolu.', 'code' => 422];
            }
            $already = false;
            foreach ($players as $p) {
                if (($p['id'] ?? null) === $me->id) {
                    $already = true;
                    break;
                }
            }
            if (! $already && $fee > 0) {
                $u = User::lockForUpdate()->find($me->id);
                // %-BAHİS KİLİDİ: oynanan bir % (bet_pct) maçta coin harcaması yasak (escrow'suz).
                if (\App\Models\Room::userInPctStakedPlaying($u->id)) {
                    return ['err' => 'Yüzde bahisli maçtayken coin harcayamazsın (turnuva ücreti). Maç bitince tekrar dene.', 'code' => 422];
                }
                // KULLANILABİLİR bakiye = coins - coins_reserved (escrow). Bahisli maçta rezerve
                // edilmiş coin turnuva ücretine harcanamaz (stake maç sonuna kadar kilitli).
                if ((($u->coins ?? 0) - ($u->coins_reserved ?? 0)) < $fee) {
                    return ['err' => 'Giriş ücreti için yetersiz coin.', 'code' => 422];
                }
                // Entry/leave cycles are legitimate. The player-list lock is
                // the idempotency guard, so do not reuse the tournament ID as
                // a unique ledger reference across multiple participations.
                app(\App\Services\WalletService::class)->debit($u, $fee, 'tournament_entry');
                $t->prize_coins = ($t->prize_coins ?? 0) + $fee;
                $t->save();
            }
            $added = $this->addPlayer($t, $me); // kilit altinda, idempotent
            if ($added) {
                \App\Models\UserStat::forUser($me->id)->increment('tournaments_played');
            }
            return ['ok' => true, 'added' => $added];
        });

        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
        // Basarim: turnuvaya katilim rozetleri (asla akisi kirmaz).
        if (! empty($out['added'])) {
            try {
                $me->unsetRelation('stat');
                app(\App\Services\Achievements\AchievementService::class)->evaluate($me);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Tournament join achievement failed', ['user_id' => $me->id, 'err' => $e->getMessage()]);
            }
        }
        // Turnuva DOLUNCA baslamaz; yalnizca son katilim tarihi + 1dk gecince
        // (autoStartDue) ya da admin panelden elle baslatilir.
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    // Turnuvadan CIK (yalniz kayit acikken). Giris ucreti IADE edilir (havuzdan dus).
    public function leave(Request $request, Tournament $tournament)
    {
        $me = $request->user();
        $out = DB::transaction(function () use ($tournament, $me) {
            $t = Tournament::lockForUpdate()->find($tournament->id);
            if (! $t) {
                return ['err' => 'Turnuva bulunamadı.', 'code' => 404];
            }
            if ($t->status !== 'open') {
                return ['err' => 'Turnuva başladı, çıkılamaz.', 'code' => 422];
            }
            $this->removeRegistered($t, $me->id); // idempotent: kayitli degilse no-op
            return ['ok' => true];
        });
        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    // Diskalifiye (yalniz yonetici): bir oyuncuyu turnuvadan cikar. Kayit acikken = iade + listeden
    // cikar. Turnuva baslamissa = hukmen: bekleyen mac rakibe walkover; Swiss'te durum 'dq' (ayri,
    // maglubiyet uydurmaz — contract §3/§10).
    public function disqualify(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yalnızca yönetici.', 403);
        }
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $uid = (int) $data['user_id'];
        $out = DB::transaction(function () use ($tournament, $uid) {
            $t = Tournament::lockForUpdate()->find($tournament->id);
            if (! $t) {
                return ['err' => 'Turnuva bulunamadı.', 'code' => 404];
            }
            if ($t->status === 'finished') {
                return ['err' => 'Turnuva bitti.', 'code' => 422];
            }
            if (! $this->isRegistered($t, $uid)) {
                return ['err' => 'Oyuncu turnuvada değil.', 'code' => 404];
            }
            if ($t->status === 'open') {
                $this->removeRegistered($t, $uid); // iade + cikar (baslamadan)
            } else {
                $this->exitRunningPlayer($t, $uid, 'dq');
            }
            return ['t' => $t];
        });
        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
        $this->awardChampionIfFinished($out['t']);
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    // Bir macin sonucunu bildir. GUVENLIK: istemcinin winner_id beyanina KORU KORUNE
    // guvenilmez (kaybeden kendini kazanan ilan edip odul coin'ini + ust turu calabilir).
    // Kazanan oncelikle macin oynandigi ODANIN YETKILI mac durumundan belirlenir; yetkili
    // durum yoksa (oda senkronu yok) akis bozulmasin diye beyana guvenilir. Boylece gercekten
    // uygulama icinde oynanan maclarda hizli/yalan beyanla odul calinamaz.
    public function report(Request $request, Tournament $tournament)
    {
        $data = $request->validate([
            'match' => ['required', 'string', 'max:16'],
            'winner_id' => ['required', 'integer'],
        ]);
        if ($tournament->status !== 'running') {
            return $this->fail('Turnuva aktif değil.', 422);
        }
        $me = $request->user()->id;

        // ATOMIK: turnuva satirini kilitle -> "sonuc zaten girildi" ve odul odemesi
        // yaris-guvenli (bracket bozulmasi + cift odul odemesi engellenir).
        $out = DB::transaction(function () use ($tournament, $data, $me) {
            $t = Tournament::lockForUpdate()->find($tournament->id);
            if (! $t || $t->status !== 'running') {
                return ['err' => 'Turnuva aktif değil.', 'code' => 422];
            }
            $bracket = $t->bracket;
            $found = null;
            foreach ($bracket as $ri => $round) {
                foreach ($round as $mi => $m) {
                    if ($m['key'] === $data['match']) {
                        $found = [$ri, $mi, $m];
                        break 2;
                    }
                }
            }
            if (! $found) {
                return ['err' => 'Maç bulunamadı.', 'code' => 404];
            }
            [$ri, $mi, $m] = $found;
            $ids = [$m['p1']['id'] ?? null, $m['p2']['id'] ?? null];
            if (! in_array($me, $ids, true)) {
                return ['err' => 'Bu maçta değilsin.', 'code' => 403];
            }
            if (! in_array($data['winner_id'], $ids, true)) {
                return ['err' => 'Geçersiz kazanan.', 'code' => 422];
            }
            if (! empty($m['winner'])) {
                return ['err' => 'Sonuç zaten girildi.', 'code' => 422];
            }

            // Sonuc yoksa istemci beyanina geri dusme.
            $winnerId = $this->winnerIdFromRoom($m);
            if ($winnerId === null || ! in_array($winnerId, $ids, true)) {
                return ['err' => 'Tamamlanmış sunucu maçı bulunamadı.', 'code' => 409];
            }

            $this->applyWinnerToBracket($t, $ri, $mi, $winnerId, $this->scoreFromRoom($m));
            return ['t' => $t];
        });

        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
        $this->awardChampionIfFinished($out['t']);
        return response()->json(['tournament' => $this->full($out['t']->fresh())]);
    }

    // Kazanani bracket'e yaz + bir ust tura tasiy VEYA final ise sampiyonu belirle + odul ode.
    // (report ve noShow ortak kullanir; cagiran ATOMIK transaction + lockForUpdate saglamali.)
    /**
     * Bitmis mac odasinin skoru, BRACKET oyuncu sirasina gore: ['p1' => x, 'p2' => y]. Oda koltugu
     * (p1=beyaz) ile bracket p1'i ayni kisi olmayabilir -> user_id ile eslenir.
     */
    private function scoreFromRoom(array $m): ?array
    {
        $room = ! empty($m['room']) ? \App\Models\Room::where('code', $m['room'])->first() : null;
        $score = $room && is_array($room->server_match) ? ($room->server_match['score'] ?? null) : null;
        if (! is_array($score)) {
            return null;
        }
        $colorOf = fn ($uid) => (int) $uid === (int) $room->p1_user_id ? 'white' : 'black';

        return [
            'p1' => (int) ($score[$colorOf($m['p1']['id'] ?? 0)] ?? 0),
            'p2' => (int) ($score[$colorOf($m['p2']['id'] ?? 0)] ?? 0),
        ];
    }

    private function applyWinnerToBracket(Tournament $t, int $ri, int $mi, int $winnerId, ?array $score = null): void
    {
        // 3 HAKLI SWISS: eleme ağacı yerine Swiss motoru işler (haklar/eleme/tur üretimi/sonlandırma).
        // report/reconcile/noShow bu ortak metottan geçtiği için tek dal yeterli. realMatch: hükmen
        // (walkover/bye/stalled) değilse gerçek maç.
        if (\App\Support\Swiss\SwissRuntime::isSwiss($t)) {
            $real = ! ($score && (isset($score['walkover']) || isset($score['bye']) || isset($score['stalled'])));
            \App\Support\Swiss\SwissRuntime::applyResult($t, $ri, $mi, $winnerId, $score, $real);

            return;
        }
        $bracket = $t->bracket;
        $m = $bracket[$ri][$mi];
        $bracket[$ri][$mi]['winner'] = $winnerId;
        if ($score !== null) {
            $bracket[$ri][$mi]['score'] = $score; // {p1,p2} veya {walkover:true} (bracket gosterir)
        }
        $winner = ($m['p1']['id'] ?? null) === $winnerId ? $m['p1'] : $m['p2'];
        $loser = ($m['p1']['id'] ?? null) === $winnerId ? ($m['p2'] ?? null) : ($m['p1'] ?? null);

        if (! empty($m['third_place'])) {
            // 3.'LÜK MAÇI bitti -> FINAL 1 DK SONRA açılır (önce 3.'lük, sonra final). opens_at final
            // maçına yazılır (matchRoom gate + frontend uyarısı/geri sayımı okur). Sıralama/ödül
            // maybeFinalize'da (final + 3.'lük ikisi de bitince) verilir.
            $lastRi = count($bracket) - 1;
            if (isset($bracket[$lastRi][0]) && empty($bracket[$lastRi][0]['winner'])) {
                $bracket[$lastRi][0]['opens_at'] = now()->addMinute()->toIso8601String();
            }
            $t->bracket = $bracket;
        } elseif (isset($bracket[$ri + 1])) {
            $nextIndex = intdiv($mi, 2);
            $slot = $mi % 2 === 0 ? 'p1' : 'p2';
            $bracket[$ri + 1][$nextIndex][$slot] = $winner;
            // YARI FINAL (üst tur = SON tur = final) -> kaybedeni 3.'lük maçına yerleştir. Bye maçında
            // gerçek kaybeden yok (null) -> yazılmaz; iki yarı final de bitince tek-oyunculu 3.'lük
            // walkover ile çözülür (final o durumda beklemeden açılır).
            if ($ri + 1 === count($bracket) - 1) {
                if ($loser && isset($loser['id'])) {
                    $bracket = $this->placeThirdPlaceLoser($bracket, $mi, $loser);
                }
                $bracket = $this->maybeResolveThirdPlaceWalkover($bracket);
            }
            $t->bracket = $bracket;
        } else {
            // FINAL bitti -> şampiyon belli. status/ödül maybeFinalize'da (3.'lük maçı da bitmeli).
            $t->champion_id = $winnerId;
            $t->bracket = $bracket;
        }

        $this->maybeFinalize($t);
        $t->save();
    }

    /** Yarı final kaybedenini SON turdaki 3.'lük maçına (index 1) koy; maç yoksa oluştur. */
    private function placeThirdPlaceLoser(array $bracket, int $semiMi, array $loser): array
    {
        $lastRi = count($bracket) - 1;
        if (! isset($bracket[$lastRi][1])) {
            $bracket[$lastRi][1] = ['key' => "r{$lastRi}m1", 'third_place' => true, 'p1' => null, 'p2' => null, 'winner' => null];
        }
        $slot = $semiMi % 2 === 0 ? 'p1' : 'p2';
        $bracket[$lastRi][1][$slot] = $loser;

        return $bracket;
    }

    /**
     * İki yarı final de bittiğinde (final iki oyuncuyla dolu) 3.'lük maçı TEK oyunculuysa (karşı yarı
     * final bye idi) o oyuncu walkover ile 3. olur -> gerçek maç yok, final BEKLEMEDEN açılır (opens_at
     * yazılmaz). İki oyunculu 3.'lükte dokunmaz (oynanır; bitince final opens_at gate'lenir).
     */
    private function maybeResolveThirdPlaceWalkover(array $bracket): array
    {
        $lastRi = count($bracket) - 1;
        $tp = $bracket[$lastRi][1] ?? null;
        $final = $bracket[$lastRi][0] ?? null;
        if (! $tp || empty($tp['third_place']) || ! empty($tp['winner'])) {
            return $bracket;
        }
        $bothSemisDone = ! empty($final['p1']['id']) && ! empty($final['p2']['id']);
        if (! $bothSemisDone) {
            return $bracket;
        }
        $has1 = ! empty($tp['p1']['id']);
        $has2 = ! empty($tp['p2']['id']);
        if ($has1 !== $has2) { // tek oyunculu -> walkover 3.
            $tp['winner'] = $has1 ? (int) $tp['p1']['id'] : (int) $tp['p2']['id'];
            $tp['score'] = ['walkover' => true];
            $bracket[$lastRi][1] = $tp; // opens_at YOK -> final hemen açılır
        } elseif ($has1 && $has2 && empty($tp['ready_at'])) {
            // İki oyunculu 3.'lük HAZIR -> damga (takılma-önleme resolveStalledThirdPlace bunu kullanır).
            $tp['ready_at'] = now()->toIso8601String();
            $bracket[$lastRi][1] = $tp;
        }

        return $bracket;
    }

    /**
     * TAKILMA ÖNLEME (kritik): 3.'lük maçına İKİ oyuncu geldi ama KİMSE odayı açmadı (consolation
     * maçını umursamadılar) -> final sonsuza dek gate'li kalır = turnuva takılır. ready_at'ten
     * STALL_MIN dk geçtiyse ve oda HİÇ açılmadıysa 3.'yü RATING ile belirle (yüksek rating 3.) ->
     * final AÇILIR (opens_at yok = beklemeden). Oda açıldıysa dokunma: room presence/timeout/noShow
     * zaten sonuç üretir (reconcileVerifiedResults alır). Değişiklik olduysa true.
     */
    private function resolveStalledThirdPlace(Tournament $t): bool
    {
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        $lastRi = count($bracket) - 1;
        $tp = $bracket[$lastRi][1] ?? null;
        if (! $tp || empty($tp['third_place']) || ! empty($tp['winner'])) {
            return false;
        }
        if (empty($tp['p1']['id']) || empty($tp['p2']['id']) || ! empty($tp['room'])) {
            return false; // henüz iki oyuncu yok VEYA oda açıldı (room mekanizması halleder)
        }
        $readyAt = $tp['ready_at'] ?? null;
        $stall = (int) config('tournament.third_place_stall_minutes', 3);
        if (! $readyAt || now()->lt(\Illuminate\Support\Carbon::parse($readyAt)->addMinutes($stall))) {
            return false;
        }
        $r1 = (int) ($tp['p1']['rating'] ?? 0);
        $r2 = (int) ($tp['p2']['rating'] ?? 0);
        $tp['winner'] = $r1 >= $r2 ? (int) $tp['p1']['id'] : (int) $tp['p2']['id'];
        $tp['score'] = ['stalled' => true];
        $bracket[$lastRi][1] = $tp; // opens_at yok -> final beklemeden açılır
        $t->bracket = $bracket;
        $t->save();

        return true;
    }

    /**
     * TAKILMA ÖNLEME (genel): iki oyuncusu belli HERHANGİ bir eleme maçına kimse (ya da tek taraf)
     * gelmezse turnuva sonsuza dek "kazanansız" takılırdı (noShow gelen oyuncunun elle tetiklemesine
     * bağlı; ikisi de gelmezse çözen yok). Maç HAZIR (iki oyuncu belli) işaretlenir (ready_at); oda
     * doğrulanmış sonuç üretmeden match_stall_minutes dk geçerse sunucu çözer:
     *   - TEK taraf odaya girdiyse -> giren hükmen kazanır (otomatik walkover + gelmeyene ForfeitLoss).
     *   - KİMSE girmediyse (gerçek çift no-show) -> rating ile ilerlet (stalled 3.'lük ile tutarlı).
     * İKİ taraf da odadaysa (maç oynanıyor, uzun sürebilir) DOKUNMAZ: oyun saati/presence/report halleder.
     * 3.'lük maçı hariç (resolveStalledThirdPlace sahibi). Cagiran turnuva satirini KILITLER.
     */
    private function resolveStalledMatches(Tournament $t): bool
    {
        if (\App\Support\Swiss\SwissRuntime::isSwiss($t)) {
            return false; // Swiss kendi gelme/eleme akışını işler
        }
        $stall = (int) config('tournament.match_stall_minutes', 3);
        $changed = false;
        for ($guard = 0; $guard < 64 && $t->status === 'running'; $guard++) {
            $bracket = is_array($t->bracket) ? $t->bracket : [];
            $hit = null;
            foreach ($bracket as $ri => $round) {
                foreach ($round as $mi => $m) {
                    if (! empty($m['winner']) || ! empty($m['third_place'])) {
                        continue; // bitmiş VEYA 3.'lük (resolveStalledThirdPlace halleder)
                    }
                    if (empty($m['p1']['id']) || empty($m['p2']['id'])) {
                        continue; // iki oyuncu belli değil (bye/ölü dal -> resolveDeadByes)
                    }
                    // Final gate (opens_at) henüz açılmadıysa süre işlemesin (önce 3.'lük oynanır).
                    if (! empty($m['opens_at']) && now()->lt(\Illuminate\Support\Carbon::parse($m['opens_at']))) {
                        continue;
                    }
                    $room = ! empty($m['room']) ? \App\Models\Room::where('code', $m['room'])->first() : null;
                    if ($room && $room->hasVerifiedServerResult()) {
                        continue; // gerçek sonuç var -> reconcileVerifiedResults alır
                    }
                    $id1 = (int) $m['p1']['id'];
                    $id2 = (int) $m['p2']['id'];
                    $present = [];
                    if ($room) {
                        foreach (['p1', 'p2'] as $s) {
                            if (! empty($room->{$s.'_token'}) && (int) $room->{$s.'_user_id'}) {
                                $present[] = (int) $room->{$s.'_user_id'};
                            }
                        }
                    }
                    $present = array_values(array_intersect([$id1, $id2], $present));
                    if (count($present) >= 2) {
                        continue; // iki taraf da odada -> oynanıyor; saat/presence/report halleder
                    }
                    $readyAt = $m['ready_at'] ?? null;
                    if (! $readyAt) {
                        // İlk kez HAZIR görüldü -> damgala (süre şimdi başlar). Bu turda çözme.
                        $bracket[$ri][$mi]['ready_at'] = now()->toIso8601String();
                        $t->bracket = $bracket;
                        $t->save();
                        $changed = true;

                        continue;
                    }
                    if (now()->lt(\Illuminate\Support\Carbon::parse($readyAt)->addMinutes($stall))) {
                        continue; // süre dolmadı
                    }
                    $hit = [$ri, $mi, $m, $room, $present, $id1, $id2];
                    break 2;
                }
            }
            if (! $hit) {
                break;
            }
            [$ri, $mi, $m, $room, $present, $id1, $id2] = $hit;
            if (count($present) === 1) {
                // TEK taraf geldi -> hükmen (otomatik; gelen oyuncu "no-show"a basmasa da).
                $winnerId = $present[0];
                $loserId = $winnerId === $id1 ? $id2 : $id1;
                if ($room) {
                    $wslot = (int) $room->p1_user_id === $winnerId ? 'p1' : 'p2';
                    $room->status = 'finished';
                    $room->end_reason = 'NO_SHOW';
                    $room->{$wslot.'_result'} = 'won';
                    $room->{($wslot === 'p1' ? 'p2' : 'p1').'_result'} = 'lost';
                    $room->save();
                    $w = User::find($winnerId);
                    \App\Support\ForfeitLoss::record(
                        $room->code, $loserId, (int) ($w->rating ?? 1500),
                        (int) ($room->target ?: 1), 'match', $w->nickname ?? $w->first_name,
                    );
                }
                $this->applyWinnerToBracket($t, $ri, $mi, $winnerId, ['walkover' => true]);
            } else {
                // KİMSE gelmedi (çift no-show) -> rating ile ilerlet (stalled 3.'lük ile tutarlı).
                $r1 = (int) ($m['p1']['rating'] ?? 0);
                $r2 = (int) ($m['p2']['rating'] ?? 0);
                $this->applyWinnerToBracket($t, $ri, $mi, $r1 >= $r2 ? $id1 : $id2, ['no_show' => true]);
            }
            $changed = true;
        }

        return $changed;
    }

    /**
     * Turnuvayı SONLANDIR: şampiyon (final) BELLİ ve 3.'lük maçı da (varsa) çözülmüşse status='finished'
     * + ödüller. 3.'lük maçı tek oyunculu kaldıysa (diğer yarı final bye idi) walkover ile 3. olur.
     * Final ile 3.'lük paralel oynanır; hangisi önce biterse bitsin turnuva İKİSİ de bitince kapanır.
     */
    private function maybeFinalize(Tournament $t): void
    {
        if ($t->status === 'finished' || ! $t->champion_id) {
            return;
        }
        $bracket = $t->bracket;
        $lastRi = count($bracket) - 1;
        $tp = $bracket[$lastRi][1] ?? null;
        if ($tp && ! empty($tp['third_place']) && empty($tp['winner'])) {
            $has1 = ! empty($tp['p1']['id']);
            $has2 = ! empty($tp['p2']['id']);
            if ($has1 && $has2) {
                return; // 3.'lük maçı henüz oynanmadı -> finalize etme (turnuva 'running' kalır)
            }
            // Tek oyunculu 3.'lük (karşı yarı final bye idi) -> o oyuncu walkover ile 3.
            if ($has1 !== $has2) {
                $tp['winner'] = $has1 ? (int) $tp['p1']['id'] : (int) $tp['p2']['id'];
                $tp['score'] = ['walkover' => true];
                $bracket[$lastRi][1] = $tp;
                $t->bracket = $bracket;
            }
            // İkisi de boş (imkânsız: final iki oyuncu istiyor) -> 3.'lük yok say, finalize et.
        }
        $t->status = 'finished';
        if (! $t->prize_paid) {
            $this->payPrizes($t, $t->bracket, (int) $t->champion_id);
            $t->prize_paid = true;
        }
    }

    // Turnuva bittiyse sampiyona galibiyet rozetleri (idempotent). tournaments_won
    // sayaci champion_id sayimindan yeniden kurulur (cift-artis olmaz).
    private function awardChampionIfFinished(Tournament $t): void
    {
        if ($t->status !== 'finished' || ! $t->champion_id) {
            return;
        }
        try {
            $champ = User::find($t->champion_id);
            if ($champ) {
                $stat = \App\Models\UserStat::forUser($champ->id);
                $stat->tournaments_won = Tournament::where('champion_id', $champ->id)->where('status', 'finished')->count();
                $stat->save();
                $champ->unsetRelation('stat');
                app(\App\Services\Achievements\AchievementService::class)->evaluate($champ);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Tournament champion achievement failed', ['tournament_id' => $t->id, 'err' => $e->getMessage()]);
        }
    }

    // Rakip GELMEDI -> hukmen (walkover) kazan. Oda acildiktan 60sn sonra, rakip odaya
    // HIC girmemisse (slot token'i bos) cagiran oyuncu maci hukmen kazanir; bracket ilerler.
    public function noShow(Request $request, Tournament $tournament)
    {
        $data = $request->validate([
            'match' => ['required', 'string', 'max:16'],
            'token' => ['required', 'string', 'max:64'], // oda kimligi (slot tespiti)
        ]);
        if ($tournament->status !== 'running') {
            return $this->fail('Turnuva aktif değil.', 422);
        }
        $actor = $request->user();
        $me = $actor->id;

        $out = DB::transaction(function () use ($tournament, $data, $me, $actor) {
            $t = Tournament::lockForUpdate()->find($tournament->id);
            if (! $t || $t->status !== 'running') {
                return ['err' => 'Turnuva aktif değil.', 'code' => 422];
            }
            $found = null;
            foreach ($t->bracket as $ri => $round) {
                foreach ($round as $mi => $m) {
                    if ($m['key'] === $data['match']) {
                        $found = [$ri, $mi, $m];
                        break 2;
                    }
                }
            }
            if (! $found) {
                return ['err' => 'Maç bulunamadı.', 'code' => 404];
            }
            [$ri, $mi, $m] = $found;
            $ids = [$m['p1']['id'] ?? null, $m['p2']['id'] ?? null];
            if (! in_array($me, $ids, true)) {
                return ['err' => 'Bu maçta değilsin.', 'code' => 403];
            }
            if (! empty($m['winner'])) {
                return ['err' => 'Sonuç zaten girildi.', 'code' => 422];
            }
            $code = $m['room'] ?? null;
            if (! $code) {
                return ['err' => 'Maç odası henüz açılmadı.', 'code' => 422];
            }
            $room = \App\Models\Room::where('code', $code)->first();
            if (! $room) {
                return ['err' => 'Maç odası bulunamadı.', 'code' => 422];
            }
            // 60sn gelmeme suresi: oda olusturuldugundan (ilk giren) bu yana gecmeli.
            if ($room->created_at && $room->created_at->gt(now()->subSeconds(60))) {
                return ['err' => 'Rakip için bekleme süresi (1 dk) dolmadı.', 'code' => 422];
            }
            // Bracket uyeligi yetmez: odadaki koltuk da ayni hesaba ait olmali.
            $slot = \App\Support\RoomAccess::slot($room, $actor, $data['token']);
            if ($slot === null || (int) $room->{$slot.'_user_id'} !== (int) $me) {
                return ['err' => 'Bu odada değilsin.', 'code' => 403];
            }
            $other = $slot === 'p1' ? 'p2' : 'p1';
            // GERCEK no-show: rakip odaya HIC girmemis (slot token bos). Girdiyse hukmen YOK
            // (oynasinlar; saat/presence halleder) -> yanlis walkover engellenir.
            if (! empty($room->{$other.'_token'})) {
                return ['err' => 'Rakip odaya girdi; hükmen kazanamazsın.', 'code' => 422];
            }

            $this->applyWinnerToBracket($t, $ri, $mi, $me, ['walkover' => true]);
            // Odayi da kapat (temiz sonuc).
            $room->status = 'finished';
            $room->end_reason = 'NO_SHOW';
            $room->{$slot.'_result'} = 'won';
            $room->{$other.'_result'} = 'lost';
            $room->save();

            // GELMEYEN KAYBEDER (sunucu kayit): gelmeyen rakibin rating + maglubiyeti
            // sunucuda yazilir (client'i hic acilmadi). Idempotent (bkz ForfeitLoss).
            $loserId = (int) ($ids[0] === $me ? $ids[1] : $ids[0]);
            $me = \App\Models\User::find($me);
            \App\Support\ForfeitLoss::record(
                $room->code, $loserId, (int) ($me->rating ?? 1500),
                (int) ($room->target ?: 1), 'match', $me->nickname ?? $me->first_name,
            );

            return ['t' => $t];
        });

        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
        $this->awardChampionIfFinished($out['t']);
        return response()->json(['tournament' => $this->full($out['t']->fresh())]);
    }

    // Bir turnuva maci icin paylasimli oda kodu (bir kez uretilir, bracket'e saklanir)
    public function matchRoom(Request $request, Tournament $tournament)
    {
        $data = $request->validate(['match' => ['required', 'string', 'max:16']]);
        if ($tournament->status !== 'running') {
            return $this->fail('Turnuva aktif değil.', 422);
        }
        $me = $request->user()->id;
        $bracket = $tournament->bracket;
        foreach ($bracket as $ri => $round) {
            foreach ($round as $mi => $m) {
                if ($m['key'] !== $data['match']) {
                    continue;
                }
                $ids = [$m['p1']['id'] ?? null, $m['p2']['id'] ?? null];
                if (! in_array($me, $ids, true)) {
                    return $this->fail('Bu maçta değilsin.', 403);
                }
                if (! empty($m['winner'])) {
                    return $this->fail('Maç bitti.', 422);
                }
                $isSwiss = \App\Support\Swiss\SwissRuntime::isSwiss($tournament);
                // FINAL GATE (yalnız eleme ağacı): önce 3.'lük maçı oynanır; final 3.'lük bitip 1 dk
                // geçince açılır. Swiss'te 3.'lük maçı YOK -> gate atlanır.
                $isFinalMatch = ! $isSwiss && $ri === count($bracket) - 1 && empty($m['third_place']);
                if ($isFinalMatch) {
                    $tp = $bracket[$ri][1] ?? null;
                    if ($tp && ! empty($tp['third_place'])) {
                        if (empty($tp['winner'])) {
                            return $this->fail('Önce üçüncülük maçı oynanmalı.', 422);
                        }
                        $opensAt = $m['opens_at'] ?? null;
                        if ($opensAt && now()->lt(\Illuminate\Support\Carbon::parse($opensAt))) {
                            $sec = max(1, now()->diffInSeconds(\Illuminate\Support\Carbon::parse($opensAt)));
                            return $this->fail("Final, üçüncülük maçından sonra başlar ({$sec} sn).", 422);
                        }
                    }
                }
                // Bu maçın uzunluğu/süresi. Swiss'te hücreye tur üretiminde yazılmıştır (normal/final-iki);
                // eleme ağacında roundTarget/roundMinutes ile hesaplanır (3.'lük -> yarı final uzunluğu).
                if ($isSwiss) {
                    $target = (int) ($m['target'] ?? ($tournament->match_length ?: 1));
                    $minutes = isset($m['minutes']) ? ($m['minutes'] !== null ? (int) $m['minutes'] : null) : null;
                } else {
                    $lenRi = ! empty($m['third_place']) ? max(0, count($bracket) - 2) : $ri;
                    $target = $tournament->roundTarget($lenRi, count($bracket));
                    $minutes = $tournament->roundMinutes($lenRi, count($bracket));
                }
                $bracket[$ri][$mi]['target'] = $target;
                $bracket[$ri][$mi]['minutes'] = $minutes;
                // Onceki oda KAZANANSIZ kapandiysa (sonucsuz: ilk hamleden once sure doldu vb.) mac
                // hic bildirilemez -> bracket sonsuza dek takilirdi. Yeni oda ac, mac yeniden oynansin.
                if (! empty($m['room'])) {
                    $old = \App\Models\Room::where('code', $m['room'])->first();
                    if ($old && $old->status === 'finished' && ! $old->hasVerifiedServerResult()) {
                        $m['room'] = null;
                    }
                }
                if (empty($m['room'])) {
                    // Benzersiz kod uret
                    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    do {
                        $code = '';
                        for ($i = 0; $i < 5; $i++) {
                            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
                        }
                    } while (\App\Models\Room::where('code', $code)->exists());
                    $bracket[$ri][$mi]['room'] = $code;
                }
                if ($bracket !== $tournament->bracket) {
                    $tournament->bracket = $bracket;
                    $tournament->save();
                }
                Cache::put(self::roomTargetKey($bracket[$ri][$mi]['room']), $target, now()->addDays(2));
                if ($minutes) {
                    Cache::put(self::roomClockKey($bracket[$ri][$mi]['room']), $minutes, now()->addDays(2));
                }
                return response()->json(['code' => $bracket[$ri][$mi]['room'], 'target' => $target]);
            }
        }
        return $this->fail('Maç bulunamadı.', 404);
    }

    // Turnuvayi bitir (yalnizca yonetici)
    public function finish(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yalnızca yönetici.', 403);
        }
        $tournament->status = 'finished';
        $tournament->save();
        return response()->json(['tournament' => $this->full($tournament)]);
    }

    // Turnuvayi elle baslat (sinirsiz turnuvalar icin; yalnizca yonetici)
    public function start(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yalnızca yönetici.', 403);
        }
        if ($tournament->status !== 'open') {
            return $this->fail('Turnuva zaten başladı.', 422);
        }
        if (count($tournament->players ?? []) < 2) {
            return $this->fail('En az 2 oyuncu gerekli.', 422);
        }
        $this->startBracket($tournament);
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    // Turnuvayi sil (yalnizca yonetici)
    public function destroy(Request $request, Tournament $tournament)
    {
        if (! $request->user()?->is_admin) {
            return $this->fail('Yalnızca yönetici.', 403);
        }
        $tournament->delete();
        return $this->ok();
    }

    /* ---------- yardimcilar ---------- */

    // Bracket oyuncularinin tamamlanmis canonical odasi; isim veya client state fallback yok.
    private function winnerIdFromRoom(array $m): ?int
    {
        $code = $m['room'] ?? null;
        if (! $code) {
            return null;
        }
        $room = \App\Models\Room::where('code', $code)->lockForUpdate()->first();
        if (! $room || $room->bot || ! $room->hasVerifiedServerResult()) {
            return null;
        }
        $players = [(int) ($m['p1']['id'] ?? 0), (int) ($m['p2']['id'] ?? 0)];
        $seats = [(int) $room->p1_user_id, (int) $room->p2_user_id];
        sort($players);
        sort($seats);
        if ($players[0] <= 0 || $players[0] === $players[1] || $players !== $seats) {
            return null;
        }

        return $room->server_match['winner'] === 'white'
            ? (int) $room->p1_user_id : (int) $room->p2_user_id;
    }

    // Odul dagitimi: siralamaya gore coin ode. prizes tablosu (index=sira-1) varsa
    // her siraya kendi coin'ini ver + giris ucreti havuzunu (prize_coins) sampiyona ekle.
    // prizes yoksa eski davranis: tek sampiyon odulu (prize_coins).
    private function payPrizes(Tournament $t, array $bracket, int $winnerId): void
    {
        $prizes = is_array($t->prizes) ? $t->prizes : [];
        $pool = (int) ($t->prize_coins ?? 0); // giris ucretleri burada birikir

        if (! empty($prizes)) {
            $standings = $this->standingsFromBracket($bracket);
            foreach ($prizes as $i => $pr) {
                $coins = (int) ($pr['coins'] ?? 0);
                if ($coins > 0 && isset($standings[$i])) {
                    $winner = User::lockForUpdate()->find($standings[$i]);
                    if ($winner) {
                        app(\App\Services\WalletService::class)->credit($winner, $coins, 'tournament_prize', Tournament::class, $t->id);
                    }
                }
            }
            // Giris ucreti havuzu -> 1.lige (sampiyon)
            if ($pool > 0) {
                $first = $standings[0] ?? $winnerId;
                $winner = User::lockForUpdate()->find($first);
                if ($winner) {
                    app(\App\Services\WalletService::class)->credit($winner, $pool, 'tournament_pool_prize', Tournament::class, $t->id);
                }
            }
            return;
        }

        // Eski akis: prizes tablosu yoksa tum havuz sampiyona
        if ($pool > 0) {
            $winner = User::lockForUpdate()->find($winnerId);
            if ($winner) {
                app(\App\Services\WalletService::class)->credit($winner, $pool, 'tournament_pool_prize', Tournament::class, $t->id);
            }
        }
    }

    // Bracket'ten nihai siralamayi (oyuncu id'leri, 1.den sonuncuya) cikar.
    // 1. = final kazanani; sonra son turdan ilk tura dogru her turun KAYBEDENLERI
    // eklenir (gec turda elenen daha ustte). Ayni turdakiler rating'e gore siralanir.
    private function standingsFromBracket(array $bracket): array
    {
        if (empty($bracket)) {
            return [];
        }
        $lastRi = count($bracket) - 1;
        $final = $bracket[$lastRi][0] ?? null;
        $championId = isset($final['winner']) ? (int) $final['winner'] : null;

        $standings = [];
        if ($championId) {
            $standings[] = $championId; // 1.
        }
        // 2. = final kaybedeni
        if ($final && $championId && isset($final['p1']['id'], $final['p2']['id'])) {
            $ru = (int) $final['p1']['id'] === $championId ? $final['p2'] : $final['p1'];
            if (isset($ru['id'])) {
                $standings[] = (int) $ru['id'];
            }
        }
        // 3./4. = 3.'LÜK MAÇI sonucu (varsa+bittiyse). Yoksa eski davranış: yarı final kaybedenleri
        // rating'e göre (aşağıdaki döngü). $startRi döngünün başlayacağı tur (yarı final = lastRi-1).
        $tp = $bracket[$lastRi][1] ?? null;
        $startRi = $lastRi - 1;
        if ($tp && ! empty($tp['third_place']) && ! empty($tp['winner'])) {
            $tw = (int) $tp['winner'];
            $standings[] = $tw; // 3.
            if (isset($tp['p1']['id'], $tp['p2']['id'])) {
                $tl = (int) $tp['p1']['id'] === $tw ? (int) $tp['p2']['id'] : (int) $tp['p1']['id'];
                $standings[] = $tl; // 4.
            }
            $startRi = $lastRi - 2; // 3./4. yazıldı -> yarı finalleri atla
        }
        // Kalan turların kaybedenleri (rating azalan). Son tur (final + 3.'lük) yukarıda ele alındı.
        for ($ri = $startRi; $ri >= 0; $ri--) {
            $losers = [];
            foreach ($bracket[$ri] as $m) {
                if (! empty($m['third_place'])) {
                    continue; // 3.'lük maçı ayrı ele alındı
                }
                $w = $m['winner'] ?? null;
                $p1 = $m['p1'] ?? null;
                $p2 = $m['p2'] ?? null;
                if (! $w || ! isset($p1['id'], $p2['id'])) {
                    continue; // Bye/yarim mac: kaybeden yok
                }
                $loser = ((int) $p1['id'] === (int) $w) ? $p2 : $p1;
                if (isset($loser['id'])) {
                    $losers[] = $loser;
                }
            }
            usort($losers, fn ($a, $b) => ($b['rating'] ?? 0) <=> ($a['rating'] ?? 0));
            foreach ($losers as $l) {
                $standings[] = (int) $l['id'];
            }
        }
        return array_values(array_unique($standings));
    }

    private function addPlayer(Tournament $t, $user): bool
    {
        $players = $t->players ?? [];
        foreach ($players as $p) {
            if (($p['id'] ?? null) === $user->id) {
                return false; // zaten kayitli
            }
        }
        $players[] = [
            'id' => $user->id,
            'name' => $user->nickname ?: $user->first_name ?: 'Oyuncu',
            'rating' => $user->rating ?? 1500,
            'avatar' => $user->avatar,
            'premium' => $user->plan_active !== 'free', // kayıt anındaki premium (snapshot)
        ];
        $t->players = $players;
        $t->save();
        return true;
    }

    // Kullanici bu turnuvaya kayitli mi? (ortak kaynak: TournamentModeration)
    private function isRegistered(Tournament $t, int $uid): bool
    {
        return \App\Support\TournamentModeration::isRegistered($t, $uid);
    }

    // Kayit acikken oyuncuyu listeden cikar + giris ucreti iadesi (leave + open-dq ortak). Idempotent.
    // Ortak kaynak: TournamentModeration (Filament paneli de ayni mantigi kullanir). Lock cagiranda.
    private function removeRegistered(Tournament $t, int $uid): void
    {
        \App\Support\TournamentModeration::removeRegistered($t, $uid);
    }

    // Turnuva SURERKEN oyuncuyu cikar (withdraw/dq). open/Swiss ortak serviste (TournamentModeration::
    // remove: Swiss durum isaretle + bekleyen maci walkover + ilerlet/sonlandir). Eleme agaci (running)
    // burada: bekleyen maci rakibe walkover (bracket advancement controller'a ozel). Lock cagiranda.
    private function exitRunningPlayer(Tournament $t, int $uid, string $mode): void
    {
        if (\App\Support\TournamentModeration::remove($t, $uid, $mode)) {
            return; // open veya Swiss ele alindi
        }
        // Eleme agaci: bekleyen (kazanansiz) macini bul -> rakibe hukmen. Yoksa (zaten elenmis) no-op.
        $bracket = is_array($t->bracket) ? $t->bracket : [];
        foreach ($bracket as $ri => $cells) {
            foreach ($cells as $mi => $m) {
                if (! empty($m['winner'])) {
                    continue;
                }
                $p1 = (int) ($m['p1']['id'] ?? 0);
                $p2 = (int) ($m['p2']['id'] ?? 0);
                if ($uid !== $p1 && $uid !== $p2) {
                    continue;
                }
                $opp = $uid === $p1 ? $p2 : $p1;
                if ($opp > 0) {
                    $this->applyWinnerToBracket($t, $ri, $mi, $opp, ['walkover' => true]);
                }
                return;
            }
        }
    }

    // Rating'e gore seed'leyip 1. tur eslesmelerini uret (bye'lar otomatik ilerler).
    // Tek kaynak: App\Models\Tournament::startBracket (admin panel de ayni metodu kullanir).
    private function startBracket(Tournament $t): void
    {
        if (\App\Support\Swiss\SwissRuntime::isSwiss($t)) {
            \App\Support\Swiss\SwissRuntime::start($t); // 3 Haklı Swiss: 1. tur kura + eşleştirme

            return;
        }
        $t->startBracket();
    }

    // Son katilim tarihi gelen ACIK turnuvalari otomatik baslat (>=2 oyuncu).
    // Cron gerektirmez: liste/detay her cekildiginde tembel calisir. Kilit altinda
    // status yeniden okunur -> es zamanli iki istek ayni turnuvayi iki kez baslatamaz.
    private function autoStartDue(): void
    {
        $ids = Tournament::where('status', 'open')
            ->whereNotNull('register_until')
            ->where('register_until', '<=', now()) // tam son katilim saatinde baslar
            ->pluck('id');
        foreach ($ids as $id) {
            try {
                DB::transaction(function () use ($id) {
                    $t = Tournament::lockForUpdate()->find($id);
                    if (! $t || $t->status !== 'open') {
                        return;
                    }
                    $players = array_filter($t->players ?? [], fn ($p) => $p !== null);
                    if (count($players) >= 2) {
                        $this->startBracket($t);
                    }
                    // <2 oyuncu: baslatma; acik kalir (yonetici karar verir/siler)
                });
            } catch (\Throwable $e) {
                if (! $this->isTransientDb($e)) {
                    throw $e;
                }
                // Geçici kilit çakışması: bir sonraki poll self-heal'i yeniden dener.
            }
        }

        // Suren turnuvalarda OLU DAL onarimi (bkz resolveDeadByes). Eski (kapasiteye gore kurulmus)
        // agaclarda takili kalan oyuncular da boylece kendiliginden ilerler.
        foreach (Tournament::where('status', 'running')->pluck('id') as $id) {
            try {
                $done = DB::transaction(function () use ($id) {
                    $t = Tournament::lockForUpdate()->find($id);
                    if (! $t || $t->status !== 'running') {
                        return null;
                    }
                    // Otoriter oda sonucu HAZIR ama bracket'e islenmemis maclari onar (report cagrisi
                    // ulasmasa da) + olu dallari coz. Ikisi de degisiklik yaparsa sampiyon guncellenir.
                    $changed = $this->reconcileVerifiedResults($t);
                    // TAKILMA ÖNLEME: 3.'lük maçına kimse gelmediyse (oda açılmadı) rating ile çöz ->
                    // final gate'i açılır (turnuva 3.'lükte asılı kalmaz). Çözünce reconcile'ı tekrar
                    // çalıştır ki final de işlenebilsin.
                    if ($this->resolveStalledThirdPlace($t)) {
                        $changed = $this->reconcileVerifiedResults($t) || true;
                    }
                    // TAKILMA ÖNLEME (genel): iki oyuncusu belli ama kimse/tek taraf gelmeyen maçları
                    // süre dolunca çöz (hükmen ya da rating). reconcile'dan SONRA: gerçek sonuç önceliklidir.
                    if ($this->resolveStalledMatches($t)) {
                        $changed = true;
                    }

                    return ($this->resolveDeadByes($t) || $changed) ? $t : null;
                });
            } catch (\Throwable $e) {
                if (! $this->isTransientDb($e)) {
                    throw $e;
                }
                // Geçici kilit çakışması (1020/1213/1205): reconcile idempotent, sonraki poll yeniden dener.
                continue;
            }
            if ($done) {
                $this->awardChampionIfFinished($done);
            }
        }
    }

    /**
     * Geçici DB serialization çakışması mı? (MariaDB 1213 deadlock / 1205 lock-wait-timeout /
     * 1020 "record has changed since last read"). autoStartDue GET poll'unda fırsatçı self-heal
     * yapar; bu geçici hatalar sayfayı 500'e düşürmemeli — heal bir sonraki poll'da yinelenir.
     */
    private function isTransientDb(\Throwable $e): bool
    {
        $code = ($e instanceof \Illuminate\Database\QueryException) ? (int) ($e->errorInfo[1] ?? 0) : 0;

        return in_array($code, [1020, 1205, 1213], true);
    }

    /**
     * KILITLENME ONARIMI (bkz [[turnuva-akicilik]] / raporlanmayan sonuc): bir mac odasi otoriter
     * olarak BITMIS (hasVerifiedServerResult) ama bracket'e kazanan islenmemisse -> report() cagrisi
     * (bot/istemci o an olmus, deadline'a denk gelmis vb.) hic ulasmadigi icin turnuva sonsuza dek
     * "kazanansiz" takilir. Bu, odadaki DOGRULANMIS sonucu bracket'e islet -> report'a bagimli kalma.
     * Cagiran turnuva satirini KILITLER (autoStartDue transaction'i). Degisiklik olduysa true.
     */
    private function reconcileVerifiedResults(Tournament $t): bool
    {
        $changed = false;
        // applyWinnerToBracket her cagride kaydeder + bir ust tura tasir; birden fazla mac hazirsa
        // ( or. iki yari final ayni anda) hepsini isle. Final islenince status 'finished' -> dongu biter.
        for ($guard = 0; $guard < 64 && $t->status === 'running'; $guard++) {
            $bracket = is_array($t->bracket) ? $t->bracket : [];
            $found = null;
            foreach ($bracket as $ri => $round) {
                foreach ($round as $mi => $m) {
                    if (! empty($m['winner']) || empty($m['p1']['id']) || empty($m['p2']['id']) || empty($m['room'])) {
                        continue;
                    }
                    $winnerId = $this->winnerIdFromRoom($m); // yalniz otoriter+dogrulanmis sonuc -> id, yoksa null
                    if ($winnerId !== null) {
                        $found = [$ri, $mi, $winnerId];
                        break 2;
                    }
                }
            }
            if (! $found) {
                break;
            }
            [$ri, $mi, $winnerId] = $found;
            $this->applyWinnerToBracket($t, $ri, $mi, $winnerId, $this->scoreFromRoom($bracket[$ri][$mi]));
            $changed = true;
        }

        return $changed;
    }

    /** Mac, hic oyuncu gelmeyecek OLU bir dal mi? (bos + kazanansiz; ilk tur ya da iki besleyeni de olu) */
    private function isDeadMatch(array $bracket, int $ri, int $mi): bool
    {
        $m = $bracket[$ri][$mi] ?? null;
        if (! is_array($m) || ! empty($m['winner']) || ! empty($m['p1']['id']) || ! empty($m['p2']['id'])) {
            return false;
        }
        if ($ri === 0) {
            return true;
        }

        return $this->isDeadMatch($bracket, $ri - 1, $mi * 2) && $this->isDeadMatch($bracket, $ri - 1, $mi * 2 + 1);
    }

    /**
     * Rakibi HIC gelemeyecek oyuncuyu (karsi taraftaki besleyen dal olu) bye ile ilerlet; zincirleme
     * (final dahil -> sampiyon + odul applyWinnerToBracket'te). Cagiran turnuva satirini KILITLER.
     * Degisiklik olduysa true.
     */
    private function resolveDeadByes(Tournament $t): bool
    {
        $changed = false;
        for ($guard = 0; $guard < 64 && $t->status === 'running'; $guard++) {
            $bracket = is_array($t->bracket) ? $t->bracket : [];
            $found = null;
            foreach ($bracket as $ri => $round) {
                if ($ri === 0) {
                    continue; // ilk tur bye'lari startBracket'te islenir
                }
                foreach ($round as $mi => $m) {
                    if (! empty($m['winner'])) {
                        continue;
                    }
                    $has1 = ! empty($m['p1']['id']);
                    $has2 = ! empty($m['p2']['id']);
                    if ($has1 === $has2) {
                        continue; // iki taraf da dolu (oynansin) ya da ikisi de bos
                    }
                    $emptyFeeder = $has1 ? $mi * 2 + 1 : $mi * 2; // bos koltugu besleyen onceki tur maci
                    if ($this->isDeadMatch($bracket, $ri - 1, $emptyFeeder)) {
                        $found = [$ri, $mi, (int) ($has1 ? $m['p1']['id'] : $m['p2']['id'])];
                        break 2;
                    }
                }
            }
            if (! $found) {
                break;
            }
            $this->applyWinnerToBracket($t, $found[0], $found[1], $found[2], ['bye' => true]);
            $changed = true;
        }

        return $changed;
    }

    // Baslama zamani = son katilim tarihi (ISO). Geri sayim bunu kullanir.
    private function startsAt(Tournament $t): ?string
    {
        return $t->register_until?->toIso8601String();
    }

    /** Turnuva mac odasinin uzunlugu icin cache anahtari (RoomController::enter okur). */
    public static function roomTargetKey(string $code): string
    {
        return 'tourn_room_target:'.strtoupper($code);
    }

    /** Turnuva mac odasinin suresi (dk) icin cache anahtari (RoomController::enter okur). */
    public static function roomClockKey(string $code): string
    {
        return 'tourn_room_clock:'.strtoupper($code);
    }

    private function summary(Tournament $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'type' => $t->type ?? 'bracket', // 'bracket' | 'swiss_triple'
            'venue' => $t->venue,
            'organizer' => $t->organizer ? [
                'id' => $t->organizer->id,
                'name' => $t->organizer->title,
                'logo' => $t->organizer->image, // ciplak yol; frontend /uploads/ ile onekler
            ] : null,
            'size' => $t->size,
            'status' => $t->status,
            'count' => count(array_filter($t->players ?? [], fn ($p) => $p !== null)),
            'prize_coins' => $t->prize_coins ?? 0,
            'prize_desc' => $t->prize_desc,
            // coins int'e zorlanir: JSON'da string kalirsa frontend toplama '+' ile
            // birbirine yapisip "0500025000..." gibi bozuk gosterir.
            'prizes' => collect(is_array($t->prizes) ? $t->prizes : [])
                ->map(fn ($p) => ['coins' => (int) ($p['coins'] ?? 0), 'desc' => $p['desc'] ?? null])
                ->values()
                ->all(),
            'entry_fee' => $t->entry_fee ?? 0,
            'premium_only' => (bool) ($t->premium_only ?? true), // katilim: true=Premium, false=tum uyeler
            'register_until' => $t->register_until?->toIso8601String(),
            'starts_at' => $this->startsAt($t),
            // Mac uzunluklari (puan). semi/final null -> normal tur uzunlugu.
            'match_length' => (int) ($t->match_length ?: 1),
            'semi_length' => $t->semi_length ? (int) $t->semi_length : null,
            'final_length' => $t->final_length ? (int) $t->final_length : null,
            // Mac sureleri (dk, oyuncu basina). null -> saat modunun varsayilani / normal tur suresi.
            'round_minutes' => $t->round_minutes ? (int) $t->round_minutes : null,
            'semi_minutes' => $t->semi_minutes ? (int) $t->semi_minutes : null,
            'final_minutes' => $t->final_minutes ? (int) $t->final_minutes : null,
        ];
    }

    private function full(Tournament $t): array
    {
        return array_merge($this->summary($t), [
            'players' => array_values(array_filter($t->players ?? [], fn ($p) => $p !== null)),
            'bracket' => $t->bracket,
            'champion_id' => $t->champion_id,
            'swiss' => \App\Support\Swiss\SwissRuntime::isSwiss($t) ? \App\Support\Swiss\SwissRuntime::serialize($t) : null,
            'rev' => self::rev($t), // canli poll: ?rev= ayniysa show() 204 doner
        ]);
    }
}
