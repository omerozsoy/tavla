<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Models\User;
use App\Services\Analysis\AnalysisOrchestrator;
use App\Services\Analysis\GnubgSnowieService;
use App\Services\CareerPrService;
use App\Services\GnuBg\GnuBgClient;
use App\Services\PlayerStatisticsService;
use App\Support\PrRatingBonus;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * OTORİTER PR = gnubg'nin KENDİ "Snowie error rate"i (XG ile birebir). Review-log equity-toplamı
 * yöntemi match-play'de ~6x şişiyordu (maç 7669 By_tgg: bizim 327, gnubg Snowie 51.4, XG 56.24).
 * Bu job gnubg `/analyzematch`'i çağırır, GnubgSnowieService ile per-oyuncu Snowie PR'ı çıkarır ve
 * odadaki İKİ satıra (self + kardeş) renk-eşlemeli yazar. gnubg_review (hamle-hamle ekran) AYRI kalır
 * (CacheMatchReviewJob yazar); bu yalnız PR kolonlarını otoriter Snowie'ye çeker.
 *
 * BEST-EFFORT (tries=1): gnubg down/başarısız -> sessizce vazgeç (failed_jobs'a düşmez). pr>100 çöp
 * koruması null yazar ("—"). Maç-sonu + backfill (tavla:snowie-pr) buraya yönlenir.
 */
class AnalyzeMatchSnowieJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 300; // analyzematch ağır (~saniyeler)

    public function __construct(public int $matchResultId)
    {
        $this->onQueue('reviews');
    }

    public function middleware(): array
    {
        // TEK ANALİZ / ODA (2026-11-03): Snowie her maç yolunda SATIR-başına dispatch edilir (oda = 2 satır
        // -> 2 iş). Her iş kendi matText()'inden .mat kurup İKİ satırı birden yazar. İki iş aynı anda koşup
        // yazımları interleave ederse (ve client-log fallback'te .mat satıra göre azıcık saparsa) aynı
        // oyuncu iki farklı skorlanıp ÇAPRAZ TUTARSIZLIK çıkar (CN736: white bir işte 5.4, diğerinde 9.21).
        // Kilidi ODA bazına al -> kardeş iş düşürülür (dontRelease): oda başına TEK analiz TEK yazar, iki
        // satır DAİMA tutarlı. room_code yoksa (bot/pvb, tek satır) matchResultId anahtarına düş.
        $room = MatchResult::where('id', $this->matchResultId)->value('room_code');
        $key = ! empty($room) ? 'match-snowie-room:'.$room : 'match-snowie:'.$this->matchResultId;

        return [
            (new WithoutOverlapping($key))->expireAfter(600)->dontRelease(),
        ];
    }

    public function handle(?GnuBgClient $gnubg = null): void
    {
        if (! Schema::hasColumn('match_results', 'gnubg_pr')) {
            return;
        }
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr) {
            return;
        }
        // TEK ANALİZ / ODA (SIRALI dedup — oda kilidinin tamamlayıcısı): Snowie bu maç yolunda SATIR-başına
        // 2 kez dispatch edilir. Oda kilidi (middleware) yalnız EŞ ZAMANLI ikinciyi düşürür; ikisi SIRAYLA
        // (tek 'reviews' worker'ında art arda) koşarsa kilit boş olur -> ikinci iş yeniden analiz edip
        // çöp-kalkanı yüzünden KISMİ yazar (self atlanır ama opp yazılır) -> ÇAPRAZ TUTARSIZLIK (BTS9U:
        // 30082.opp=12.94 ≠ 30083.self=8.61). Kardeş bu odayı AZ ÖNCE otoriter skorladıysa (pr_shield_at
        // < 300sn + gnubg_pr dolu) YENİDEN ANALİZ ETME -> tek yazar kalır, iki satır tutarlı. Backfill/heal
        // shielded OLMAYAN satırları hedefler (eski maç = shield yok/bayat) -> bu kapı onları etkilemez.
        if (! empty($mr->room_code) && Schema::hasColumn('match_results', 'pr_shield_at')) {
            $freshlyScored = MatchResult::where('room_code', $mr->room_code)
                ->whereNotNull('pr_shield_at')
                ->where('pr_shield_at', '>=', now()->subSeconds(300))
                ->whereNotNull('gnubg_pr')
                ->exists();
            if ($freshlyScored) {
                return; // kardeş iş bu odayı taze+otoriter yazdı; mükerrer analiz = kısmi ezme riski
            }
        }
        // TEK PR KAYNAĞI: Snowie HER maçta koşmalı (bot/pvb + hükmen/backstop satırları dahil). log şartını
        // KALDIRDIK -> matText() match_moves'tan .mat kurar (client log boş olsa bile); .mat boşsa aşağıda
        // (trim==='') zaten güvenle çıkar. room_code boş (bot) satırlar tek-satır işlenir (aşağıdaki döngü).
        $client = $gnubg ?? app(GnuBgClient::class);
        if (! $client->analyzeHealthy()) {
            return; // gnubg DOWN -> dokunma (backfill/maç-sonu dönünce tekrar dener)
        }
        try {
            $mat = $mr->matText();
        } catch (\Throwable $e) {
            Log::warning('snowie mat-build hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);

            return;
        }
        if (trim((string) $mat) === '') {
            return;
        }
        $res = $client->analyzeMatch($mat, 2);
        $snow = app(GnubgSnowieService::class)->snowieFromAnalyze($res, AnalysisOrchestrator::MIN_CUBE_DECISIONS);
        if ($snow === null) {
            Log::warning('snowie analiz yok/cop (yok sayildi)', ['id' => $mr->id]);

            return; // analiz başarısız / çöp -> MEVCUT değerlere DOKUNMA (bozma)
        }

        try {
            // room_code VARSA odanın iki satırı (self+kardeş); YOKSA (bot/pvb) yalnız bu satır.
            $rows = ! empty($mr->room_code)
                ? MatchResult::where('room_code', $mr->room_code)->get()
                : collect([$mr]);
            $invalidateUsers = [];
            foreach ($rows as $row) {
                $hc = $row->analysisHc();
                if (! in_array($hc, ['white', 'black'], true)) {
                    continue;
                }
                // snow[0] = gnubg player0 = white, snow[1] = black. null = pr>100 çöp -> "—".
                $self = $hc === 'white' ? $snow[0] : $snow[1];
                $opp = $hc === 'white' ? $snow[1] : $snow[0];
                $selfPr = is_array($self) ? ($self['pr'] ?? null) : null;
                $oppPr = is_array($opp) ? ($opp['pr'] ?? null) : null;
                // ÇÖP-KALKANI (SnowieBackfill ile aynı mantık): overall (Snowie) = checker+küp havuzlaması
                // -> MEVCUT (review) checker/cube'un ÇOK üstünde olamaz (overall ∈ [min,max]). Terk/timeout
                // gibi bozuk .mat (resign'de zar düşer) yeniden-analizde ŞİŞMİŞ çöp üretir (ör. 1.1 PR'lık
                // kusursuz oyuna 88 — pr>100 guard'ını AŞAR). Mevcut DOĞRU review checker/cube varsa ve
                // Snowie overall onların +2'sini aşıyorsa self'i YAZMA (iyi değeri bozma).
                if ($selfPr !== null && $row->gnubg_checker_pr !== null) {
                    $exMax = max((float) $row->gnubg_checker_pr,
                        $row->gnubg_cube_pr !== null ? (float) $row->gnubg_cube_pr : (float) $row->gnubg_checker_pr);
                    if ($selfPr > $exMax + 2.0) {
                        Log::warning('snowie imkansiz overall atlandi (cop-kalkani)', ['id' => $row->id, 'self' => $selfPr, 'exMax' => $exMax]);
                        $selfPr = null;
                    }
                }
                // KÖK FIX (kalıcı "—" + kariyer yarılanması): Snowie bir tarafı skorlayamazsa (pr>100 çöp
                // ya da .mat p2/siyah çıkarımı boş -> null) o tarafın PR kolonlarını NULL ile EZME. Eskiden
                // koşulsuz yazılıyordu -> AnalyzeMatchPrJob'ın DOĞRU per-pozisyon değeri silinip mezar taşı
                // konuyordu -> KALICI "—". Artık SALT-EKLEYİCİ: yalnız gerçekten skorlanan taraf yazılır;
                // diğer taraf per-pozisyon değerinde kalır (tekrar eden backfill'in kök nedeni).
                $upd = [];
                if ($selfPr !== null) {
                    $upd['gnubg_pr'] = $selfPr;
                    $upd['pr'] = $selfPr;
                    $upd['gnubg_checker_pr'] = $self['checker_pr'] ?? null;
                    $upd['gnubg_cube_pr'] = $self['cube_pr'] ?? null;
                    $upd['cube_equity_lost'] = $self['cube_equity_lost'] ?? 0; // küp err EMG (kariyer küp PR, Aşama 2)
                    $upd['cube_decisions'] = $self['cube_decisions'] ?? 0;
                    $upd['pr_equity_lost'] = $self['equity_lost'] ?? null;     // kariyer: overall err EMG (Snowie pay)
                    $upd['pr_decisions'] = $self['decisions'] ?? 0;            // kariyer: tüm hamle+küp (Snowie payda)
                    $upd['gnubg_pr_at'] = now();
                    $invalidateUsers[(int) $row->user_id] = true; // Snowie otoriter PR yazdı -> havuz/kariyer tazelensin
                }
                if ($oppPr !== null) {
                    $upd['gnubg_opponent_pr'] = $oppPr;
                    $upd['opponent_pr'] = $oppPr;
                    $upd['gnubg_opponent_checker_pr'] = $opp['checker_pr'] ?? null;
                    $upd['gnubg_opponent_cube_pr'] = $opp['cube_pr'] ?? null;
                }
                if ($upd !== []) {
                    MatchResult::where('id', $row->id)->update($upd);
                }
            }
            // PR ×2 ÖDÜLÜ: iki oyuncunun otoriter PR'ı artık yazıldı -> kazanan + PR'ı daha iyiyse
            // ek rating ver (idempotent; yalnız online iki-hesaplı puanlı maç). Sonuç ekranı /me/match-pr
            // poll'uyla rating_bonus'u okuyup "X2" penceresini gösterir.
            if (! empty($mr->room_code)) {
                PrRatingBonus::apply((string) $mr->room_code);
            }

            // RESUMABLE imleç: işlenen odayı damgala -> tavla:snowie-pr re-run bunu atlar.
            // (room_code boş bot satırı için tek satır damgalanır.)
            if (Schema::hasColumn('match_results', 'pr_shield_at')) {
                if (! empty($mr->room_code)) {
                    MatchResult::where('room_code', $mr->room_code)->update(['pr_shield_at' => now()]);
                } else {
                    MatchResult::where('id', $mr->id)->update(['pr_shield_at' => now()]);
                }
            }
            // TEK PR KAYNAĞI: PR'ı artık otoriter olarak Snowie yazdığı için havuz ("Maç Tipine Göre PR")
            // ve kariyer PR cache'lerini BURADA tazele (eskiden AnalyzeMatchPrJob yapıyordu; o artık
            // placeholder). 6 saatlik TTL beklemeden sonraki görüntüleme güncel gelir.
            foreach (array_keys($invalidateUsers) as $uid) {
                try {
                    app(PlayerStatisticsService::class)->invalidate($uid);
                    if ($u = User::find($uid)) {
                        app(CareerPrService::class)->recalc($u);
                    }
                } catch (\Throwable $e) {
                    Log::warning('snowie sonrasi stats/kariyer tazeleme hata (yok sayildi)', ['uid' => $uid, 'err' => $e->getMessage()]);
                }
            }
            Log::info('snowie PR yazildi', ['id' => $mr->id, 'room' => $mr->room_code]);
        } catch (\Throwable $e) {
            Log::warning('snowie PR yazimi hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
        }
    }
}
