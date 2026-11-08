<?php

namespace App\Support;

use App\Models\Room;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * BIREYSEL DUELLO sonuç kaydı + sıralama. Düello = puansız (unrated) arkadaş-maçı üstüne duel=true
 * bayrağı. Oda bitince (reportRating / MatchBackstop) record() çağrılır: kazanan belirliyse duels
 * tablosuna TEK satır yazılır (room_code UNIQUE -> idempotent, iki yoldan da çağrılsa tek satır).
 * Rating'e DOKUNMAZ (RatingPolicy zaten unrated'i puansız sayar); yalnız düello galibiyeti biriktirir.
 */
class DuelService
{
    /**
     * Biten bir düello odasının sonucunu yaz (idempotent). Guard: duel bayrağı + iki GERÇEK oyuncu
     * (bot değil) + RoomResult kesin kazanan verdi. Belirsiz/forfeit-belirsiz -> hiçbir şey yazmaz.
     */
    public function record(Room $room): void
    {
        if (! $room->duel || $room->bot) {
            return;
        }
        $p1 = (int) ($room->p1_user_id ?? 0);
        $p2 = (int) ($room->p2_user_id ?? 0);
        if ($p1 <= 0 || $p2 <= 0 || $p1 === $p2) {
            return; // iki gerçek hesap şart (misafir/bot/tek-taraf -> düello sayılmaz)
        }
        // AYNI takım üyeleri arası düello KAYDEDİLMEZ (puan farming/kendini-şişirme). Bu guard
        // invite guard'ını atlayan TÜM yolları kapatır: rematch, MatchBackstop re-record, sonradan
        // aynı takıma geçiş. Üyelik anlık okunur (sıralamalar da anlık üyelikle hesaplanır) -> silinen
        // kayıt backstop'la geri gelmez. (TEK NOKTA: tüm record() çağıranları buradan geçer.)
        $t1 = TeamMember::where('user_id', $p1)->value('team_id');
        $t2 = TeamMember::where('user_id', $p2)->value('team_id');
        if ($t1 && $t2 && (int) $t1 === (int) $t2) {
            return;
        }

        // Kazananı ODANIN sunucu-otoriter durumundan çıkar (istemci beyanına değil). p1 perspektifi.
        $res = RoomResult::resolve($room, $p1);
        if ($res === null) {
            return; // sonuç KESİN değil (yarım/terk-belirsiz) -> yazma
        }
        $winnerId = $res['won'] ? $p1 : $p2;

        try {
            DB::table('duels')->insert([
                'room_code' => $room->code,
                'player1_id' => $p1,
                'player2_id' => $p2,
                'winner_id' => $winnerId,
                'target_points' => max(1, (int) ($room->target ?? 1)),
                'finished_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (UniqueConstraintViolationException $e) {
            // room_code UNIQUE: başka yol (reportRating/backstop) zaten yazmış -> idempotent, yoksay.
        }
    }

    /**
     * Bireysel düello sıralaması: kazanan başına TOPLAM DÜELLO PUANI (DESC). Puan = kazanılan maçların
     * uzunluğu toplamı (1 puanlık maç 1, 3 puanlık 3, 5 puanlık 5 puan). + oyuncu bilgisi.
     *
     * @return array<int,array{user_id:int,nickname:string,avatar:?string,rating:int,wins:int}>
     */
    public static function individualLeaderboard(int $limit = 100): array
    {
        $rows = DB::table('duels')
            ->select('winner_id', DB::raw('SUM(target_points) as wins'))
            ->whereNotNull('winner_id')
            ->groupBy('winner_id')
            ->orderByDesc('wins')
            ->limit($limit)
            ->get();
        if ($rows->isEmpty()) {
            return [];
        }
        $users = User::whereIn('id', $rows->pluck('winner_id'))
            ->get(['id', 'nickname', 'first_name', 'avatar', 'rating'])->keyBy('id');

        return $rows->map(function ($r) use ($users) {
            $u = $users->get($r->winner_id);

            return [
                'user_id' => (int) $r->winner_id,
                'nickname' => $u?->nickname ?: ($u?->first_name ?: 'Oyuncu'),
                'avatar' => $u?->avatar,
                'rating' => (int) ($u?->rating ?? 1500),
                'wins' => (int) $r->wins,
            ];
        })->values()->all();
    }

    /**
     * Takım düello sıralaması: kazananın takımı (team_members) başına TOPLAM DÜELLO PUANI (DESC).
     * Puan = üyelerin kazandığı maçların uzunluğu toplamı (1/3/5). Üyesiz kazanan puana saymaz (JOIN eler).
     *
     * @return array<int,array{team_id:int,name:string,tag:string,logo:?string,color1:string,color2:string,wins:int}>
     */
    public static function teamLeaderboard(int $limit = 100): array
    {
        // TÜM aktif takımlar listelenir (puanı olmayan takım 0 ile görünür — kullanıcı direktifi):
        // teams'ten başla, LEFT JOIN ile üyelerin kazandığı düello puanlarını topla (yoksa 0).
        $rows = DB::table('teams')
            ->leftJoin('team_members', 'team_members.team_id', '=', 'teams.id')
            ->leftJoin('duels', 'duels.winner_id', '=', 'team_members.user_id')
            ->where('teams.status', 'active')
            ->groupBy('teams.id', 'teams.name', 'teams.tag', 'teams.logo', 'teams.color1', 'teams.color2')
            ->select('teams.id as team_id', 'teams.name', 'teams.tag', 'teams.logo', 'teams.color1', 'teams.color2', DB::raw('COALESCE(SUM(duels.target_points), 0) as wins'))
            ->orderByDesc('wins')
            ->orderBy('teams.name')
            ->limit($limit)
            ->get();

        return $rows->map(fn ($r) => [
            'team_id' => (int) $r->team_id,
            'name' => $r->name,
            'tag' => $r->tag,
            'logo' => $r->logo,
            'color1' => $r->color1,
            'color2' => $r->color2,
            'wins' => (int) $r->wins,
        ])->values()->all();
    }
}
