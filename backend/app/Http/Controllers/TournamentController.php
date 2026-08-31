<?php

namespace App\Http\Controllers;

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TournamentController extends Controller
{
    // Acik + devam eden turnuvalar
    public function index()
    {
        $this->autoStartDue(); // son katilim tarihi + 1dk gecenleri baslat
        $list = Tournament::whereIn('status', ['open', 'running'])
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn ($t) => $this->summary($t));
        return response()->json(['tournaments' => $list]);
    }

    public function show(Tournament $tournament)
    {
        $this->autoStartDue(); // acilan turnuva zamani gectiyse burada da baslasin
        return response()->json(['tournament' => $this->full($tournament->fresh())]);
    }

    public function create(Request $request)
    {
        // Yalnizca yonetici turnuva olusturabilir
        if (! $request->user()->is_admin) {
            return $this->fail('Yalnızca yönetici turnuva oluşturabilir.', 403);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'size' => ['required', 'integer', 'in:0,4,8,16,32,64,128,256'], // 0 = sinirsiz
            'prize_coins' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'prize_desc' => ['nullable', 'string', 'max:120'],
            'prizes' => ['nullable', 'array', 'max:64'],
            'prizes.*.coins' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'prizes.*.desc' => ['nullable', 'string', 'max:120'],
            'entry_fee' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'register_until' => ['nullable', 'date'],
        ]);
        $t = Tournament::create([
            'name' => $data['name'],
            'size' => $data['size'],
            'status' => 'open',
            'register_until' => $data['register_until'] ?? null,
            'creator_id' => $request->user()->id,
            'prize_coins' => $data['prize_coins'] ?? 0,
            'prize_desc' => $data['prize_desc'] ?? null,
            'prizes' => $data['prizes'] ?? null,
            'entry_fee' => $data['entry_fee'] ?? 0,
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
                if (($u->coins ?? 0) < $fee) {
                    return ['err' => 'Giriş ücreti için yetersiz coin.', 'code' => 422];
                }
                $u->coins = ($u->coins ?? 0) - $fee;
                $u->save();
                $t->prize_coins = ($t->prize_coins ?? 0) + $fee;
                $t->save();
            }
            $this->addPlayer($t, $me); // kilit altinda, idempotent
            return ['ok' => true];
        });

        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
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
            $players = $t->players ?? [];
            $idx = null;
            foreach ($players as $i => $p) {
                if (($p['id'] ?? null) === $me->id) {
                    $idx = $i;
                    break;
                }
            }
            if ($idx === null) {
                return ['ok' => true]; // zaten katilimci degil -> idempotent
            }
            // Giris ucreti iadesi: havuzdan dus + kullaniciya geri ver
            $fee = (int) ($t->entry_fee ?? 0);
            if ($fee > 0) {
                $u = User::lockForUpdate()->find($me->id);
                $u->coins = ($u->coins ?? 0) + $fee;
                $u->save();
                $t->prize_coins = max(0, (int) ($t->prize_coins ?? 0) - $fee);
            }
            array_splice($players, $idx, 1);
            $t->players = array_values($players);
            $t->save();
            return ['ok' => true];
        });
        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
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

            // YETKILI kazanan: once odanin senkron mac durumu; yoksa beyan.
            $authWinner = $this->winnerIdFromRoom($m);
            $winnerId = ($authWinner !== null && in_array($authWinner, $ids, true))
                ? $authWinner
                : (int) $data['winner_id'];

            $bracket[$ri][$mi]['winner'] = $winnerId;
            $winner = ($m['p1']['id'] ?? null) === $winnerId ? $m['p1'] : $m['p2'];

            if (isset($bracket[$ri + 1])) {
                $nextIndex = intdiv($mi, 2);
                $slot = $mi % 2 === 0 ? 'p1' : 'p2';
                $bracket[$ri + 1][$nextIndex][$slot] = $winner;
            } else {
                // Final bitti -> sampiyon
                $t->champion_id = $winnerId;
                $t->status = 'finished';
                // Odulleri bir kez ode (kilit altinda check-then-set yaris-guvenli).
                if (! $t->prize_paid) {
                    $this->payPrizes($t, $bracket, $winnerId);
                    $t->prize_paid = true;
                }
                // Kazanilan avatar cerceveleri KALDIRILDI (eski frame sistemi temizlendi).
            }

            $t->bracket = $bracket;
            $t->save();
            return ['t' => $t];
        });

        if (isset($out['err'])) {
            return $this->fail($out['err'], $out['code']);
        }
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
                    $tournament->bracket = $bracket;
                    $tournament->save();
                }
                return response()->json(['code' => $bracket[$ri][$mi]['room']]);
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

    // Macin oynandigi odanin YETKILI durumundan kazanan oyuncunun id'sini coz.
    // Oda p1=beyaz / p2=siyah; kazanan slot mac skorundan (target'a ulasan taraf) belirlenir.
    // Turnuva odalarinda p*_user_id bos olabildigi icin oda ismi bracket oyuncusuyla eslenir.
    // Karar yoksa (oda yok / skor kesin degil / isim eslesmiyor) null -> beyana dusulur.
    private function winnerIdFromRoom(array $m): ?int
    {
        $code = $m['room'] ?? null;
        if (! $code) {
            return null;
        }
        $room = \App\Models\Room::where('code', $code)->first();
        $state = $room?->state;
        $match = is_array($state) ? ($state['match'] ?? null) : null;
        if (! is_array($match) || ! isset($match['target'], $match['score'])) {
            return null;
        }
        $target = (int) $match['target'];
        $w = (int) ($match['score']['white'] ?? 0);
        $b = (int) ($match['score']['black'] ?? 0);
        if ($target <= 0) {
            return null;
        }
        if ($w >= $target && $w > $b) {
            $winnerName = $room->p1_name; // beyaz = oda p1
            $winnerUid = $room->p1_user_id;
        } elseif ($b >= $target && $b > $w) {
            $winnerName = $room->p2_name; // siyah = oda p2
            $winnerUid = $room->p2_user_id;
        } else {
            return null; // henuz kesin kazanan yok
        }
        // KIMLIK ONCELIGI: oda slot'unda dogrulanmis user_id varsa bracket oyuncusuyla
        // BIRE BIR eslesmeli -> ucuncu birinin odayi ele gecirip isim TAKLIDIYLE (spoof)
        // yetkili sonuc uretmesi engellenir. user_id yoksa (misafir) isimle eslen (eski davranis).
        foreach (['p1', 'p2'] as $slot) {
            if (! isset($m[$slot]['id'])) {
                continue;
            }
            $bid = (int) $m[$slot]['id'];
            if ($winnerUid !== null) {
                if ((int) $winnerUid === $bid) {
                    return $bid;
                }
            } elseif (isset($m[$slot]['name']) && $m[$slot]['name'] === $winnerName) {
                return $bid;
            }
        }
        return null;
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
                    User::where('id', $standings[$i])->update([
                        'coins' => DB::raw('COALESCE(coins,0) + '.$coins),
                    ]);
                }
            }
            // Giris ucreti havuzu -> 1.lige (sampiyon)
            if ($pool > 0) {
                $first = $standings[0] ?? $winnerId;
                User::where('id', $first)->update([
                    'coins' => DB::raw('COALESCE(coins,0) + '.$pool),
                ]);
            }
            return;
        }

        // Eski akis: prizes tablosu yoksa tum havuz sampiyona
        if ($pool > 0) {
            User::where('id', $winnerId)->update([
                'coins' => DB::raw('COALESCE(coins,0) + '.$pool),
            ]);
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
        $lastRound = $bracket[count($bracket) - 1];
        $final = $lastRound[0] ?? null;
        $championId = isset($final['winner']) ? (int) $final['winner'] : null;

        $standings = [];
        if ($championId) {
            $standings[] = $championId;
        }
        for ($ri = count($bracket) - 1; $ri >= 0; $ri--) {
            $losers = [];
            foreach ($bracket[$ri] as $m) {
                $w = $m['winner'] ?? null;
                $p1 = $m['p1'] ?? null;
                $p2 = $m['p2'] ?? null;
                // Bye/yarim mac: iki gercek oyuncu yoksa kaybeden yok
                if (! $w || ! isset($p1['id'], $p2['id'])) {
                    continue;
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

    private function addPlayer(Tournament $t, $user): void
    {
        $players = $t->players ?? [];
        foreach ($players as $p) {
            if (($p['id'] ?? null) === $user->id) {
                return; // zaten kayitli
            }
        }
        $players[] = [
            'id' => $user->id,
            'name' => $user->nickname ?: $user->first_name ?: 'Oyuncu',
            'rating' => $user->rating ?? 1500,
            'avatar' => $user->avatar,
        ];
        $t->players = $players;
        $t->save();
    }

    // Rating'e gore seed'leyip 1. tur eslesmelerini uret (bye'lar otomatik ilerler).
    // Tek kaynak: App\Models\Tournament::startBracket (admin panel de ayni metodu kullanir).
    private function startBracket(Tournament $t): void
    {
        $t->startBracket();
    }

    // Son katilim tarihi + 1dk gecen ACIK turnuvalari otomatik baslat (>=2 oyuncu).
    // Cron gerektirmez: liste/detay her cekildiginde tembel calisir. Kilit altinda
    // status yeniden okunur -> es zamanli iki istek ayni turnuvayi iki kez baslatamaz.
    private function autoStartDue(): void
    {
        $ids = Tournament::where('status', 'open')
            ->whereNotNull('register_until')
            ->where('register_until', '<=', now()->subSeconds(60)) // register_until + 60sn <= simdi
            ->pluck('id');
        foreach ($ids as $id) {
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
        }
    }

    // register_until Carbon'unu ISO'ya cevir; baslama zamani = +60sn.
    private function startsAt(Tournament $t): ?string
    {
        return $t->register_until ? $t->register_until->copy()->addSeconds(60)->toIso8601String() : null;
    }

    private function summary(Tournament $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
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
            'register_until' => $t->register_until?->toIso8601String(),
            'starts_at' => $this->startsAt($t),
        ];
    }

    private function full(Tournament $t): array
    {
        return array_merge($this->summary($t), [
            'players' => array_values(array_filter($t->players ?? [], fn ($p) => $p !== null)),
            'bracket' => $t->bracket,
            'champion_id' => $t->champion_id,
        ]);
    }
}
