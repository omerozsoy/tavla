<?php

namespace App\Console\Commands;

use App\Models\Room;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Sahte (oynanmamış) kayıp kayıtlarını GÜVENLE onarır. Kök-neden kod düzeltmesi (MatchClock
 * no-contest) canlıda olduğundan yeni sahte kayıp OLUŞMAZ; bu komut GEÇMİŞ artıkları temizler.
 *
 * GÜVENLIK: "log yok" TEK BAŞINA sahte kayıp demek DEĞİLDİR (gerçek bir kayıp da log-kaydetme
 * bug'ından logsuz olabilir). Bu yüzden komut, --room verilMEDEN HİÇBİR ŞEY SİLMEZ; yalnızca
 * aday satırları (won=0 + log boş) raporlar ki admin bilinen-kötü oda kodunu görüp versin.
 * Silme yalnız --room=KOD[,KOD2] + --apply ile, o odalara ait satırlarda yapılır.
 *
 * Her silinen satır için TAM ters işlem (kaydın yaptığının aynen tersi):
 *   losses -= 1, games_played -= 1 (0 tabanlı), rating -= delta (kayıpta delta<0 -> geri eklenir).
 * Ayrıca kaynak oda NÖTRLENİR (p1/p2_result=NULL, end_reason='NO_CONTEST') -> MatchBackstop
 * satırı YENİDEN ÜRETMEZ. Hepsi tek transaction; idempotent.
 *
 *   php artisan tavla:heal-false-losses --user=52                    # DRY rapor (aday satırlar)
 *   php artisan tavla:heal-false-losses --user=52 --room=LLZ4F       # DRY: ne yapacağını gösterir
 *   php artisan tavla:heal-false-losses --user=52 --room=LLZ4F --apply
 */
class HealFalseLosses extends Command
{
    protected $signature = 'tavla:heal-false-losses '
        .'{--user= : yalnızca bu user_id} '
        .'{--room= : silinecek oda kodu/kodları (virgülle); YOKSA yalnız rapor} '
        .'{--apply : değişiklikleri uygula (varsayılan: DRY, hiçbir şey yazmaz)}';

    protected $description = 'Sahte (oynanmamış) kayıp kayıtlarını güvenle onarır (rapor / --room ile hedefli silme).';

    public function handle(): int
    {
        $userId = $this->option('user') ? (int) $this->option('user') : null;
        $rooms = array_values(array_filter(array_map(
            fn ($c) => strtoupper(trim($c)),
            explode(',', (string) $this->option('room'))
        )));
        $apply = (bool) $this->option('apply');

        // Aday sahte-kayıp satırları: kaybedilmiş (won=0) + hiç oynanmamış işareti (log boş).
        $candQ = DB::table('match_results')
            ->where('won', false)
            ->where(function ($q) {
                $q->whereNull('log')->orWhere('log', '');
            })
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->orderBy('id');

        $cands = $candQ->get(['id', 'user_id', 'room_code', 'opponent_name', 'delta', 'rating_before', 'rating_after', 'created_at']);

        if ($cands->isEmpty()) {
            $this->info('Aday sahte-kayıp satırı bulunamadı (won=0 + log boş).'.($userId ? " (user=$userId)" : ''));

            return self::SUCCESS;
        }

        $this->line('Aday satırlar (won=0, log boş):');
        $this->table(
            ['id', 'user_id', 'room_code', 'rakip', 'delta', 'rating_before', 'created_at'],
            $cands->map(fn ($r) => [
                $r->id, $r->user_id, $r->room_code ?? '—', $r->opponent_name ?? '—',
                $r->delta, $r->rating_before, $r->created_at,
            ])->all()
        );

        if (empty($rooms)) {
            $this->warn('--room verilmedi -> SİLME YAPILMAZ. Yukarıdan bilinen-kötü oda kodunu seçip');
            $this->warn('  --room=KOD [--apply] ile yeniden çalıştır. (Emin olmadığın satırı SİLME.)');

            return self::SUCCESS;
        }

        // Hedeflenen satırlar: aday + room_code seçilenlerden biri (+ user filtresi zaten uygulandı).
        $targets = $cands->filter(fn ($r) => $r->room_code && in_array(strtoupper($r->room_code), $rooms, true))->values();

        if ($targets->isEmpty()) {
            $this->error('Seçilen oda(lar) ['.implode(',', $rooms).'] için aday satır yok. Kod doğru mu?');

            return self::FAILURE;
        }

        $this->line('');
        $this->line('SİLİNECEK + geri-alınacak satırlar (oda: '.implode(',', $rooms).'):');
        foreach ($targets as $t) {
            $this->line(sprintf(
                '  row#%d user=%d oda=%s: losses-1, games-1, rating %d -> %d (delta %+d geri alınır)',
                $t->id, $t->user_id, $t->room_code,
                $t->rating_after, (int) $t->rating_after - (int) $t->delta, -1 * (int) $t->delta
            ));
        }

        if (! $apply) {
            $this->warn('DRY: hiçbir şey yazılmadı. Uygulamak için --apply ekle.');

            return self::SUCCESS;
        }

        $roomCodes = $targets->pluck('room_code')->map(fn ($c) => strtoupper($c))->unique()->values()->all();

        DB::transaction(function () use ($targets, $roomCodes) {
            // 1) Kaynak odaları NÖTRLE -> MatchBackstop sahte kaybı yeniden üretmesin.
            Room::whereIn(DB::raw('UPPER(code)'), $roomCodes)->update([
                'p1_result' => null,
                'p2_result' => null,
                'end_reason' => 'NO_CONTEST',
            ]);

            // 2) Her satır için kullanıcı sayaç/rating'ini TAM tersle + satırı sil.
            foreach ($targets as $t) {
                $u = User::lockForUpdate()->find($t->user_id);
                if ($u) {
                    $u->losses = max(0, (int) $u->losses - 1);
                    $u->games_played = max(0, (int) $u->games_played - 1);
                    $u->rating = (int) $u->rating - (int) $t->delta; // kayıpta delta<0 -> rating artar
                    $u->save();
                }
                DB::table('match_results')->where('id', $t->id)->delete();
            }
        });

        $this->info('Onarıldı: '.$targets->count().' satır silindi + sayaç/rating geri alındı + '
            .count($roomCodes).' oda NO_CONTEST yapıldı.');

        return self::SUCCESS;
    }
}
