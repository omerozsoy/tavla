<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\User;
use App\Services\MatchClock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RoomController extends Controller
{
    // Benzersiz oda kodu (karisik olmayan karakterler)
    private function generateCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O/1/I yok
        do {
            $code = '';
            for ($i = 0; $i < 5; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (Room::where('code', $code)->exists());
        return $code;
    }

    /**
     * C1: Kullanıcının ŞU AN OYNANAN (status=playing) bir bahisli maçı (stake>0 veya bet_pct>0)
     * var mı? Eşzamanlı bahisli maçları engellemek için (coin drain/shortchange exploit'i kapatır).
     */
    private function userInStakedPlaying(?int $uid, ?int $excludeRoomId = null): bool
    {
        if (! $uid) {
            return false;
        }

        return Room::where('status', 'playing')
            ->when($excludeRoomId, fn ($q) => $q->where('id', '!=', $excludeRoomId))
            ->where(function ($q) {
                $q->where('stake', '>', 0)->orWhere('bet_pct', '>', 0);
            })
            ->where(function ($q) use ($uid) {
                $q->where('p1_user_id', $uid)->orWhere('p2_user_id', $uid);
            })
            ->exists();
    }

    /**
     * ESCROW BIRAK: bu odanın rezerve edilmiş stake'ini iki oyuncudan serbest bırak. IDEMPOTENT
     * (escrowed true->false tek claim). Coin DÜŞMEZ/EKLENMEZ; yalnız coins_reserved azalır -> hiçbir
     * yol kaçsa bile coin KAYBOLMAZ (en fazla geçici kilitli). Settle sonrası + abort/cleanup öncesi çağrılır.
     */
    private function releaseEscrow(Room $room): void
    {
        if (! Schema::hasColumn('rooms', 'escrowed') || ! $room->escrowed) {
            return;
        }
        $stake = (int) $room->stake;
        DB::transaction(function () use ($room, $stake) {
            // Idempotent: yalnız ilk çağrı escrowed'u false yapıp rezervi bırakır.
            $claimed = Room::where('id', $room->id)->where('escrowed', true)->update(['escrowed' => false]);
            if (! $claimed || $stake <= 0) {
                return;
            }
            $uids = array_values(array_unique(array_filter([$room->p1_user_id, $room->p2_user_id])));
            sort($uids);
            foreach ($uids as $uid) {
                $u = User::lockForUpdate()->find($uid);
                if ($u) {
                    $u->coins_reserved = max(0, (int) ($u->coins_reserved ?? 0) - $stake);
                    $u->save();
                }
            }
        });
    }

    // Oda olustur
    public function create(Request $request)
    {
        $this->cleanupStale();
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
            'time_control' => ['nullable', 'string', 'in:casual,normal,speed'],
        ]);

        $room = Room::create([
            'code' => $this->generateCode(),
            'p1_token' => $data['token'],
            'p1_user_id' => $request->user('sanctum')?->id, // avatar cerceve lookup (bahis stake=0 -> settle'i etkilemez)
            'p1_name' => $data['name'],
            'p1_rating' => $data['rating'] ?? null,
            'p1_avatar' => $data['avatar'] ?? null,
            'status' => 'waiting',
            'mode' => 'friendly', // davet kodlu ozel oda -> Dostluk maci
            'time_control' => MatchClock::normalizeMode($data['time_control'] ?? null),
            'version' => 0,
        ]);

        return response()->json(['room' => $room->toClient(), 'slot' => 'p1']);
    }

    // Bayat odalari temizle (cron gerekmez, erisimde firsatci calisir):
    // - mm_waiting: 2 dk'dan eski, eslesememis
    // - biten/terkedilmis odalar: 1 gunden eski
    private function cleanupStale(): void
    {
        try {
            Room::where('status', 'mm_waiting')
                ->whereNull('p2_token')
                ->where('created_at', '<', now()->subMinutes(2))
                ->delete();
            // Eski (>1 gün) odalar. ESCROW: rezerve edilmiş (escrowed) varsa ÖNCE rezervi bırak
            // (terk edilmiş bahisli maçın coin'i kilitli kalmasın; idempotent). NOT: releaseEscrow
            // Eloquent update ile updated_at'i touch ediyor -> silinecek id'leri ÖNCE yakala, sonra
            // o id'lerle sil (aksi halde bırakılan oda "artık eski değil" olup delete'i kaçırırdı).
            $staleIds = Room::where('updated_at', '<', now()->subDay())->pluck('id')->all();
            if ($staleIds && Schema::hasColumn('rooms', 'escrowed')) {
                foreach (Room::whereIn('id', $staleIds)->where('escrowed', true)->get() as $r) {
                    $this->releaseEscrow($r);
                }
            }
            if ($staleIds) {
                Room::whereIn('id', $staleIds)->delete();
            }
            \Illuminate\Support\Facades\DB::table('game_invites')
                ->where('created_at', '<', now()->subMinutes(10))
                ->delete();
        } catch (\Throwable $e) {
            // temizlik best-effort; hata olsa da akisi bozma ama sessizce yutma -> logla
            \Illuminate\Support\Facades\Log::warning('room.cleanupStale failed', ['err' => $e->getMessage()]);
        }
    }

    // Hizli eslesme: bekleyen biri varsa esle, yoksa havuza gir ve bekle.
    public function matchmaking(Request $request)
    {
        $this->cleanupStale();
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
            'stake' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            // Tek Oyun: kabul edilen COKLU bahis (kesisen tutarla eslesir). Bos ise [stake]'e duser.
            'stakes' => ['nullable', 'array', 'max:20'],
            'stakes.*' => ['integer', 'min:0', 'max:1000000000'],
            // NOT: user_id ISTEMCIDEN alinmaz (guvenlik). Sanctum token'indan gelir; asagida
            // $authUser->id kullanilir. Bu yuzden burada validate/kabul EDILMEZ (olu parametre kaldirildi).
            'min_rating' => ['nullable', 'integer', 'min:0', 'max:4000'],
            'bet_pct' => ['nullable', 'integer', 'in:0,10,30,50,100'],
            'targets' => ['nullable', 'array'],
            'targets.*' => ['integer', 'in:1,3,5,7,9,11'],
            'time_control' => ['nullable', 'string', 'in:casual,normal,speed'],
        ]);
        $stake = (int) ($data['stake'] ?? 0);
        // Kabul edilen bahisler (Tek Oyun coklu secim). Bos -> tek [stake]. Tekillestir + sirala.
        $stakes = array_values(array_unique(array_map('intval', $data['stakes'] ?? [])));
        sort($stakes);
        if (empty($stakes)) {
            $stakes = [$stake];
        }
        // Canlida migration henuz kosmadiysa 'stakes' kolonu olmayabilir -> ona YAZMA
        // (aksi halde SQLSTATE 42S22 "Unknown column 'stakes'" ile coker). Kolon yoksa
        // coklu secim tek temsile (en yuksek) duser; migrate --force sonrasi tam calisir.
        $hasStakesCol = Schema::hasColumn('rooms', 'stakes');
        // BAĞIMSIZ Faz 1: bahisli (para) odalarda zarı sunucuya al. Kolon yoksa (migration
        // kosmadi) yazma -> SQLSTATE cokme onlenir; migrate --force sonrasi devreye girer.
        $hasDiceAuthCol = Schema::hasColumn('rooms', 'dice_authority');
        $minRating = (int) ($data['min_rating'] ?? 0);
        $betPct = (int) ($data['bet_pct'] ?? 0);
        // Server-otoriter saat AYNI tempoyu gerektirir -> eslesme tempoyu da sart kosar.
        $timeControl = MatchClock::normalizeMode($data['time_control'] ?? null);
        // GUVENLIK: user_id ISTEMCIYE guvenilerek alinmaz. Dogrulanmis Sanctum token'indan
        // gelir (route auth middleware'i disinda olsa da bearer token gonderiliyor).
        // Aksi halde saldirgan baskasinin user_id'siyle bahis odasina girip settle'da onun
        // coin'ini riske atabilir/eritebilirdi. Giris yoksa userId null (yalnizca ucretsiz oyun).
        $authUser = $request->user('sanctum');
        $userId = $authUser?->id ?? null;
        // Kabul edilen mac uzunluklari (kolay eslesme icin coklu). Bos -> tek oyun.
        $targets = array_values(array_unique(array_map('intval', $data['targets'] ?? [])));
        $targets = array_values(array_filter($targets, fn ($n) => in_array($n, [1, 3, 5, 7, 9, 11], true)));
        if (empty($targets)) {
            $targets = [1];
        }

        // Bahisli oyun (sabit stake VEYA % bahis): dogrulanmis giris + coin sart.
        // Coklu bahiste EN YUKSEK secilen tutari karsilayabilmeli (eslesme o tutarda olabilir).
        $maxStake = max($stakes);
        if ($maxStake > 0 || $betPct > 0) {
            if (! $authUser) {
                return $this->fail('Bahisli oyun için giriş yapmalısın.', 422);
            }
            // KULLANILABİLİR bakiye = coins - coins_reserved (escrow). Rezerve edilmiş coin yeni
            // bahse sayılmaz (o an başka maçta kilitli).
            if ((($authUser->coins ?? 0) - ($authUser->coins_reserved ?? 0)) < max($maxStake, 1)) {
                return $this->fail('Yetersiz coin.', 422);
            }
            // C1: Zaten OYNANAN bahisli bir maçı varsa yeni bahisli arama/eşleşme REDDEDİLİR ->
            // eşzamanlı bahisli maçlarla coin drain/shortchange exploit'i kapanır (tek aktif bahisli maç).
            if ($this->userInStakedPlaying($userId)) {
                return $this->fail('Zaten devam eden bahisli bir maçın var. Önce onu bitir.', 422);
            }
        }

        // Zaten havuzda bekleyen kendi odam (ayni kategori) varsa: bahis secimi AYNIysa don,
        // FARKLIysa eskiyi kaldir (orphan bekleyen oda kalmasin) -> yeni secimle yeniden aranir.
        $mine = Room::where('status', 'mm_waiting')
            ->where('p1_token', $data['token'])
            ->where('bet_pct', $betPct)
            ->where('time_control', $timeControl)
            ->first();
        if ($mine) {
            $mineStakes = is_array($mine->stakes) ? array_values(array_map('intval', $mine->stakes)) : [(int) $mine->stake];
            sort($mineStakes);
            if ($mineStakes === $stakes) {
                return response()->json(['room' => $mine->toClient(), 'slot' => 'p1', 'matched' => false]);
            }
            $mine->delete();
        }

        // Ayni bahis/kategorili bekleyen adaylar; min puan filtresi (tek yonlu).
        // Uzunluk KESISIMI olan ilk (en eski) rakip secilir -> coklu secim = kolay eslesme.
        // ATOMIK: aday secimi (lockForUpdate) + rakibe yazma TEK transaction icinde olmali,
        // aksi halde kilit hemen birakilir ve iki es zamanli istek ayni bekleyen odayi
        // rakip secip ikisi de p2'ye yazabilir (cift eslesme / bahis tutarsizligi).
        $opponent = DB::transaction(function () use ($data, $stakes, $betPct, $minRating, $targets, $userId, $timeControl) {
            // Bahis KOLONUYLA filtrelemiyoruz: aday listesiyle KESISIM kontrol edilir (coklu secim).
            $q = Room::where('status', 'mm_waiting')
                ->where('bet_pct', $betPct)
                ->where('time_control', $timeControl) // yalnizca ayni tempo
                ->where('p1_token', '!=', $data['token'])
                ->whereNull('p2_token');
            if ($minRating > 0) {
                $q->where('p1_rating', '>=', $minRating);
            }
            $candidates = $q->orderBy('created_at')->lockForUpdate()->get();

            foreach ($candidates as $cand) {
                // Uzunluk KESISIMI
                $candTargets = is_array($cand->targets) ? $cand->targets : [1];
                $commonTargets = array_values(array_intersect($candTargets, $targets));
                if (empty($commonTargets)) {
                    continue;
                }
                // Bahis KESISIMI (coklu secim): ortak tutarlardan EN YUKSEGI anlasilir.
                $candStakes = is_array($cand->stakes) ? array_map('intval', $cand->stakes) : [(int) $cand->stake];
                $commonStakes = array_values(array_intersect($candStakes, $stakes));
                if (empty($commonStakes)) {
                    continue;
                }
                $agreedStake = max($commonStakes);
                // Bekleyen oyuncu anlasilan tutari HALA karsilayabiliyor mu? (coin degismis olabilir)
                if ($agreedStake > 0 && $cand->p1_user_id) {
                    $candCoins = (int) (User::where('id', $cand->p1_user_id)->value('coins') ?? 0);
                    if ($candCoins < $agreedStake) {
                        continue;
                    }
                }
                // C1: eşzamanlı bahisli maç YOK. Aday (p1) VEYA arayan (userId) zaten OYNANAN bir
                // bahisli maçtaysa bu eşleşmeyi atla (create-time guard yarışına karşı transaction-içi).
                if (($agreedStake > 0 || $betPct > 0)
                    && ($this->userInStakedPlaying($cand->p1_user_id) || $this->userInStakedPlaying($userId))) {
                    continue;
                }
                // ESCROW (rezervasyon): SABİT bahis -> iki oyuncunun stake'ini REZERVE et (coins DÜŞMEZ).
                // Kullanılabilir bakiye (coins - coins_reserved) < stake ise eşleşme YAPMA (o an başka
                // yere ayrılmış olabilir). Atomik: tx içinde, deadlock için user'lar sıralı-id kilitli.
                // Böylece kaybeden stake'i maç sırasında harcayamaz -> settle her zaman TAM öder.
                if ($agreedStake > 0 && Schema::hasColumn('users', 'coins_reserved')
                    && $cand->p1_user_id && $userId) {
                    $uids = [(int) $cand->p1_user_id, (int) $userId];
                    sort($uids);
                    $lk = [];
                    foreach ($uids as $uid) {
                        $lk[$uid] = User::lockForUpdate()->find($uid);
                    }
                    $p1u = $lk[$cand->p1_user_id] ?? null;
                    $p2u = $lk[$userId] ?? null;
                    $avail = fn ($u) => (int) (($u->coins ?? 0) - ($u->coins_reserved ?? 0));
                    if (! $p1u || ! $p2u || $avail($p1u) < $agreedStake || $avail($p2u) < $agreedStake) {
                        continue; // biri kullanılabilir bakiyeyle karşılayamıyor -> bu eşleşme yok
                    }
                    $p1u->coins_reserved = (int) ($p1u->coins_reserved ?? 0) + $agreedStake;
                    $p2u->coins_reserved = (int) ($p2u->coins_reserved ?? 0) + $agreedStake;
                    $p1u->save();
                    $p2u->save();
                    $cand->escrowed = true;
                }
                $cand->p2_token = $data['token'];
                $cand->p2_user_id = $userId;
                $cand->p2_name = $data['name'];
                $cand->p2_rating = $data['rating'] ?? null;
                $cand->p2_avatar = $data['avatar'] ?? null;
                $cand->stake = $agreedStake;   // anlasilan sabit bahis (settle bunu kullanir)
                $cand->target = max($commonTargets); // ortak uzunluklardan en uzunu
                $cand->status = 'playing';
                // Faz 2: iki oyuncu da belli -> TAM otorite mi? (global staked VEYA test allow-list).
                // Öyleyse authoritative=true (Faz 1 dice_authority'nin YERİNE geçer).
                if (Schema::hasColumn('rooms', 'authoritative')
                    && $this->shouldAuthoritative($cand->p1_user_id, $userId, ($agreedStake > 0 || $betPct > 0))) {
                    $cand->authoritative = true;
                    $cand->dice_authority = false;
                }
                $cand->save();
                return $cand;
            }

            return null;
        });

        if ($opponent) {
            return response()->json(['room' => $opponent->toClient(), 'slot' => 'p2', 'matched' => true]);
        }

        // Kimse yok -> havuza gir (kabul edilen uzunluklar saklanir)
        $roomData = [
            'code' => $this->generateCode(),
            'p1_token' => $data['token'],
            'p1_user_id' => $userId,
            'p1_name' => $data['name'],
            'p1_rating' => $data['rating'] ?? null,
            'p1_avatar' => $data['avatar'] ?? null,
            'status' => 'mm_waiting',
            // stakes kolonu VARSA: tek secimde sabit, coklu secimde placeholder 0 (eslesmede yazilir).
            // Kolon YOKSA (migration kosmadi): coklu secim tek temsile (en yuksek) duser.
            'stake' => $hasStakesCol
                ? (count($stakes) === 1 ? $stakes[0] : 0)
                : max($stakes),
            'bet_pct' => $betPct,
            'targets' => $targets,
            'target' => count($targets) === 1 ? $targets[0] : null,
            'mode' => 'ranked', // hizli eslesme -> Mac Oyunu
            'time_control' => $timeControl,
            'version' => 0,
        ];
        if ($hasStakesCol) {
            $roomData['stakes'] = $stakes;
        }
        // BAĞIMSIZ Faz 1 (staked): bekleyen oda zarı sunucudan (dice_authority, CANLIDA gölge).
        // Faz 2 TAM otorite (authoritative) kararı EŞLEŞME anında verilir (iki oyuncu da bilinince:
        // global staked VEYA test allow-list). Kolon yoksa yazma -> SQLSTATE çökme önlenir.
        if ($hasDiceAuthCol && config('dice.authority', true) && ($maxStake > 0 || $betPct > 0)) {
            $roomData['dice_authority'] = true;
        }
        $room = Room::create($roomData);

        return response()->json(['room' => $room->toClient(), 'slot' => 'p1', 'matched' => false]);
    }

    // Bahisli online mac sonucu: coin transferi (oda basina bir kez, atomik).
    // GUVENLIK: istemcinin 'won' beyanina KORU KORUNE guvenilmez. Online oyunda
    // sunucu hamleleri dogrulamiyor ve 'state'i iki oyuncu da yazabildigi icin
    // (bkz. update()), state TEK BASINA sahte olabilir -> forge ile coin calinamaz.
    // Bu yuzden coin YALNIZCA iki oyuncunun birbirini tutan beyaninda (biri 'won'
    // digeri 'lost') tasinir. Tek tarafli/celiskili beyanda odeme yapilmaz (pending).
    public function settle(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'won' => ['required', 'boolean'],
        ]);
        $room = Room::where('code', $code)->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $stake = (int) $room->stake;
        $betPct = (int) $room->bet_pct;
        // Arkadaslik (davet) odasi = coin transferi YOK (yetkili; stake zaten 0 ama kesinlestir).
        if ($room->mode === 'friendly' || ($stake <= 0 && $betPct <= 0) || ! $room->p1_user_id || ! $room->p2_user_id) {
            return response()->json(['ok' => false]);
        }
        $callerIsP1 = $room->p1_token === $data['token'];
        $callerIsP2 = $room->p2_token === $data['token'];
        if (! $callerIsP1 && ! $callerIsP2) {
            return $this->fail('Bu odada değilsin.', 403);
        }
        $callerSlot = $callerIsP1 ? 'p1' : 'p2';
        $callerId = $callerIsP1 ? $room->p1_user_id : $room->p2_user_id;

        // Bu oyuncunun beyan ettigi sonucu (bir kez) kaydet
        $resultCol = $callerSlot.'_result';
        if ($room->$resultCol === null) {
            $room->$resultCol = $data['won'] ? 'won' : 'lost';
            $room->save();
        }

        // Kazanani yetkili sekilde coz; henuz belli degilse odeme yapma (rakip beyani
        // veya son mac durumu senkronu gelince tamamlanir).
        $winnerSlot = $this->resolveWinnerSlot($room->fresh());
        if ($winnerSlot === null) {
            $caller = User::find($callerId);
            return response()->json(['ok' => false, 'pending' => true, 'coins' => $caller?->coins ?? 0]);
        }

        $winnerId = $winnerSlot === 'p1' ? $room->p1_user_id : $room->p2_user_id;
        $loserId = $winnerSlot === 'p1' ? $room->p2_user_id : $room->p1_user_id;

        // Kazanan belli -> mac bitti: odayi 'finished' isaretle (Canli Maclar'da gorunmesin;
        // client status gonderemese bile guvenlik agi).
        if ($room->status !== 'finished') {
            Room::where('code', $code)->update(['status' => 'finished']);
        }

        // ATOMIK: "settled" iddiasi + coin transferi TEK transaction, kullanicilar kilitli.
        // Ayni oyuncunun es zamanli birden fazla oda cozumunde net coin uretimi/kaybi engellenir.
        // ESCROW: sabit-stake maçında rezerv yapıldıysa settle transfer'iyle BİRLİKTE (atomik) bırak.
        $escrowed = Schema::hasColumn('rooms', 'escrowed') ? (bool) $room->escrowed : false;
        // KOMISYON (rake): kazanan stake × (1 − oran) alır; fark commissions ledger'ına yazılır.
        // Oran admin 'commission_pct' ayarından (varsayılan config; 0..90 kırpılır).
        $commissionPct = max(0, min(90, \App\Models\Setting::int('commission_pct', (int) config('game.commission_pct', 5))));
        $out = DB::transaction(function () use ($code, $winnerId, $loserId, $betPct, $stake, $escrowed, $commissionPct) {
            // Yalnizca ilk cagri coin tasir (+ escrowed'u da bir kez false yap = rezerv bırakma claim'i)
            $claimed = Room::where('code', $code)->where('settled', false)
                ->update($escrowed ? ['settled' => true, 'escrowed' => false] : ['settled' => true]);
            if (! $claimed) {
                return ['already' => true];
            }
            // Deadlock'u onlemek icin deterministik kilit sirasi (id'ye gore)
            $ids = array_values(array_unique(array_filter([$winnerId, $loserId])));
            sort($ids);
            $locked = [];
            foreach ($ids as $uid) {
                $locked[$uid] = User::lockForUpdate()->find($uid);
            }
            $winner = $winnerId ? ($locked[$winnerId] ?? null) : null;
            $loser = $loserId ? ($locked[$loserId] ?? null) : null;

            // Transfer tutari: sabit stake, ya da % ise iki oyuncunun bahsinin min'i
            if ($betPct > 0) {
                $wBet = (int) floor((($winner->coins ?? 0) * $betPct) / 100);
                $lBet = (int) floor((($loser->coins ?? 0) * $betPct) / 100);
                $amount = max(0, min($wBet, $lBet));
            } else {
                $amount = $stake;
            }
            // COIN KORUNUMU (güvenlik): kaybedenden fiilen alınabilen kadar düş (min stake, bakiye);
            // kazanana TAM O KADARINI ekle. Aksi halde kaybedenin bakiyesi stake'in altındaysa
            // (ör. eşzamanlı maçlarla drenaj) net coin BASILIR: kazanan tam stake alır, kaybeden
            // yalnız bakiyesini kaybeder. min() ile mint engellenir; transfer her zaman sıfır-toplam.
            $debit = $loser ? min($amount, max(0, (int) ($loser->coins ?? 0))) : $amount;
            // KOMISYON: kaybeden TAM $debit öder; kazanan $debit − komisyon alır; fark ledger'a.
            $commission = (int) floor($debit * $commissionPct / 100);
            $winnerGets = max(0, $debit - $commission);
            if ($loser) {
                $loser->coins = ($loser->coins ?? 0) - $debit;
                if ($escrowed && $stake > 0) { // rezerv bırak (sabit-stake escrow)
                    $loser->coins_reserved = max(0, (int) ($loser->coins_reserved ?? 0) - $stake);
                }
                $loser->save();
            }
            if ($winner) {
                $winner->coins = ($winner->coins ?? 0) + $winnerGets;
                if ($escrowed && $stake > 0) {
                    $winner->coins_reserved = max(0, (int) ($winner->coins_reserved ?? 0) - $stake);
                }
                $winner->save();
            }
            if ($commission > 0) {
                \App\Models\Commission::create([
                    'room_code' => $code, 'winner_id' => $winnerId, 'loser_id' => $loserId,
                    'stake' => $debit, 'commission' => $commission, 'pct' => $commissionPct,
                ]);
            }
            return ['amount' => $debit, 'commission' => $commission, 'won_amount' => $winnerGets];
        });

        if (isset($out['already'])) {
            $caller = User::find($callerId);
            return response()->json(['ok' => false, 'coins' => $caller?->coins ?? 0]);
        }

        $caller = User::find($callerId);
        return response()->json([
            'ok' => true,
            'coins' => $caller?->coins ?? 0,
            'stake' => $out['amount'],                            // kaybedenin ödediği (TAM stake)
            'won_amount' => $out['won_amount'] ?? $out['amount'], // kazananın aldığı (komisyon sonrası)
            'commission' => $out['commission'] ?? 0,              // platform payı (ledger'a yazıldı)
            'won' => $winnerId === $callerId,
        ]);
    }

    // Kazanan slot'u ('p1'|'p2') belirle, yoksa null.
    // Yalnizca KARSILIKLI MUTABAKAT guvenli: biri 'won' digeri 'lost' bildirmeli.
    // state client-yazilabilir oldugu icin hakem olarak KULLANILMAZ (forge korumasi).
    // Celiskili (ikisi de 'won') veya tek tarafli beyanda null -> odeme pending kalir.
    private function resolveWinnerSlot(Room $room): ?string
    {
        $staked = ((int) $room->stake) > 0 || ((int) $room->bet_pct) > 0;

        // SUNUCU-OTORİTER MAÇ (Faz 3): authoritative oda ise kazanan SUNUCUNUN hesabından
        // (server_match) gelir — istemci mutabakatına GEREK YOK, forge EDİLEMEZ. Maç bitmişse.
        if ($room->authoritative && is_array($room->server_match)) {
            $sm = $room->server_match;
            if (! empty($sm['done']) && ($sm['winner'] ?? null) === 'white') {
                return 'p1';
            }
            if (! empty($sm['done']) && ($sm['winner'] ?? null) === 'black') {
                return 'p2';
            }

            return null; // maç bitmedi -> ödeme yok
        }

        // PARA GÜVENLİĞİ (C1): BAHİSLİ maçta ASLA istemci mutabakatına (legacy) düşme — iki hesap
        // anlaşıp coin transferi yapamasın. Sunucu-otoriter sonuç yoksa ödeme PENDING kalır
        // (coin transferi YAPILMAZ; stuck > çalınmış). Bahisli odalar zaten authoritative kurulur
        // (shouldAuthoritative), bu yalnızca güvenlik ağı (server_match eksikse legacy'ye kaçma).
        if ($staked) {
            return null;
        }

        // Legacy (yalnız ÜCRETSİZ oda): iki-taraf mutabakatı (istemci beyanı).
        $r1 = $room->p1_result;
        $r2 = $room->p2_result;

        if ($r1 === 'won' && $r2 === 'lost') {
            return 'p1';
        }
        if ($r2 === 'won' && $r1 === 'lost') {
            return 'p2';
        }

        return null;
    }

    // Canli maclar: su an oynanan odalar (izlenebilir). Herkese acik.
    public function liveMatches()
    {
        $rooms = Room::where('status', 'playing')
            ->whereNotNull('p1_name')
            ->whereNotNull('p2_name')
            // Tahta durumu VAR: legacy `state` (istemci PUT) VEYA `server_state` (AUTHORITATIVE).
            // Otoriter modda istemci tam-state PUT etmez (App.tsx: authoritative -> updateRoom atlanir)
            // -> `state` NULL kalir. Sadece whereNotNull('state') derse tum otoriter maclar listeden
            // DUSER (ana sayfa "Canli Maclar" bombos). Ikisinden biri doluysa mac aktiftir.
            ->where(function ($q) {
                $q->whereNotNull('state')->orWhereNotNull('server_state');
            })
            ->where('updated_at', '>', now()->subMinutes(3)) // sadece gercekten aktif maclar
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get(['code', 'p1_user_id', 'p2_user_id', 'p1_name', 'p1_rating', 'p1_avatar', 'p2_name', 'p2_rating', 'p2_avatar', 'stake', 'bet_pct', 'target', 'mode']);

        // Premium: iki oyuncunun user_id'lerinden TEK sorguyla plan lookup (süresi geçerli ücretli).
        $uids = $rooms->flatMap(fn ($r) => [$r->p1_user_id, $r->p2_user_id])->filter()->unique()->values();
        $premiumMap = $uids->isEmpty() ? [] : User::whereIn('id', $uids)->get(['id', 'plan', 'plan_until'])
            ->mapWithKeys(fn ($u) => [$u->id => $u->plan_active !== 'free'])->all();

        $list = $rooms->map(fn ($r) => [
            'code' => $r->code,
            'p1_name' => $r->p1_name,
            'p1_rating' => $r->p1_rating,
            'p1_avatar' => $r->p1_avatar,
            'p1_premium' => $premiumMap[$r->p1_user_id] ?? false,
            'p2_name' => $r->p2_name,
            'p2_rating' => $r->p2_rating,
            'p2_avatar' => $r->p2_avatar,
            'p2_premium' => $premiumMap[$r->p2_user_id] ?? false,
            'stake' => (int) $r->stake,
            'bet_pct' => (int) $r->bet_pct,
            'target' => $r->target !== null ? (int) $r->target : null,
            // Etiket icin tip: eski (null) kayitlar 'ranked' varsayilir (cogu online mac hizli eslesme)
            'mode' => $r->mode ?: 'ranked',
        ]);

        return response()->json(['matches' => $list]);
    }

    // Cevrimici oyuncular: son 70sn icinde ping'lemis (last_seen) kullanicilar.
    // Ana sayfa "Cevrimici Oyuncular" paneli icin. Herkese acik (izleme gibi).
    public function onlinePlayers()
    {
        $users = User::whereNotNull('last_seen')
            ->where('last_seen', '>', now()->subSeconds(70))
            ->orderByDesc('rating')
            ->limit(50)
            ->get(['id', 'first_name', 'nickname', 'avatar', 'avatar_frame', 'country', 'rating', 'plan', 'plan_until']);

        $list = $users->map(fn ($u) => [
            'id'      => $u->id,
            'name'    => $u->nickname ?: $u->first_name ?: 'Oyuncu',
            'avatar'  => $u->avatar,
            'frame'   => $u->avatar_frame,
            'country' => $u->country,
            'rating'  => $u->rating ?? 1500,
            'premium' => $u->plan_active !== 'free', // süresi geçerli ücretli plan -> taç
        ]);

        return response()->json(['players' => $list, 'count' => $list->count()]);
    }

    // Giris yapan kullanicinin DEVAM EDEN (playing) online maclari -> geri donebilsin.
    public function myActiveRooms(Request $request)
    {
        $me = $request->user();
        if (! $me) {
            return response()->json(['rooms' => []]);
        }
        $rooms = Room::where('status', 'playing')
            ->where(function ($q) use ($me) {
                $q->where('p1_user_id', $me->id)->orWhere('p2_user_id', $me->id);
            })
            // Yalnizca GERCEKTEN canli maclar: son 4 dk icinde guncellenmis (terk/timeout eleme)
            ->where('updated_at', '>', now()->subMinutes(4))
            ->orderByDesc('updated_at')
            ->limit(10)
            ->get(['code', 'p1_user_id', 'p2_user_id', 'p1_name', 'p1_rating', 'p1_avatar', 'p2_name', 'p2_rating', 'p2_avatar', 'target', 'state']);

        // Rakip premium: rakip user_id'lerinden TEK sorguyla plan lookup.
        $oppIds = $rooms->map(fn ($r) => (int) $r->p1_user_id === (int) $me->id ? $r->p2_user_id : $r->p1_user_id)
            ->filter()->unique()->values();
        $premiumMap = $oppIds->isEmpty() ? [] : User::whereIn('id', $oppIds)->get(['id', 'plan', 'plan_until'])
            ->mapWithKeys(fn ($u) => [$u->id => $u->plan_active !== 'free'])->all();

        $list = $rooms->map(function ($r) use ($me, $premiumMap) {
            $mine = ((int) $r->p1_user_id === (int) $me->id) ? 'p1' : 'p2';
            $oppId = $mine === 'p1' ? $r->p2_user_id : $r->p1_user_id;
            $score = $r->state['match']['score'] ?? null;
            return [
                'code' => $r->code,
                'slot' => $mine,
                'opp_name' => $mine === 'p1' ? $r->p2_name : $r->p1_name,
                'opp_rating' => $mine === 'p1' ? $r->p2_rating : $r->p1_rating,
                'opp_avatar' => $mine === 'p1' ? $r->p2_avatar : $r->p1_avatar,
                'opp_premium' => $premiumMap[$oppId] ?? false,
                'target' => $r->target,
                'score' => $score,
            ];
        })->filter(function ($m) {
            // Hedefe ulasilmis (mac bitmis) odalari listeleme -> "devam eden" degil
            $s = $m['score'];
            $t = (int) ($m['target'] ?? 0);
            if (! $s || $t <= 0) {
                return true;
            }
            $mx = max((int) ($s['white'] ?? 0), (int) ($s['black'] ?? 0));
            return $mx < $t;
        })->values();

        return response()->json(['rooms' => $list]);
    }

    // Hizli eslesmeyi iptal et (havuzdaki bekleyen odami sil)
    public function matchmakingCancel(Request $request)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);
        Room::where('status', 'mm_waiting')
            ->where('p1_token', $data['token'])
            ->whereNull('p2_token')
            ->delete();
        return $this->ok();
    }

    // Odaya katil (kod ile)
    public function join(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
        ]);

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }

        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            // Yeni katilimci
            if ($room->p2_token) {
                return $this->fail('Oda dolu.', 409);
            }
            $room->p2_token = $data['token'];
            $room->p2_user_id = $request->user('sanctum')?->id;
            $room->p2_name = $data['name'];
            $room->p2_rating = $data['rating'] ?? null;
            $room->p2_avatar = $data['avatar'] ?? null;
            $room->status = 'playing';
            $room->save();
            $slot = 'p2';
        }

        return response()->json(['room' => $room->toClient(), 'slot' => $slot]);
    }

    // Belirli bir kodla odaya gir: yoksa olustur (p1), varsa katil (p2).
    // Turnuva maclari icin: iki oyuncu ayni kodu kullanip ayni odada bulusur.
    public function enter(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:40'],
            'rating' => ['nullable', 'integer', 'min:100', 'max:4000'],
            'avatar' => ['nullable', 'string', 'max:300000'],
            'time_control' => ['nullable', 'string', 'in:casual,normal,speed'],
        ]);
        $code = strtoupper($code);

        $room = Room::firstOrCreate(
            ['code' => $code],
            [
                'p1_token' => $data['token'],
                'p1_user_id' => $request->user('sanctum')?->id,
                'p1_name' => $data['name'],
                'p1_rating' => $data['rating'] ?? null,
                'p1_avatar' => $data['avatar'] ?? null,
                'status' => 'waiting',
                'time_control' => MatchClock::normalizeMode($data['time_control'] ?? null),
                'version' => 0,
            ],
        );

        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            if ($room->p2_token) {
                return $this->fail('Oda dolu.', 409);
            }
            $room->p2_token = $data['token'];
            $room->p2_user_id = $request->user('sanctum')?->id;
            $room->p2_name = $data['name'];
            $room->p2_rating = $data['rating'] ?? null;
            $room->p2_avatar = $data['avatar'] ?? null;
            $room->status = 'playing';
            $room->save();
            $slot = 'p2';
        }

        return response()->json(['room' => $room->toClient(), 'slot' => $slot]);
    }

    // Oda durumunu getir (polling). ?since=version verilirse degismediyse 204.
    public function show(Request $request, string $code)
    {
        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        // Poll aninda saati ilerlet + kayip (TIMEOUT/AFK_TIMEOUT/ABANDON) kosulunu uygula.
        // Token verilirse poll edenin VARLIK (presence) damgasi tazelenir -> terk tespiti.
        // (state degismeden; kayip olursa applyClockEnd version'i artirir.)
        $token = (string) $request->query('token', '');
        $slot = $token !== '' ? $this->slotOf($room, $token) : null;
        $this->tickClock($room, $slot);

        $since = (int) $request->query('since', -1);
        $unchanged = $since >= 0 && $room->version <= $since;
        $clock = $this->clockView($room);
        $clockRunning = $clock && ! empty($clock['running']);

        // Degismediyse VE saat calismiyorsa 204. Saat calisiyorsa (sira/AFK geri sayimi
        // akiyor) her poll'de guncel saat gonderilmeli -> 204 verme, ama buyuk state
        // blob'unu tekrar gondermemek icin state=null (client yalniz clock okur).
        if ($unchanged && ! $clockRunning) {
            return response()->noContent();
        }
        $payload = $room->toClient();
        if ($unchanged) {
            $payload['state'] = null;
        }
        $payload['clock'] = $clock;

        return response()->json(['room' => $payload]);
    }

    /**
     * RÖVANŞ: biten odada "ayni ayarlarla yeniden" teklifi. Her oyuncu bir kez cevap verir
     * (accept=true istiyorum / false reddediyorum). IKI taraf da 'yes' derse sunucu AYNI
     * ayarlarla (uzunluk, bahis, bet_pct, mod, tempo) YENI oda acar; kodu iki tarafa da
     * show() ile ulasir, istemciler o odaya girer. Biten oda yeniden kullanilamaz
     * (settle onu 'finished' + 'settled' isaretler) -> rovans daima yeni odadir.
     */
    public function rematch(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'accept' => ['required', 'boolean'],
        ]);
        if (! Schema::hasColumn('rooms', 'rematch_p1')) {
            return $this->fail('Rövanş bu sunucuda kapalı.', 503);
        }
        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return $this->fail('Bu odada değilsin.', 403);
        }
        if (! $room->p1_token || ! $room->p2_token) {
            return $this->fail('Rakip yok.', 409);
        }

        $room->{'rematch_'.$slot} = $data['accept'] ? 'yes' : 'no';
        $room->save();
        $room = $room->fresh();

        // Iki taraf da kabul -> yeni odayi TEK kez ac (yaris: lockForUpdate + kod bir kez yazilir).
        if ($room->rematch_p1 === 'yes' && $room->rematch_p2 === 'yes' && ! $room->rematch_code) {
            $stake = (int) $room->stake;
            $betPct = (int) $room->bet_pct;
            // C1: bahisli rovans, oyunculardan biri baska bir bahisli macta ise ACILMAZ.
            if (($stake > 0 || $betPct > 0)
                && ($this->userInStakedPlaying($room->p1_user_id, $room->id)
                    || $this->userInStakedPlaying($room->p2_user_id, $room->id))) {
                $room->{'rematch_'.$slot} = null;
                $room->save();

                return $this->fail('Devam eden bahisli maçın var.', 409);
            }
            try {
                $newCode = $this->openRematchRoom($room);
            } catch (\RuntimeException $e) {
                // Bahis karsilanamiyor -> teklifi geri al ki taraflar "bekliyor"da asili kalmasin.
                $room->rematch_p1 = null;
                $room->rematch_p2 = null;
                $room->save();

                return $this->fail($e->getMessage(), 422);
            }
            $room->rematch_code = $newCode;
        }

        return response()->json([
            'ok' => true,
            'rematch' => [
                'p1' => $room->rematch_p1,
                'p2' => $room->rematch_p2,
                'code' => $room->rematch_code,
            ],
        ]);
    }

    /**
     * Rovans odasini ayni ayarlarla ac (atomik). Slotlar KORUNUR (p1/p2 ayni oyuncu) -> istemci
     * renk/slot mantigini degistirmeden devam eder. Sabit bahiste ESCROW yeniden kurulur:
     * kullanilabilir bakiye (coins - coins_reserved) yetmiyorsa oda ACILMAZ (RuntimeException).
     */
    private function openRematchRoom(Room $old): string
    {
        return DB::transaction(function () use ($old) {
            $locked = Room::where('id', $old->id)->lockForUpdate()->first();
            if ($locked->rematch_code) {
                return $locked->rematch_code; // rakip cagrisi zaten acti
            }
            $stake = (int) $locked->stake;
            $escrowed = false;
            // ESCROW: sabit bahis -> iki oyuncunun stake'ini yeniden rezerve et (matchmaking ile ayni
            // kural). Deadlock'a karsi user'lar sirali-id kilitlenir.
            if ($stake > 0 && Schema::hasColumn('users', 'coins_reserved')
                && $locked->p1_user_id && $locked->p2_user_id) {
                $uids = [(int) $locked->p1_user_id, (int) $locked->p2_user_id];
                sort($uids);
                $lk = [];
                foreach ($uids as $uid) {
                    $lk[$uid] = User::lockForUpdate()->find($uid);
                }
                $p1u = $lk[$locked->p1_user_id] ?? null;
                $p2u = $lk[$locked->p2_user_id] ?? null;
                $avail = fn ($u) => (int) (($u->coins ?? 0) - ($u->coins_reserved ?? 0));
                if (! $p1u || ! $p2u || $avail($p1u) < $stake || $avail($p2u) < $stake) {
                    throw new \RuntimeException('Bahis için yeterli bakiye yok.');
                }
                $p1u->coins_reserved = (int) ($p1u->coins_reserved ?? 0) + $stake;
                $p2u->coins_reserved = (int) ($p2u->coins_reserved ?? 0) + $stake;
                $p1u->save();
                $p2u->save();
                $escrowed = true;
            }

            $fields = [
                'code' => $this->generateCode(),
                'p1_token' => $locked->p1_token,
                'p1_user_id' => $locked->p1_user_id,
                'p1_name' => $locked->p1_name,
                'p1_rating' => $locked->p1_rating,
                'p1_avatar' => $locked->p1_avatar,
                'p2_token' => $locked->p2_token,
                'p2_user_id' => $locked->p2_user_id,
                'p2_name' => $locked->p2_name,
                'p2_rating' => $locked->p2_rating,
                'p2_avatar' => $locked->p2_avatar,
                'status' => 'playing', // iki oyuncu da oturmus -> beklemeye gerek yok
                'stake' => $stake,
                'bet_pct' => (int) $locked->bet_pct,
                'target' => $locked->target,
                'targets' => $locked->targets,
                'mode' => $locked->mode,
                'time_control' => $locked->time_control,
                'version' => 0,
            ];
            if (Schema::hasColumn('rooms', 'stakes')) {
                $fields['stakes'] = $locked->stakes;
            }
            if (Schema::hasColumn('rooms', 'escrowed')) {
                $fields['escrowed'] = $escrowed;
            }
            // Otorite bayraklari aynen tasinir (zar/hamle kaynagi degismesin).
            if (Schema::hasColumn('rooms', 'authoritative')) {
                $fields['authoritative'] = (bool) $locked->authoritative;
            }
            if (Schema::hasColumn('rooms', 'dice_authority')) {
                $fields['dice_authority'] = (bool) $locked->dice_authority;
            }
            Room::create($fields); // yeni tohum/commit ilk zarda uretilir (provably-fair taze)

            $locked->rematch_code = $fields['code'];
            // Eski oda kapanir: rovans YENI odada oynanir (Canli Maclar'da olu oda gorunmesin,
            // C1 bahis guardi eski odayi 'oynaniyor' saymasin).
            $locked->status = 'finished';
            $locked->save();

            return $fields['code'];
        });
    }

    // Oyuncu maci TERK eder -> TERK EDEN KAYBEDER (rakip kazanir). Anlik forfeit.
    // Sekme kapama/gezinme sirasinda cagrilir (sendBeacon); presence 60sn'yi beklemeden
    // sonucu netlestirir. Yalniz CANLI (playing, bitmemis) macta anlamli.
    public function leave(Request $request, string $code)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);
        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return response()->json(['ok' => true]);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return response()->json(['ok' => true]); // odada degil -> yapacak sey yok
        }
        $clock = is_array($room->clock) ? $room->clock : [];
        $ended = ! empty($clock['end']) || $room->status === 'finished';
        if ($room->status === 'playing' && ! $ended) {
            // Terk eden = $slot -> rakip kazanir. applyClockEnd skoru/gameEnd'i yazar,
            // p{slot}_result + end_reason'i set eder (istemci sync'te otoriter sonucu gorur).
            $clock['end'] = ['reason' => 'ABANDON', 'winner' => MatchClock::other($slot)];
            $this->applyClockEnd($room, $clock);
            $room->clock = $clock;
            $room->save();
        }

        return response()->json(['ok' => true, 'clock' => $this->clockView($room)]);
    }

    // Oyun durumunu guncelle (hamle). Sadece odadaki oyuncular.
    public function update(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'state' => ['required', 'array'],
            'status' => ['nullable', 'string', 'in:playing,finished'],
        ]);

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return $this->fail('Bu odada değilsin.', 403);
        }

        // ---- BAĞIMSIZ Faz 1: sunucu-otoriter ZAR eşleşmesi (dice_authority odalar) ----
        // İstemcinin OYNADIĞI zar (state.turnStart.dice) SUNUCUNUN verdiği açık elle eşleşmeli;
        // aksi halde istemci kendi zarını enjekte etmiş -> REDDET (zar değeri seçme hilesi kapanır).
        // Tur rengi değişince açık el tüketilmiş sayılır (sıradaki roll yeni el üretir).
        if ($room->dice_authority && ! $room->authoritative) {
            $prev = is_array($room->state) ? $room->state : null;
            $newDiceKey = $this->diceBaseKey($data['state']['turnStart']['dice'] ?? null);

            if ($newDiceKey !== null) {
                $issued = (int) $room->dice_roll_index;
                $consumed = (int) $room->dice_consumed;
                $rolls = is_array($room->dice_rolls) ? $room->dice_rolls : [];
                $openKey = ($issued > $consumed && ! empty($rolls))
                    ? $this->diceBaseKey($rolls[count($rolls) - 1]['dice'] ?? null)
                    : null;

                // AÇILIŞ MUAFİYETİ: her oyunun ilk eli serverRoll'dan GELMEZ; oda kodu + oyun no'dan
                // DETERMINISTIK üretilir (iki istemci aynı). Sunucu aynı değeri yeniden hesaplar
                // (SeededOpening = JS `seededOpening` byte-exact portu) ve o eli MUAF tutar.
                // gameNo = maça dek toplam puan (state.match.score) — istemci ile aynı formül.
                $score = $data['state']['match']['score'] ?? null;
                $gameNo = is_array($score)
                    ? (int) ($score['white'] ?? 0) + (int) ($score['black'] ?? 0)
                    : 0;
                $openingKey = $this->diceBaseKey(\App\Support\SeededOpening::dice($room->code, $gameNo));

                $mismatch = ($newDiceKey !== $openKey && $newDiceKey !== $openingKey);
                if ($mismatch) {
                    if (config('dice.enforce', false)) {
                        // ENFORCE: istemci zarı sunucununkiyle uyuşmuyor -> reddet (hile kapanır).
                        return $this->fail('Zar sunucudan alınmalı (geçersiz zar).', 422, ['reason' => 'dice-forgery']);
                    }
                    // SHADOW: reddetme ama LOGLA -> canlıda enforce açmadan önce yanlış-red
                    // (meşru oyunu kıracak edge-case) var mı gör. Beklenen: hiç log olmamalı.
                    \Illuminate\Support\Facades\Log::warning('dice.shadow-mismatch', [
                        'room' => $room->code, 'slot' => $slot, 'played' => $newDiceKey,
                        'open' => $openKey, 'opening' => $openingKey, 'gameNo' => $gameNo,
                    ]);
                }
            }

            // Tüketim: tur rengi değiştiyse açık el(ler) tüketildi -> consumed = issued.
            $prevTurn = $prev['turnStart']['turn'] ?? null;
            $newTurn = $data['state']['turnStart']['turn'] ?? null;
            if ($prevTurn !== null && $newTurn !== null && $prevTurn !== $newTurn) {
                $room->dice_consumed = (int) $room->dice_roll_index;
            }
        }

        $room->state = $data['state'];
        $room->version = $room->version + 1;
        if (! empty($data['status'])) {
            $room->status = $data['status'];
        }

        // ---- Sunucu-otoriter saat + AFK ----
        $now = microtime(true);
        $clock = is_array($room->clock) ? $room->clock : [];
        if (empty($clock)) {
            // Ilk gercek guncelleme: state.match.target biliniyorsa saati kur.
            $target = (int) ($data['state']['match']['target'] ?? $room->target ?? 0);
            if ($target > 0) {
                $clock = MatchClock::init($room->time_control, $target, $now);
            }
        }
        if (! empty($clock)) {
            // $slot = istegi yapanin slotu -> sira DEVRINI yalniz sira sahibi tetikleyebilir.
            $clock = MatchClock::onUpdate($clock, $data['state'], $slot, $now);
            $clock = MatchClock::seen($clock, $slot, $now); // hamle yapan present
            if (! empty($clock['end'])) {
                $this->applyClockEnd($room, $clock);
            } else {
                $this->tagNormalEnd($room, $data['state']);
            }
            $room->clock = $clock;
        } else {
            $this->tagNormalEnd($room, $data['state']);
        }

        $room->save();

        return response()->json([
            'version' => $room->version,
            'status' => $room->status,
            'clock' => $this->clockView($room),
        ]);
    }

    // Saati poll aninda ilerlet: kayip kosulu olustuysa maci sonlandir (idempotent).
    // $slot verilirse poll edenin VARLIK damgasi (throttle ile) tazelenir -> terk tespiti.
    private function tickClock(Room $room, ?string $slot = null): void
    {
        $clock = $room->clock;
        if (! is_array($clock) || empty($clock)) {
            return;
        }
        if (! empty($clock['end'])) {
            return;
        }
        // MAC BITTI -> saat DURUR. Aksi halde kazanan ilan edildikten sonra da her poll'da
        // tick isliyor ve istemci sonuc ekraninin ARKASINDA akan bir sayac gosteriyordu.
        $sm = is_array($room->server_match) ? $room->server_match : null;
        if ($room->status === 'finished' || ($sm && ! empty($sm['done']))) {
            return;
        }
        $now = microtime(true);
        $changed = false;
        // Varlik damgasi: en fazla ~4sn'de bir yaz (poll her ~1.5sn; gereksiz DB yazma yok).
        if ($slot !== null) {
            $prev = (float) ($clock[$slot.'_seen'] ?? 0);
            if ($now - $prev >= 4.0) {
                $clock = MatchClock::seen($clock, $slot, $now);
                $changed = true;
            }
        }
        $ticked = MatchClock::tick($clock, $now);
        if (! empty($ticked['end'])) {
            $clock = $ticked;
            $this->applyClockEnd($room, $clock);
            $changed = true;
        }
        if ($changed) {
            $room->clock = $clock;
            $room->save();
        }
    }

    /**
     * AUTHORITATIVE saat: legacy update() çağrılmadığı için saati server_state/server_match'ten
     * SÜR. İlk çağrıda init; her aksiyonda (roll/move/cube/resign) segment ilerler. turnsPlayed
     * yerine server_version (monotonik) -> imza her aksiyonda değişir; onUpdate delay+bankayı
     * doğru işler. Kayıp olursa applyClockEnd (server_match forfeit). $room->clock set edilir
     * (çağıran KAYDEDER). AFK/presence/timeout MatchClock ile aynı (legacy ile ortak motor).
     */
    private function driveAuthoritativeClock(Room $room, string $slot, float $now): void
    {
        $clock = is_array($room->clock) ? $room->clock : [];
        if (empty($clock)) {
            $target = (int) (($room->server_match['target'] ?? null) ?? $room->target ?? 1);
            $clock = MatchClock::init($room->time_control, max(1, $target), $now);
        }
        $ss = is_array($room->server_state) ? $room->server_state : [];
        $sm = is_array($room->server_match) ? $room->server_match : [];
        $winner = $ss ? \App\Support\Backgammon::winner($ss) : null;
        $clockState = [
            'turnStart' => ['turn' => $ss['turn'] ?? 'white'],
            'played' => [],
            'turnsPlayed' => (int) $room->server_version, // monotonik: her aksiyonda imza değişir
            'starter' => '',
            'match' => ['cube' => $sm['cube'] ?? ['value' => 1, 'owner' => null]],
            'cubePending' => $sm['cube']['pending'] ?? null,
            'gameEnd' => $winner ? ['winner' => $winner] : null,
            'matchOver' => ! empty($sm['done']),
        ];
        $clock = MatchClock::onUpdate($clock, $clockState, $slot, $now);
        $clock = MatchClock::seen($clock, $slot, $now);
        if (! empty($clock['end'])) {
            $this->applyClockEnd($room, $clock);
        }
        $room->clock = $clock;
    }

    // Istemciye donen canli saat goruntusu (beyaz/siyah/delay/aktif/AFK/kayip) veya null.
    private function clockView(Room $room): ?array
    {
        $clock = $room->clock;
        if (! is_array($clock) || empty($clock)) {
            return null;
        }

        return MatchClock::clientView($clock, microtime(true));
    }

    // Saat kaybini (TIMEOUT/AFK_TIMEOUT) mac sonucuna yansit: forfeit + karsilikli sonuc + end_reason.
    // Saat sahiplik-korumali oldugu icin sunucunun belirledigi kazanan guvenlidir (forge-korumasi).
    private function applyClockEnd(Room $room, array $clock): void
    {
        $end = $clock['end'];
        $winnerSlot = $end['winner']; // 'p1'|'p2'
        $reason = $end['reason'];     // TIMEOUT|AFK_TIMEOUT
        $winnerColor = $winnerSlot === 'p1' ? 'white' : 'black';

        // AUTHORITATIVE (Faz 2): timeout/AFK forfeit'i server_match'e YANSIT (RoomResult/settle
        // authoritative iken burayı okur). Kazanan hedefe ulaşır -> maç biter. Küp değeriyle.
        if ($room->authoritative) {
            $sm = is_array($room->server_match) ? $room->server_match : $this->initServerMatch($room);
            if (empty($sm['done'])) {
                $target = (int) ($sm['target'] ?? $room->target ?? 1);
                $cubeVal = (int) ($sm['cube']['value'] ?? 1);
                $sm['score'][$winnerColor] = max($target, (int) ($sm['score'][$winnerColor] ?? 0) + max(1, $cubeVal));
                $sm['done'] = true;
                $sm['winner'] = $winnerColor;
                $sm['cube']['pending'] = null;
                $room->server_match = $sm;
                $room->server_winner = $winnerColor;
                $room->server_version = (int) $room->server_version + 1;
            }
        }

        $state = is_array($room->state) ? $room->state : [];
        if (empty($state['gameEnd'])) {
            $match = is_array($state['match'] ?? null) ? $state['match'] : [];
            $target = (int) ($room->target ?? ($match['target'] ?? 1));
            $score = is_array($match['score'] ?? null) ? $match['score'] : ['white' => 0, 'black' => 0];
            $cubeVal = (int) ($match['cube']['value'] ?? 1);
            // Forfeit: kazanan hedefe ulassin (mac-basi kayip; mevcut lokal timeout ile ayni mantik).
            $score[$winnerColor] = max($target, (int) ($score[$winnerColor] ?? 0) + max(1, $cubeVal));
            if (! empty($match)) {
                $match['score'] = $score;
                $state['match'] = $match;
            }
            $state['gameEnd'] = [
                'winner' => $winnerColor,
                'points' => $cubeVal,
                'mult' => 1,
                'dropped' => false,
                'timeout' => true,
            ];
            $room->state = $state;
            $room->version = $room->version + 1;
        }
        if ($room->p1_result === null) {
            $room->p1_result = $winnerSlot === 'p1' ? 'won' : 'lost';
        }
        if ($room->p2_result === null) {
            $room->p2_result = $winnerSlot === 'p2' ? 'won' : 'lost';
        }
        $room->status = 'finished';
        if ($room->end_reason === null) {
            $room->end_reason = $reason;
        }

        // TERK EDEN KAYBEDER (sunucu-otoriter kayit): kaybedenin rating + maglubiyet +
        // match_results satirini SUNUCUDA yaz -> istemci raporlamasa (sekme kapali) bile
        // sicile yansisin. Puansiz (friendly) oda haric. Idempotent (bkz ForfeitLoss).
        if ($room->mode !== 'friendly') {
            $loserSlot = $winnerSlot === 'p1' ? 'p2' : 'p1';
            $loserId = (int) ($loserSlot === 'p1' ? $room->p1_user_id : $room->p2_user_id);
            $oppRating = (int) ($winnerSlot === 'p1' ? $room->p1_rating : $room->p2_rating);
            $winnerName = $winnerSlot === 'p1' ? $room->p1_name : $room->p2_name;
            $matchType = ((int) $room->stake > 0 || (int) $room->bet_pct > 0) ? 'coin' : 'match';
            \App\Support\ForfeitLoss::record(
                $room->code, $loserId, $oppRating, (int) $room->target, $matchType, $winnerName,
            );
        }
    }

    // Normal galibiyet/terk icin end_reason etiketle (yalnizca mac gercekten bittiyse).
    private function tagNormalEnd(Room $room, array $state): void
    {
        if ($room->end_reason !== null) {
            return;
        }
        $ge = $state['gameEnd'] ?? null;
        if (! is_array($ge)) {
            return;
        }
        $target = (int) ($room->target ?? ($state['match']['target'] ?? 0));
        $score = $state['match']['score'] ?? null;
        $decided = $target > 0 && is_array($score)
            && max((int) ($score['white'] ?? 0), (int) ($score['black'] ?? 0)) >= $target;
        if (! $decided) {
            return; // tek oyun bitti ama mac suruyor
        }
        if (! empty($ge['resigned'])) {
            $room->end_reason = 'RESIGN';
        } elseif (! empty($ge['timeout'])) {
            $room->end_reason = 'TIMEOUT';
        } else {
            $room->end_reason = 'NORMAL_WIN';
        }
    }

    // Sohbet mesaji gonder (odadaki oyuncular). Son 50 mesaj tutulur.
    public function chat(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'text' => ['required', 'string', 'max:280'],
        ]);

        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return $this->fail('Bu odada değilsin.', 403);
        }

        $name = $slot === 'p1' ? $room->p1_name : $room->p2_name;
        $messages = $room->messages ?? [];
        $messages[] = [
            'slot' => $slot,
            'name' => $name,
            'text' => trim($data['text']),
            'id' => (string) round(microtime(true) * 1000).'-'.$slot,
        ];
        // Son 50 mesaji tut
        if (count($messages) > 50) {
            $messages = array_slice($messages, -50);
        }
        $room->messages = $messages;
        $room->save();

        return response()->json(['messages' => $messages]);
    }

    // Canlı maç İZLEME presence (spectator heartbeat). İzleyici her ~5sn'de bir çağırır; kayıt
    // upsert edilir, bayat (>15sn) izleyiciler temizlenir. OYUNCU (slot sahibi) izleyici SAYILMAZ.
    // Güncel izleyici listesi (isim + avatar/çerçeve) ve sayısını döner. Herkese açık.
    public function watch(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'name' => ['nullable', 'string', 'max:60'],
            'leave' => ['nullable', 'boolean'],
        ]);
        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return $this->fail('Oda bulunamadı.', 404);
        }
        // Migration henüz koşmadıysa (tablo yok) sessizce boş dön -> istemci kırılmaz.
        if (! Schema::hasTable('room_viewers')) {
            return response()->json(['viewers' => [], 'count' => 0]);
        }
        $codeU = strtoupper($code);
        $now = microtime(true);

        if (! empty($data['leave'])) {
            // Sekme kapanışı (best-effort): kaydı hemen sil.
            DB::table('room_viewers')->where('room_code', $codeU)->where('token', $data['token'])->delete();
        } elseif ($this->slotOf($room, $data['token']) === null) {
            // Oyuncu değil -> izleyici olarak kaydet/tazele (upsert).
            $user = $request->user('sanctum');
            $name = $user?->nickname ?: ($user?->first_name ?: ($data['name'] ?: 'Misafir'));
            DB::table('room_viewers')->updateOrInsert(
                ['room_code' => $codeU, 'token' => $data['token']],
                ['user_id' => $user?->id, 'name' => mb_substr((string) $name, 0, 60), 'last_seen' => $now, 'updated_at' => now()],
            );
        }

        // Bayat izleyicileri (>15sn görünmeyen) temizle.
        DB::table('room_viewers')->where('room_code', $codeU)->where('last_seen', '<', $now - 15)->delete();

        $rows = DB::table('room_viewers')->where('room_code', $codeU)->orderByDesc('last_seen')->limit(100)->get();
        $uids = $rows->pluck('user_id')->filter()->unique()->values()->all();
        $users = $uids ? User::whereIn('id', $uids)->get(['id', 'avatar', 'avatar_frame'])->keyBy('id') : collect();
        $viewers = $rows->map(fn ($v) => [
            'name' => $v->name,
            'avatar' => ($v->user_id && isset($users[$v->user_id])) ? $users[$v->user_id]->avatar : null,
            'frame' => ($v->user_id && isset($users[$v->user_id])) ? $users[$v->user_id]->avatar_frame : null,
        ])->values();

        return response()->json(['viewers' => $viewers, 'count' => $viewers->count()]);
    }

    // ============ SUNUCU-OTORİTER ZAR + HAMLE (para maçı güvenliği Faz 2b) ============
    // p1 = white, p2 = black.
    private function slotColor(string $slot): string
    {
        return $slot === 'p1' ? 'white' : 'black';
    }

    /**
     * BAĞIMSIZ Faz 1 zarı: sunucu commit-reveal zarı verir; server_state TUTMAZ (hamle/tahta
     * legacy). Aynı anda TEK açık (tüketilmemiş) el -> idempotent + zar peek-ahead engeli.
     * Yeni el ancak önceki tüketilince (update()'te tur rengi değişince consumed++) verilir.
     */
    private function rollStandalone(Room $room, string $slot, array $data, \App\Services\FairDiceService $dice)
    {
        // Lazy init: gizli tohum + taahhüt (ilk roll). dice_roll_index=VERİLEN, dice_consumed=TÜKETİLEN.
        if (empty($room->dice_seed)) {
            $room->dice_seed = $dice->newSeed();
            $room->dice_commit = $dice->commit($room->dice_seed);
            $room->dice_client_seed = substr((string) ($data['client_seed'] ?? ''), 0, 40);
            $room->dice_roll_index = 0;
            $room->dice_consumed = 0;
            $room->dice_rolls = [];
        }

        $issued = (int) $room->dice_roll_index;
        $consumed = (int) $room->dice_consumed;
        $rolls = is_array($room->dice_rolls) ? $room->dice_rolls : [];

        // Açık el varsa AYNISINI döndür (idempotent): tekrar zar isteyip "daha iyi" değer
        // seçilemez; ileri el peek EDİLEMEZ (sıradaki el ancak tüketimden sonra üretilir).
        if ($issued > $consumed && ! empty($rolls)) {
            $last = $rolls[count($rolls) - 1];

            return response()->json([
                'index' => (int) ($last['index'] ?? $consumed),
                'dice' => $last['dice'],
                'commit' => $room->dice_commit,
                'version' => (int) $room->version,
                'reused' => true,
            ]);
        }

        // Yeni el üret (deterministik, sunucu-otoriter). Çift ise 4 hane (istemci beklentisi).
        $index = $consumed;
        [$d1, $d2] = $dice->roll($room->dice_seed, (string) $room->dice_client_seed, $index);
        $out = $d1 === $d2 ? [$d1, $d1, $d1, $d1] : [$d1, $d2];

        $rolls[] = ['index' => $index, 'slot' => $slot, 'dice' => $out];
        $room->dice_rolls = $rolls;
        $room->dice_roll_index = $index + 1;
        $room->save();

        return response()->json([
            'index' => $index,
            'dice' => $out,
            'commit' => $room->dice_commit,
            'version' => (int) $room->version,
            'reused' => false,
        ]);
    }

    /**
     * Zar dizisini karşılaştırılabilir "temel çift" anahtarına indirger:
     * çift (4 hane [d,d,d,d]) -> "d-d"; normal (2 hane) -> küçük-büyük "a-b".
     * Boş/geçersiz -> null (oynanan el yok). Tur içi tekrar PUT'larda kararlı (turnStart.dice sabit).
     */
    private function diceBaseKey($dice): ?string
    {
        if (! is_array($dice) || count($dice) === 0) {
            return null;
        }
        $vals = array_values(array_map('intval', $dice));
        // Hepsi eşit (çift): 4 hane [d,d,d,d] veya beklenmedik biçim -> d-d.
        if (count(array_unique($vals)) === 1) {
            return $vals[0].'-'.$vals[0];
        }
        sort($vals);

        return $vals[0].'-'.$vals[count($vals) - 1];
    }

    // Sunucu-otoriter maç durumunu (skor 0-0) kur. target: odanın maç uzunluğu (yoksa 1).
    private function initServerMatch(Room $room): array
    {
        return [
            'target' => (int) ($room->target ?? 1),
            'score' => ['white' => 0, 'black' => 0],
            'gameNo' => 1,
            'done' => false,
            'winner' => null,
            // Faz 2 KÜP: value=küp değeri, owner=küpü elinde tutan (null=ortada), pending=teklif
            // eden renk (yanıt bekleniyor) veya null. Her yeni oyunda ortaya döner.
            'cube' => ['value' => 1, 'owner' => null, 'pending' => null],
            // CRAWFORD: crawford=bu oyun Crawford oyunu (çift YASAK); crawfordDone=Crawford oyunu
            // oynandı (sonrası çift serbest). Bir oyuncu ilk kez (target-1)'e ulaşınca SONRAKİ oyun.
            'crawford' => false,
            'crawfordDone' => false,
            // opened=bu oyunun AÇILIŞ eli atıldı mı (başlayan belirlendi). Yeni oyunda false.
            'opened' => false,
            // turns=bu OYUNDA tamamlanan tur sayısı. KÜP HAKKI buna bağlı: açılış eli
            // oynanmadan (turns=0) küp teklif edilemez. İstemci turnsPlayed'i BURADAN alır
            // (otoriter modda yerel sayaç artmaz). Her yeni oyunda 0'a döner.
            'turns' => 0,
        ];
    }

    /** server_match.cube (yoksa varsayılan: 1/ortada). */
    private function cubeOf(Room $room): array
    {
        $c = (is_array($room->server_match) ? $room->server_match : [])['cube'] ?? [];

        return [
            'value' => (int) ($c['value'] ?? 1),
            'owner' => $c['owner'] ?? null,
            'pending' => $c['pending'] ?? null,
        ];
    }

    /**
     * MERKEZİ KÜP KURAL KONTROLÜ (sunucu-otoriter): $color oyuncusu ŞU AN küpü teklif
     * edebilir mi? Sonuç ['allowed'=>bool, 'reason'=>?string]. Frontend engine/match.ts
     * `cubeAvailability` ile AYNI kural kümesi; buton ile enforce tek kaynaktan.
     *
     * reason kodları (net neden):
     *  INVALID_MATCH_STATE   - oda/durum/maç yok ya da otoriter değil
     *  GAME_FINISHED         - maç bitti
     *  CRAWFORD_GAME         - Crawford oyunu (çift yasak)
     *  ONE_POINT_MATCH       - 1 puanlık maç: kup hiç kullanılmaz
     *  NOT_PLAYERS_TURN      - sıra sende değil
     *  DICE_ALREADY_ROLLED   - zar atıldı (küp yalnız zar atmadan önce)
     *  OPENING_NOT_PLAYED    - açılış eli oynanmadı (turns=0)
     *  DOUBLE_ALREADY_PENDING- bekleyen bir küp teklifi var
     *  CUBE_AT_MAX           - küp 64 tavanda (daha fazla katlanamaz)
     *  NOT_CUBE_OWNER        - küp rakibin elinde
     *  DEAD_CUBE             - ölü küp: katlamak teklif edene puan kazandırmaz
     */
    private function cubeAvailability(Room $room, string $color): array
    {
        $deny = fn (string $reason) => ['allowed' => false, 'reason' => $reason];

        if (! $room->authoritative) {
            return $deny('INVALID_MATCH_STATE');
        }
        $state = is_array($room->server_state) ? $room->server_state : null;
        $sm = is_array($room->server_match) ? $room->server_match : null;
        if (! $state || ! $sm) {
            return $deny('INVALID_MATCH_STATE');
        }
        if (! empty($sm['done'])) {
            return $deny('GAME_FINISHED');
        }
        if (! empty($sm['crawford'])) {
            return $deny('CRAWFORD_GAME');
        }
        $target = (int) ($sm['target'] ?? 1);
        if ($target <= 1) {
            // 1 puanlık maç: tek oyun maçı bitirir -> küp anlamsız (gerçek tavla kuralı).
            return $deny('ONE_POINT_MATCH');
        }
        if (($state['turn'] ?? 'white') !== $color) {
            return $deny('NOT_PLAYERS_TURN');
        }
        if (! empty($state['dice'])) {
            // Küp yalnızca sıra sahibinin zar ATMADAN önceki hakkıdır.
            return $deny('DICE_ALREADY_ROLLED');
        }
        if ((int) ($sm['turns'] ?? 0) < 1) {
            // Açılış eli oynanmadan küp teklif edilemez (turnsPlayed>0 şartı, frontend ile aynı).
            return $deny('OPENING_NOT_PLAYED');
        }
        $cube = $this->cubeOf($room);
        if ($cube['pending'] !== null) {
            return $deny('DOUBLE_ALREADY_PENDING');
        }
        if ($cube['value'] >= 64) {
            return $deny('CUBE_AT_MAX');
        }
        if ($cube['owner'] !== null && $cube['owner'] !== $color) {
            return $deny('NOT_CUBE_OWNER');
        }
        // ÖLÜ KÜP: küpün MEVCUT değeri, teklif edenin maçı bitirmesi için gereken puanı zaten
        // karşılıyorsa katlamak ona hiçbir şey kazandırmaz (oyunu kazanınca maç zaten biter).
        $need = $target - (int) ($sm['score'][$color] ?? 0);
        if ($cube['value'] >= $need) {
            return $deny('DEAD_CUBE');
        }

        return ['allowed' => true, 'reason' => null];
    }

    /** cubeAvailability reason kodu -> kullanıcıya gösterilecek Türkçe mesaj. */
    private function cubeDenyMessage(?string $reason): string
    {
        return match ($reason) {
            'GAME_FINISHED' => 'Oyun aktif değil.',
            'CRAWFORD_GAME' => 'Crawford oyununda küp kullanılamaz.',
            'ONE_POINT_MATCH' => 'Tek puanlık maçta küp kullanılmaz.',
            'NOT_PLAYERS_TURN' => 'Sıra sende değil.',
            'DICE_ALREADY_ROLLED' => 'Zar atıldıktan sonra küp teklif edilemez.',
            'OPENING_NOT_PLAYED' => 'Açılış eli oynanmadan küp teklif edilemez.',
            'DOUBLE_ALREADY_PENDING' => 'Zaten bekleyen bir küp teklifi var.',
            'CUBE_AT_MAX' => 'Küp en yüksek değerde (64) — daha fazla katlanamaz.',
            'NOT_CUBE_OWNER' => 'Küp rakibin elinde — teklif edemezsin.',
            'DEAD_CUBE' => 'Bu skorda küpü yükseltmenin maça etkisi yok (ölü küp).',
            default => 'Küp teklif edilemez.',
        };
    }

    /**
     * OYUN sonucunu maça yaz: kazananın skoruna $points ekle, gameNo++, küpü ortaya döndür,
     * maç bitti mi (target) belirle. Bitmediyse server_state'i YENİ oyuna sıfırla; bittiyse
     * dokunma (çağıran son tahtayı korur). matchDone döner. move()/drop/resign ORTAK kullanır.
     */
    private function applyGameResult(Room $room, string $winner, int $points): bool
    {
        $sm = is_array($room->server_match) ? $room->server_match : $this->initServerMatch($room);
        $wasCrawford = ! empty($sm['crawford']);
        $sm['score'][$winner] = (int) ($sm['score'][$winner] ?? 0) + $points;
        $sm['gameNo'] = (int) ($sm['gameNo'] ?? 1) + 1;
        $sm['cube'] = ['value' => 1, 'owner' => null, 'pending' => null]; // yeni oyun: küp ortada
        $sm['opened'] = false; // sonraki oyun yeni açılış eli ister
        $sm['turns'] = 0; // yeni oyun: tur sayacı sıfır -> açılış elinden önce küp yok
        $target = (int) ($sm['target'] ?? 1);
        $done = (int) $sm['score'][$winner] >= $target;
        if ($done) {
            $sm['done'] = true;
            $sm['winner'] = $winner;
            $room->server_winner = $winner;
            // server_state son tahtada kalır (çağıran ayarlar).
        } else {
            // CRAWFORD geçişi: Crawford oyunu YENİ bittiyse -> sonrası serbest (crawfordDone).
            // Değilse ve biri ilk kez (target-1)'e ulaştıysa -> SONRAKİ oyun Crawford (çift yasak).
            if (! empty($sm['crawfordDone'])) {
                $sm['crawford'] = false;
            } elseif ($wasCrawford) {
                $sm['crawford'] = false;
                $sm['crawfordDone'] = true;
            } elseif (max((int) $sm['score']['white'], (int) $sm['score']['black']) === $target - 1) {
                $sm['crawford'] = true;
            }
            $room->server_state = \App\Support\Backgammon::initialState(); // sonraki oyun temiz tahta
        }
        $room->server_match = $sm;

        return $done;
    }

    private function otherColor(string $color): string
    {
        return $color === 'white' ? 'black' : 'white';
    }

    /**
     * Faz 2 TAM otorite bu eşleşmede açılsın mı? İki karar yolu:
     *  - TEST allow-list: iki oyuncu da `game.authoritative_users` listesinde (staked olmasa bile)
     *    -> 2-hesapla güvenli staging (global kapalıyken yalnız bu çift etkilenir).
     *  - GLOBAL: `game.server_authoritative` açık -> TÜM maçlar (bahisli + ücretsiz/arkadaşlık).
     *    (Kullanıcı direktifi: herkes test etsin. Bahis koşulu kaldırıldı.)
     */
    private function shouldAuthoritative(?int $u1, ?int $u2, bool $staked): bool
    {
        // PARA GÜVENLİĞİ (C1): bahisli oda (stake/bet) HER ZAMAN authoritative — global flag
        // KAPALI olsa bile. Böylece settle mutual-consent'e düşemez; iki-hesap collusion ile
        // coin transferi (kaybeden 'lost' + kazanan 'won' anlaşması) KAPANIR. Kazanan yalnız
        // sunucunun server_match'inden gelir (forge edilemez).
        if ($staked) {
            return true;
        }

        $allow = config('game.authoritative_users', []);
        if ($u1 && $u2 && $allow && in_array((int) $u1, $allow, true) && in_array((int) $u2, $allow, true)) {
            return true;
        }

        // GLOBAL açıksa ücretsiz maçlar da authoritative.
        return (bool) config('game.server_authoritative', false);
    }

    /**
     * Sunucu-otoriter ZAR: sıradaki oyuncu bir el zar ister. Zar SUNUCUDA (commit-reveal)
     * üretilir; istemci SEÇEMEZ. RE-ROLL ENGELİ: zar ancak server_state.dice BOŞKEN verilir;
     * bir kez verilince geçerli bir hamle tüketene kadar yeni zar VERİLMEZ (aynısı döner).
     */
    public function roll(Request $request, string $code, \App\Services\FairDiceService $dice)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'client_seed' => ['nullable', 'string', 'max:40'],
        ]);

        return DB::transaction(function () use ($data, $code, $dice) {
            $room = Room::where('code', strtoupper($code))->lockForUpdate()->first();
            if (! $room) {
                return $this->fail('Oda bulunamadı.', 404);
            }
            $slot = $this->slotOf($room, $data['token']);
            if ($slot === null) {
                return $this->fail('Bu odada değilsin.', 403);
            }
            // YENİ TUR = eski canlı önizleme geçersiz. `room.live` yalnız yeni POST üzerine yazıldığı
            // için tur değişince ESKİ turun adımlarını (ör. bardan giriş) taşımaya devam ederdi; zar
            // atan istemci onu güncel tahtaya HAYALET oynatırdı. Zar başında temizle (sunucu-tarafı
            // sertleştirme; istemci de live.seq!==turnsPlayed ile eler). Bu save eden tüm dalları kapsar.
            $room->live = null;

            // ---- BAĞIMSIZ Faz 1: yalnız ZAR sunucudan (hamle/tahta/küp LEGACY kalır) ----
            // authoritative TAM yol DEĞİL: sunucu server_state tutmaz; sadece commit-reveal zarı
            // verir, update() eşleşmeyi zorlar. Tek açık el (idempotent + peek-ahead engeli).
            if ($room->dice_authority && ! $room->authoritative) {
                return $this->rollStandalone($room, $slot, $data, $dice);
            }

            // Lazy init: otoriter durum + tohum/taahhüt + maç skoru (ilk roll).
            $state = is_array($room->server_state) ? $room->server_state : null;
            if (! $state) {
                $state = \App\Support\Backgammon::initialState();
            }
            if (! is_array($room->server_match)) {
                $room->server_match = $this->initServerMatch($room);
            }
            if (empty($room->dice_seed)) {
                $room->dice_seed = $dice->newSeed();
                $room->dice_commit = $dice->commit($room->dice_seed);
                $room->dice_client_seed = substr((string) ($data['client_seed'] ?? ''), 0, 40);
                $room->dice_roll_index = 0;
                $room->dice_rolls = [];
            }

            // ---- AÇILIŞ ELİ (Adım C): oyunun ilk eli ADİL açılış — iki oyuncu 1'er zar, YÜKSEK
            // başlar (asla çift, asla berabere). SUNUCUDA deterministik (seed + gameNo). Başlayan
            // belli olmadığı için SIRA KONTROLÜ YOK (ilk çağıran tetikler; diğerine poll ile gelir).
            $sm = is_array($room->server_match) ? $room->server_match : $this->initServerMatch($room);
            if (empty($sm['opened'])) {
                $gameNo = (int) ($sm['gameNo'] ?? 1);
                $base = $gameNo * 4; // 'single' HMAC alanı (normal 'roll' alanından bağımsız)
                $cs = (string) $room->dice_client_seed;
                $wDie = $dice->single($room->dice_seed, $cs, $base);
                $bDie = $dice->single($room->dice_seed, $cs, $base + 1);
                for ($k = 2; $wDie === $bDie; $k++) { // berabere olamaz -> farklı çıkana kadar
                    $bDie = $dice->single($room->dice_seed, $cs, $base + $k);
                }
                $starter = $wDie > $bDie ? 'white' : 'black';
                $state['turn'] = $starter;
                $state['dice'] = [max($wDie, $bDie), min($wDie, $bDie)]; // başlayan bu çifti oynar
                $state['diceUsed'] = [false, false];
                $sm['opened'] = true;

                $rolls = is_array($room->dice_rolls) ? $room->dice_rolls : [];
                $rolls[] = ['opening' => $gameNo, 'white' => $wDie, 'black' => $bDie, 'starter' => $starter];
                $room->dice_rolls = $rolls;
                $room->server_state = $state;
                $room->server_match = $sm;
                $room->server_version = (int) $room->server_version + 1;
                $this->driveAuthoritativeClock($room, $slot, microtime(true)); // açılış -> saati başlat
                $room->save();

                return response()->json([
                    'dice' => $state['dice'],
                    'starter' => $starter,
                    'opening' => true,
                    'commit' => $room->dice_commit,
                    'version' => (int) $room->server_version,
                    'reused' => false,
                ]);
            }

            // AÇILIŞ ZATEN YAPILDI ama HENÜZ OYNANMADI (turns=0 + zar duruyor): İKİNCİ çağırana
            // da açılışı AYNEN döndür (starter + zar). Aksi halde açılış yarışını kaybeden taraf
            // 409/reused alıp poll'a kalıyordu; poll'un TEK bir apply'ı kaçırması (sürüm
            // muhasebesi/istisna/yarış) o istemciyi "Açılış zarı atılıyor…" ekranında KALICI
            // olarak kilitliyordu (yaşanan canlı bug). Zar ÜRETİLMEZ -> idempotent ve adil.
            // GÜVENLİK: yalnız TAHTA HENÜZ BAŞLANGIÇ KONUMUNDAYKEN (hiçbir taş oynanmamış).
            // 'turns' alanı olmayan ESKİ odalarda (?? 0) bu dal oyun ortasında tetiklenip
            // istemciye taze tahta kurdurabilirdi -> konum kaybı. Konum kontrolü bunu keser.
            $fresh = \App\Support\Backgammon::initialState()['points'];
            if ((int) ($sm['turns'] ?? 0) === 0 && ! empty($state['dice'])
                && ($state['points'] ?? null) === $fresh) {
                return response()->json([
                    'dice' => $state['dice'],
                    'starter' => $state['turn'] ?? 'white',
                    'opening' => true,
                    'commit' => $room->dice_commit,
                    'version' => (int) $room->server_version,
                    'reused' => true,
                ]);
            }

            // Sıra kontrolü: yalnız sıra sahibi zar atabilir.
            if (($state['turn'] ?? 'white') !== $this->slotColor($slot)) {
                return $this->fail('Sıra sende değil.', 409);
            }
            // Bekleyen küp teklifi varsa zar ATILAMAZ (önce take/drop yanıtı gelmeli).
            if ($this->cubeOf($room)['pending'] !== null) {
                return $this->fail('Önce küp teklifine yanıt ver.', 409);
            }

            // RE-ROLL ENGELİ: zar zaten verilmişse (dice dolu) aynısını döndür (idempotent).
            if (! empty($state['dice'])) {
                return response()->json([
                    'dice' => $state['dice'],
                    'commit' => $room->dice_commit,
                    'version' => (int) $room->server_version,
                    'reused' => true,
                ]);
            }

            // Yeni el üret (deterministik, sunucu-otoriter). Çift ise 4 hamle.
            $index = (int) $room->dice_roll_index;
            [$d1, $d2] = $dice->roll($room->dice_seed, (string) $room->dice_client_seed, $index);
            $roll = $d1 === $d2 ? [$d1, $d1, $d1, $d1] : [$d1, $d2];
            $state['dice'] = $roll;
            $state['diceUsed'] = array_fill(0, count($roll), false);

            $rolls = is_array($room->dice_rolls) ? $room->dice_rolls : [];
            $rolls[] = ['index' => $index, 'slot' => $slot, 'dice' => $roll];
            $room->dice_rolls = $rolls;
            $room->dice_roll_index = $index + 1;
            $room->server_state = $state;
            $room->server_version = (int) $room->server_version + 1;
            $this->driveAuthoritativeClock($room, $slot, microtime(true)); // zar -> segment/delay
            $room->save();

            return response()->json([
                'dice' => $roll,
                'commit' => $room->dice_commit,
                'version' => (int) $room->server_version,
                'reused' => false,
            ]);
        });
    }

    /**
     * Sunucu-otoriter HAMLE: istemci tüm tahtayı değil, önerdiği tam-tur step dizisini gönderir.
     * Sunucu, Node validator (TS motoru) ile YASALLIĞI doğrular; yasadışıysa REDDEDER.
     * FAIL-CLOSED: validator erişilemez + config required ise hamle reddedilir.
     */
    public function move(Request $request, string $code, \App\Services\MoveValidatorService $validator)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'steps' => ['present', 'array'],
            'steps.*.from' => ['required'],
            'steps.*.to' => ['required'],
            'steps.*.die' => ['required', 'integer', 'min:1', 'max:6'],
        ]);

        return DB::transaction(function () use ($data, $code, $validator) {
            $room = Room::where('code', strtoupper($code))->lockForUpdate()->first();
            if (! $room) {
                return $this->fail('Oda bulunamadı.', 404);
            }
            $slot = $this->slotOf($room, $data['token']);
            if ($slot === null) {
                return $this->fail('Bu odada değilsin.', 403);
            }
            $state = is_array($room->server_state) ? $room->server_state : null;
            if (! $state) {
                return $this->fail('Oyun durumu yok — önce zar at.', 409);
            }
            // Sıra kontrolü + zar atılmış olmalı.
            if (($state['turn'] ?? 'white') !== $this->slotColor($slot)) {
                return $this->fail('Sıra sende değil.', 409);
            }
            // Bekleyen küp teklifi varsa önce yanıtlanmalı (hamle edilemez).
            if ($this->cubeOf($room)['pending'] !== null) {
                return $this->fail('Önce küp teklifine yanıt ver.', 409);
            }
            if (empty($state['dice'])) {
                return $this->fail('Önce zar at.', 409);
            }

            // Node validator ile doğrula (TS motoru = tek gerçek).
            $result = $validator->validate($state, array_values($data['steps']));

            if (! empty($result['unreachable'])) {
                // FAIL-CLOSED: doğrulama yapılamadıysa hamleyi reddet (güvenli taraf).
                if (config('validator.required', true)) {
                    return $this->fail('Doğrulama servisi kullanılamıyor, hamle reddedildi.', 503);
                }
            }
            if (empty($result['valid']) || empty($result['state'])) {
                return $this->fail('Geçersiz hamle.', 422, ['reason' => $result['reason'] ?? 'invalid']);
            }

            // Otoriter durumu güncelle (validator uyguladı + sırayı devretti).
            $new = $result['state'];
            $winner = \App\Support\Backgammon::winner($new);

            // TUR SAYACI: geçerli hamle sırayı devretti -> bu oyunda bir tur daha tamamlandı.
            // İstemci küp hakkını (ilk elden sonra) ve otomatik-zar kararını BUNDAN okur;
            // otoriter modda yerel sayaç artmadığı için sunucu saymazsa küp HİÇ açılmaz.
            // (applyGameResult oyun bitince 0'a döndürür -> yeni oyunda yine açılış eli şartı.)
            $smTurn = is_array($room->server_match) ? $room->server_match : $this->initServerMatch($room);
            $smTurn['turns'] = (int) ($smTurn['turns'] ?? 0) + 1;
            $room->server_match = $smTurn;

            // ---- SUNUCU-OTORİTER MAÇ SKORU + KÜP (Faz 2/3) ----
            // Oyun bittiyse (15 taş) puanı SUNUCU hesaplar: gammon/backgammon (1/2/3) × KÜP değeri.
            // Maç bitmediyse applyGameResult otomatik YENİ OYUN kurar. İstemci skoru forge EDEMEZ.
            $matchDone = false;
            if ($winner) {
                $cubeVal = $this->cubeOf($room)['value'];
                $pts = \App\Support\Backgammon::gamePoints($new, $winner) * $cubeVal;
                $room->server_state = $new; // son tahta (maç biterse korunur; bitmezse applyGameResult ezer)
                $matchDone = $this->applyGameResult($room, $winner, $pts);
            } else {
                $room->server_state = $new;
            }
            // Hamle tamamlandı, sıra devredildi -> biten turun canlı önizlemesi artık geçersiz; temizle
            // (yeni mover kendi live'ını POST edene kadar ESKİ adımlar hayalet oynatılmasın).
            $room->live = null;
            $room->server_version = (int) $room->server_version + 1;
            $this->driveAuthoritativeClock($room, $slot, microtime(true)); // hamle -> tur devri saate
            $room->save();

            return response()->json([
                'state' => $room->server_state,
                'version' => (int) $room->server_version,
                'winner' => $winner,             // OYUN kazananı (renk) — bittiyse
                'match' => $room->server_match,  // otoriter maç skoru
                'match_done' => $matchDone,
            ]);
        });
    }

    /**
     * KÜP TEKLİFİ (Faz 2): sıra sahibi, zar ATMADAN önce küpü ikiye katlamayı teklif eder.
     * Kurallar SUNUCUDA: sıra sende + zar boş + bekleyen teklif yok + maç bitmemiş +
     * küp ortada VEYA senin elinde. Kabul edilince pending=teklif eden; rakip take/drop verir.
     */
    public function cubeOffer(Request $request, string $code)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);

        return DB::transaction(function () use ($data, $code) {
            $room = Room::where('code', strtoupper($code))->lockForUpdate()->first();
            if (! $room) {
                return $this->fail('Oda bulunamadı.', 404);
            }
            if (! $room->authoritative) {
                return $this->fail('Bu oda sunucu-otoriter değil.', 409);
            }
            $slot = $this->slotOf($room, $data['token']);
            if ($slot === null) {
                return $this->fail('Bu odada değilsin.', 403);
            }
            $color = $this->slotColor($slot);
            // MERKEZİ KURAL KONTROLÜ: tüm küp kuralları (sıra/Crawford/zar/açılış/sahiplik/64/
            // ölü-küp/1-puanlık maç) tek kaynaktan. Yasak istemci isteği net reason ile reddedilir.
            $avail = $this->cubeAvailability($room, $color);
            if (! $avail['allowed']) {
                return $this->fail($this->cubeDenyMessage($avail['reason']), 409, ['reason' => $avail['reason']]);
            }
            $sm = is_array($room->server_match) ? $room->server_match : null;
            $cube = $this->cubeOf($room);
            $sm['cube'] = ['value' => $cube['value'], 'owner' => $cube['owner'], 'pending' => $color];
            $room->server_match = $sm;
            $room->server_version = (int) $room->server_version + 1;
            // Teklif anini saate isle: teklif edenin harcadigi sure bankasindan dusulur,
            // yeni segment YANITLAYANIN uzerinde baslar (bkz. MatchClock::turnSlotFromState).
            $this->driveAuthoritativeClock($room, $slot, microtime(true));
            $room->save();

            return response()->json(['match' => $room->server_match, 'version' => (int) $room->server_version]);
        });
    }

    /**
     * KÜP YANITI (Faz 2): teklifin rakibi take (ikiye katla + küp bana geçsin, oyun sürer)
     * ya da drop (pes et) der. drop → teklif eden oyunu MEVCUT küp değerinde kazanır (gammon YOK).
     */
    public function cubeRespond(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'action' => ['required', 'string', 'in:take,drop'],
        ]);

        return DB::transaction(function () use ($data, $code) {
            $room = Room::where('code', strtoupper($code))->lockForUpdate()->first();
            if (! $room) {
                return $this->fail('Oda bulunamadı.', 404);
            }
            if (! $room->authoritative) {
                return $this->fail('Bu oda sunucu-otoriter değil.', 409);
            }
            $slot = $this->slotOf($room, $data['token']);
            if ($slot === null) {
                return $this->fail('Bu odada değilsin.', 403);
            }
            $color = $this->slotColor($slot);
            $cube = $this->cubeOf($room);
            $offerer = $cube['pending'];
            if ($offerer === null) {
                return $this->fail('Bekleyen küp teklifi yok.', 409);
            }
            // Yalnız teklifin RAKİBİ yanıtlayabilir (teklif eden kendi teklifini yanıtlayamaz).
            if ($color !== $this->otherColor($offerer)) {
                return $this->fail('Bu teklifi yanıtlayamazsın.', 403);
            }

            $sm = is_array($room->server_match) ? $room->server_match : $this->initServerMatch($room);

            if ($data['action'] === 'take') {
                // İkiye katla, küp yanıtlayanın (take eden) eline geçer, teklif temizlenir.
                $sm['cube'] = ['value' => $cube['value'] * 2, 'owner' => $color, 'pending' => null];
                $room->server_match = $sm;
                $room->server_version = (int) $room->server_version + 1;
                // Karar suresi yanitlayanin bankasindan dusulur; sira yine teklif edende
                // (zarini atacak) -> segment ona gecer.
                $this->driveAuthoritativeClock($room, $slot, microtime(true));
                $room->save();

                return response()->json([
                    'match' => $room->server_match, 'action' => 'take',
                    'version' => (int) $room->server_version, 'match_done' => false,
                ]);
            }

            // drop: teklif eden MEVCUT küp değerinde oyunu kazanır (gammon/backgammon çarpanı YOK).
            $sm['cube']['pending'] = null; // teklifi temizle (applyGameResult zaten küpü sıfırlar)
            $room->server_match = $sm;
            $matchDone = $this->applyGameResult($room, $offerer, $cube['value']);
            $room->server_version = (int) $room->server_version + 1;
            $this->driveAuthoritativeClock($room, $slot, microtime(true)); // karar suresi + oyun sonu
            $room->save();

            return response()->json([
                'match' => $room->server_match, 'action' => 'drop', 'winner' => $offerer,
                'version' => (int) $room->server_version, 'match_done' => $matchDone,
            ]);
        });
    }

    /**
     * RESIGN (Faz 2): oyuncu oyunu terk eder → RAKİP oyunu MEVCUT küp değerinde kazanır.
     * (v1: tek puan × küp; gammon/backgammon resign türü YOK.) applyGameResult maç bitişini yönetir.
     */
    public function resign(Request $request, string $code)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);

        return DB::transaction(function () use ($data, $code) {
            $room = Room::where('code', strtoupper($code))->lockForUpdate()->first();
            if (! $room) {
                return $this->fail('Oda bulunamadı.', 404);
            }
            if (! $room->authoritative) {
                return $this->fail('Bu oda sunucu-otoriter değil.', 409);
            }
            $slot = $this->slotOf($room, $data['token']);
            if ($slot === null) {
                return $this->fail('Bu odada değilsin.', 403);
            }
            $sm = is_array($room->server_match) ? $room->server_match : null;
            if (! $sm || ! empty($sm['done'])) {
                return $this->fail('Oyun aktif değil.', 409);
            }
            $winner = $this->otherColor($this->slotColor($slot));
            // PES = bu OYUNU vermek. Düz pes = TEK OYUN (küp değeri × 1). Gerçek tavla kuralı:
            // gammon/backgammon ancak KAZANAN 15 taşı topladığında (bear-off) tanımlıdır; oyun
            // ORTASINDA konumdan çarpan çıkarmak YANLIŞTIR. Ayrıca resign seviyesi taraflar
            // ANLAŞMASIYLA belirlenir — tek "Pes" butonu single'ı ikram eder.
            // ÖNCEKİ HATA: gamePoints($state) oyun-ortası tahtaya uygulanıyordu -> AÇILIŞ konumunda
            // her iki oyuncunun geri taşları rakibin evinde olduğundan pes HAYALET backgammon (3×)
            // sayılıyordu (kullanıcı şikayeti + RoomServerAuth Crawford testleri kırıktı). Doğal
            // kazançta (move) çarpan hâlâ gamePoints iledir (orada kazanan gerçekten bitirmiştir).
            $matchDone = $this->applyGameResult($room, $winner, $this->cubeOf($room)['value']);
            $room->server_version = (int) $room->server_version + 1;
            $this->driveAuthoritativeClock($room, $slot, microtime(true)); // maç bitti -> saati durdur
            $room->save();

            return response()->json([
                'match' => $room->server_match, 'winner' => $winner,
                'version' => (int) $room->server_version, 'match_done' => $matchDone,
            ]);
        });
    }

    /**
     * CANLI hamle önizlemesi (cosmetic, OTORİTE DEĞİL): sıradaki oyuncunun o an oynadığı/geri
     * aldığı adımları odaya yazar -> rakip poll'da okuyup adım adım animasyonla görür. server_state
     * ve version'a DOKUNMAZ (poll clock çalışırken zaten `live`'ı taşır); yasallık/skor buradan
     * ETKİLENMEZ. Hızlı + sık çağrılır (her adım/geri-alma). Kayıp/hile riski yok (yalnız görsel).
     */
    public function live(Request $request, string $code)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:64'],
            'steps' => ['present', 'array'],
            'steps.*.from' => ['required'],
            'steps.*.to' => ['required'],
            'steps.*.die' => ['nullable', 'integer', 'min:1', 'max:6'],
            'turn' => ['nullable', 'in:white,black'],
            'seq' => ['nullable', 'integer', 'min:0'],
        ]);
        $room = Room::where('code', strtoupper($code))->first();
        if (! $room) {
            return response()->json(['ok' => false], 404);
        }
        $slot = $this->slotOf($room, $data['token']);
        if ($slot === null) {
            return response()->json(['ok' => false], 403);
        }
        // Yalnız cosmetic önizleme; version BUMP ETME (poll clock akarken `live`'ı zaten döndürür).
        $room->live = [
            'slot' => $slot,
            'steps' => array_values($data['steps']),
            'turn' => $data['turn'] ?? null,
            'seq' => (int) ($data['seq'] ?? 0),
        ];
        $room->save();

        return response()->json(['ok' => true]);
    }

    /**
     * GEÇİCİ TEŞHİS: backend, Node validator'a ulaşıp bilinen-yasal bir hamleyi doğrulatabiliyor
     * mu? Secret/URL AÇMAZ; yalnız durum döner. valid=true -> bağlantı TAMAM (sorun başka yerde).
     * url_set=false -> VALIDATOR_URL okunmuyor (config cache / .env). unreachable=true -> erişemiyor
     * (secret 401 / IP / URL). Sorun çözülünce bu uç + rota KALDIRILMALI.
     */
    public function validatorCheck(\App\Services\MoveValidatorService $validator)
    {
        $s = \App\Support\Backgammon::initialState();
        $s['dice'] = [3, 1];
        $s['diceUsed'] = [false, false];
        $r = $validator->validate($s, [
            ['from' => 5, 'to' => 2, 'die' => 3],
            ['from' => 2, 'to' => 1, 'die' => 1],
        ]);

        return response()->json([
            'url_set' => config('validator.url') !== '',
            'required' => (bool) config('validator.required'),
            'valid' => (bool) ($r['valid'] ?? false),
            'reason' => $r['reason'] ?? null,
            'unreachable' => (bool) ($r['unreachable'] ?? false),
        ]);
    }

    private function slotOf(Room $room, string $token): ?string
    {
        if ($room->p1_token === $token) {
            return 'p1';
        }
        if ($room->p2_token === $token) {
            return 'p2';
        }
        return null;
    }
}
