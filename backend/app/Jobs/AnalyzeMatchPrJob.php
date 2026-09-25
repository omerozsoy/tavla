<?php

namespace App\Jobs;

use App\Models\MatchResult;
use App\Services\Analysis\AnalysisOrchestrator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Bir maçın logunu gnubg orkestratörüyle analiz edip PR'ı ARKA PLANDA (queue) hesaplar (shadow).
 * Sonucu match_results.gnubg_* kolonlarına yazar + client PR ile loglar. Gösterilen/otoriter PR'a
 * DOKUNMAZ. Ağır (~karar başına bir gnubg çağrısı) olduğu için senkron reportRating'i bloklamaz.
 */
class AnalyzeMatchPrJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // GEÇİCİ hatalarda (gnubg zaman aşımı / DB deadlock) 3 KEZ dene. gnubg servis hataları zaten
    // handle() içinde yakalanıp sessiz geçiliyor (return = başarı) -> yalnız YAKALANMAYAN geçici
    // hatalar (timeout, deadlock, beklenmedik) retry'lanır. Aksi halde tek deneme başarısızsa iş
    // kalıcı olarak failed_jobs'a düşüp PR boş kalıyordu.
    public int $tries = 3;

    public int $timeout = 600;  // 60+ gnubg çağrısı olabilir

    /** Denemeler arası artan bekleme (sn): geçici yoğunluk/deadlock geçsin. */
    public function backoff(): array
    {
        return [15, 45];
    }

    public function __construct(public int $matchResultId) {}

    /** Aynı match_result için ağır GNUbg hesaplarını worker'lar arasında seri çalıştır. */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping('match-pr:'.$this->matchResultId))
                ->expireAfter(900)
                ->dontRelease(),
        ];
    }

    public function handle(AnalysisOrchestrator $orch, ?\App\Services\GnuBg\GnuBgClient $gnubg = null): void
    {
        $mr = MatchResult::find($this->matchResultId);
        if (! $mr || empty($mr->log)) {
            return;
        }
        // KÖK FIX (2026-09-25 — kalıcı "—" sorunu): gnubg servisi analiz ANINDA down/yavaş/restart
        // ise GnuBgClient::analyze() HER çağrıda null döner (fırlatmaz) -> evaluated=0 -> hiçbir kolon
        // yazılmaz -> job SESSİZCE "başarılı" biter -> $tries retry HİÇ tetiklenmez -> maç KALICI "—"
        // ile yaralanır (self-healing yok). Servis ayakta değilse 60+ futile analyze() yapmadan HEMEN
        // fırlat -> $tries/backoff retry + tavla:gnubg-pr-heal cron gnubg dönünce yeniden dener.
        // $gnubg YALNIZ container çağrısında dolu (testler handle($orch) ile çağırır -> null -> precheck
        // atlanır; o yolda aşağıdaki mid-run guard mock'lanabilir skipReasons ile devrededir).
        if ($gnubg !== null && ! $gnubg->analyzeHealthy()) {
            throw new \RuntimeException('gnubg servisi erisilemez (hicbir analyze instance ayakta degil) -> PR analizi ertelendi (retry)');
        }
        $decoded = json_decode($mr->log, true);
        if (! is_array($decoded) || empty($decoded['log'])) {
            return;
        }
        $player = $decoded['hc'] ?? 'white';
        // HAM log (fill DAHİL) — orchestrator fill/cube'u kendisi eler (PR sonucu değişmez). Filtreleyip
        // reindex ETMİYORUZ ki perDecision.logIndex, mr->log indeksleriyle HİZALI kalsın (Hata Günlüğü
        // Adım 2: gnubg loss'unu doğru karara eşler).
        $log = is_array($decoded['log']) ? $decoded['log'] : [];
        $ml = (int) ($mr->match_length ?? 0);

        try {
            $chk = $orch->checkerPr($log, $player, $ml, 2);
            $cube = $orch->cubePr($log, $player, $ml);
        } catch (\Throwable $e) {
            Log::warning('gnubg PR job hata', ['id' => $mr->id, 'err' => $e->getMessage()]);

            return;
        }

        $totLoss = $chk['loss'] + $cube['loss'];
        $totDec = $chk['decisions'] + $cube['decisions'];
        // gnubg'nin GERÇEKTEN değerlendirdiği pozisyon sayısı (zorunlu/obvious dahil). SIFIR ise
        // hiçbir şey skorlanmamış demektir -> checkerPr/cubePr "PR asla null olmasın" direktifi gereği
        // 0.0 fallback döndürür. Bu SAHTE 0.0'ı KAYDETME: 0 PR gerçek bir maçta imkansızdır ve arayüzde
        // "0.00 + Super Grandmaster" (en üst seviye) olarak görünüp kaybedeni usta gibi gösteriyordu
        // (kullanıcı şikayetlerinin kök nedeni). Değerlendirme yoksa kolon NULL kalır -> ekran "—".
        $chkEval = (int) ($chk['evaluated'] ?? 0);
        $cubeEval = (int) ($cube['evaluated'] ?? 0);
        $totEval = $chkEval + $cubeEval;

        // KÖK FIX (2026-09-25): gnubg mid-run DÜŞTÜ/erişilemez (health geçti ama analiz sırasında
        // watchdog restart / timeout / non-200). SELF kararların gnubg'ye gitti (self girdileri
        // pos+dice+playedSteps taşır) ama HİÇBİRİ skorlanamadı (gnubg_null>0) ve toplam evaluated=0
        // -> bu bir SERVİS sorunudur (log değil). Fırlat -> retry (backoff) + heal cron gnubg dönünce
        // yeniden dener. no_content-only skip (opp reconstructed / gerçekten boş log) NORMAL'dir ve
        // aşağıda mezar taşıyla işaretlenir; onu fırlatma (sonsuz retry olmasın).
        $chkDec = (int) ($chk['decisions'] ?? 0);
        $cubeDec = (int) ($cube['decisions'] ?? 0);
        $selfGnubgNull = (int) ($chk['skipReasons']['gnubg_null'] ?? 0);
        if ($totEval === 0 && $selfGnubgNull > 0) {
            throw new \RuntimeException('gnubg PR: self kararlar skorlanamadi (gnubg_null='.$selfGnubgNull.', eval=0) -> retry');
        }
        // KÖK FIX (2026-09-25 #4D5Z7 "sahte 0.00 PR"): gnubg maçı skorladı ama 0 SAYILAN karar
        // (decisions=0) buldu. Eski kod bu durumda loose fallback'i ($chk['pr']=allLoss/evaluated ≈ 0)
        // gnubg_pr'a 0.00 yazıp mezar taşı koyuyordu -> maç KALICI "—"/0.00 ("Super GM"). OYSA konsol
        // (tavla:gnubg-pr AYNI log) 25/25 karar + PR 6.56 üretti: 0-karar bir SERVİS DEGRADE işaretidir
        // (PR job maç biter bitmez ~3sn sonra çalışır; gnubg contention'da tek-aday/"forced" ya da
        // ~0-loss hint döndürür). Fake 0 ASLA yazma:
        //  - deneme hakkı varken FIRLAT -> retry/backoff + heal -> temiz rerun GERÇEK PR'ı yazar.
        //  - son denemede (nadir: gerçekten kısa/forced maç) tombstone (gnubg_pr null = dürüst "—").
        if ($totDec === 0 && $totEval > 0 && $this->job !== null && $this->attempts() < $this->tries) {
            throw new \RuntimeException('gnubg PR: 0 sayilan karar (eval='.$totEval.') = degrade run -> retry (temiz rerun gercek PR yazar)');
        }
        // PR = Σloss / SAYILAN karar. decisions=0 -> PR TANIMSIZ (null/"—"); ASLA 0 sentinel yazma.
        $overall = $totDec > 0 ? ($totLoss / $totDec) * 500 : null;

        $upd = [];
        // Her kova SAYILAN kararına göre: decisions>0 -> gerçek değer; yoksa NULL (varsa eski sentinel
        // 0'ı da TEMİZLER -> ekran dürüst "—"). Eskiden evaluated>0 ile yazılıyordu; bu, 0-karar degrade
        // run'da sahte 0.00 sızdırıyordu (bu maçın kök nedeni).
        if (Schema::hasColumn('match_results', 'gnubg_pr')) {
            $upd['gnubg_pr'] = $totDec > 0 ? round((float) $overall, 2) : null;
        }
        if (Schema::hasColumn('match_results', 'gnubg_checker_pr')) {
            $upd['gnubg_checker_pr'] = $chkDec > 0 ? round((float) $chk['pr'], 2) : null;
        }
        if (Schema::hasColumn('match_results', 'gnubg_cube_pr')) {
            $upd['gnubg_cube_pr'] = $cubeDec > 0 ? round((float) $cube['pr'], 2) : null;
        }
        if ($totEval > 0 && Schema::hasColumn('match_results', 'gnubg_pr_at')) {
            $upd['gnubg_pr_at'] = now();
        }
        // MEZAR TAŞI (heal döngüsü kalkanı): buraya gelindiyse gnubg ERİŞİLEBİLİRDİ (down olsa yukarıda
        // fırlatırdı). totEval=0 ise log gerçekten analiz-dışı (boş/kısa/reconstructed) -> gnubg_pr null
        // kalır (ekran doğru "—") AMA gnubg_pr_at'i işaretle ki tavla:gnubg-pr-heal bu maçı SONSUZA dek
        // yeniden denemesin. (gnubg_pr_at NULL = "gnubg'ye hiç ulaşılamadı" = heal hedefi.)
        if ($totEval === 0 && Schema::hasColumn('match_results', 'gnubg_pr_at')) {
            $upd['gnubg_pr_at'] = now();
        }

        // RAKİP (opponent) gnubg PR — pvb (AI) maçında HER ZAMAN (karşı satır yok). ONLINE'da ise
        // FALLBACK olarak: rakip kendi raporunu göndermezse (maçtan hızla çıkma / bağlantı kopması /
        // saat-forfeit) opponent_pr rakip satırından ASLA dolmaz ve sonuç ekranında kalıcı "—" kalır.
        // Kazananın stored log'u rakibin (reconstructed) hamlelerini de içerir ($opp renginin
        // pos+steps+dice'ı applyServerBoard'dan gelir) -> gnubg rakibin PR'ını AYNI log'dan hesaplar.
        // Böylece rakip hiç raporlamasa bile gnubg_opponent_pr dolar (matchGnubgPr ucu döndürür).
        // NOT: rakip kendi raporunu gönderirse KENDİ satırının otoriter gnubg PR'ı opponent_pr'a
        // senkronlanır (aşağıda + matchPr poll) ve ekran onu tercih eder; bu yalnız emniyet ağıdır.
        $computeOppPr = ($mr->match_type ?? null) === \App\Support\StatsConfig::MATCH_TYPE_AI
            || ! empty($mr->room_code);
        if ($computeOppPr) {
            $opp = $player === 'white' ? 'black' : 'white';
            try {
                $oChk = $orch->checkerPr($log, $opp, $ml, 2);
                $oCube = $orch->cubePr($log, $opp, $ml);
                $oTotLoss = $oChk['loss'] + $oCube['loss'];
                $oTotDec = $oChk['decisions'] + $oCube['decisions'];
                $oChkDec = (int) ($oChk['decisions'] ?? 0);
                $oCubeDec = (int) ($oCube['decisions'] ?? 0);
                // decisions bazlı (self ile AYNI kural): SAYILAN karar yoksa PR yok -> NULL (sahte 0
                // yazma; varsa eski sentinel'i temizle). Reconstructed rakip skorlanamazsa (oTotDec=0)
                // ekran dürüst "—"; rakip GERÇEKTEN raporlarsa kendi satırının PR'ı otoriter olur.
                $oOverall = $oTotDec > 0 ? ($oTotLoss / $oTotDec) * 500 : null;
                if (Schema::hasColumn('match_results', 'gnubg_opponent_checker_pr')) {
                    $upd['gnubg_opponent_checker_pr'] = $oChkDec > 0 ? round((float) $oChk['pr'], 2) : null;
                }
                if (Schema::hasColumn('match_results', 'gnubg_opponent_cube_pr')) {
                    $upd['gnubg_opponent_cube_pr'] = $oCubeDec > 0 ? round((float) $oCube['pr'], 2) : null;
                }
                if (Schema::hasColumn('match_results', 'gnubg_opponent_pr')) {
                    $upd['gnubg_opponent_pr'] = $oTotDec > 0 ? round((float) $oOverall, 2) : null;
                }
                // ONLINE + rakip HİÇ raporlamadı (opponent_pr hâlâ null): "Maç Analizleri" listesi +
                // MatchReport rakip PR'ı opponent_pr KOLONUNDAN okur (gnubg_opponent_pr'dan DEĞİL). Bu
                // yüzden tarihsel görünümün de "—" kalmaması için fallback'i opponent_pr'a da yaz.
                // YALNIZ null iken + rakibin hamleleri GERÇEKTEN skorlandıysa ($oTotDec>0) -> rakip
                // GERÇEKTEN raporlarsa KENDİ otoriter gnubg PR'ı (reportRating senkronu / rakibin bu
                // job'unun opponent_pr update'i) bunu EZER (o daha doğru).
                if ($oTotDec > 0 && $oOverall !== null
                    && ! empty($mr->room_code)
                    && ($mr->match_type ?? null) !== \App\Support\StatsConfig::MATCH_TYPE_AI
                    && $mr->opponent_pr === null
                    && Schema::hasColumn('match_results', 'opponent_pr')) {
                    $upd['opponent_pr'] = round((float) $oOverall, 2);
                }
            } catch (\Throwable $e) {
                Log::warning('gnubg BOT PR job hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
            }
        }

        // ANA KURAL (A→Z gnubg): pr_mode=authoritative ise GOSTERILEN/OTORITER PR = gnubg (cubeful
        // EMG, match-aware) olur; istemci wildbg (kübsüz para, 1-ply) PR'i EZILIR. Boylece "Maç
        // Analizleri"ndeki PR + kariyer havuzu (pr_equity_lost/pr_decisions) XG ile ayni sınıf motordan
        // gelir. gnubg gercekten karar degerlendirdiyse (totDec>0) yaz; degilse istemci PR'i kalir
        // (servis down -> zaten yukarida return; graceful fallback). Rating/Elo win/loss'tan gelir,
        // PR degismesinden ETKILENMEZ.
        if ((string) config('gnubg.pr_mode', 'off') === 'authoritative' && $totDec > 0) {
            foreach ([
                'pr' => round((float) $overall, 2),
                'pr_equity_lost' => round((float) $totLoss, 6),
                'pr_decisions' => $totDec,
            ] as $col => $val) {
                if (Schema::hasColumn('match_results', $col)) {
                    $upd[$col] = $val;
                }
            }
        }

        if ($upd !== []) {
            MatchResult::where('id', $mr->id)->update($upd); // query-builder -> fillable gerekmez
        }

        // gnubg-authoritative DOLUM SONRASI (PR'ın tek yetkilisi gnubg): reportRating artık istemci PR'ı
        // seed etmiyor (pending) -> burada iki türev de gnubg'den tamamlanmalı:
        //  (a) ONLINE rakip satırının opponent_pr'ı = bu satırın gnubg PR'ı (iki oyuncu özdeş görsün).
        //  (b) Bu oyuncunun KARİYER PR havuzu (pr_equity_lost/pr_decisions artık gnubg) -> yeniden hesap;
        //      yoksa maç, reportRating'te null totallerle recalc edildiğinden havuza HİÇ girmez.
        if ((string) config('gnubg.pr_mode', 'off') === 'authoritative' && $totDec > 0) {
            try {
                $prVal = round((float) $overall, 2);
                if (! empty($mr->room_code)
                    && ($mr->match_type ?? null) !== \App\Support\StatsConfig::MATCH_TYPE_AI
                    && Schema::hasColumn('match_results', 'opponent_pr')) {
                    MatchResult::where('room_code', $mr->room_code)
                        ->where('user_id', '!=', $mr->user_id)
                        ->update(['opponent_pr' => $prVal]);
                }
            } catch (\Throwable $e) {
                Log::warning('gnubg opponent_pr senkron hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
            }
            try {
                $u = \App\Models\User::find($mr->user_id);
                if ($u) {
                    app(\App\Services\CareerPrService::class)->recalc($u);
                }
            } catch (\Throwable $e) {
                Log::warning('gnubg sonrasi kariyer PR recalc hata (yok sayildi)', ['id' => $mr->id, 'err' => $e->getMessage()]);
            }
        }

        // ADIM 2 (HAKEM=gnubg): Hata Günlüğü'nü gnubg per-karar loss'uyla YENİDEN üret. reportRating'te
        // senkron olarak wildbg loss'uyla üretilmişti; burada (async) gnubg loss'uyla ezilir. logIndex ->
        // gnubg loss haritası ErrorJournal'a verilir (yalnız insanın kararları; rakip wildbg kalır).
        try {
            $lossByIndex = [];
            foreach (($chk['perDecision'] ?? []) as $d) {
                if (isset($d['logIndex'])) {
                    $lossByIndex[(int) $d['logIndex']] = (float) $d['loss'];
                }
            }
            if ($lossByIndex !== []) {
                $freshMr = MatchResult::find($mr->id) ?? $mr;
                app(\App\Services\ErrorJournalService::class)->analyzeMatch($freshMr, true, $lossByIndex);
                app(\App\Services\DiceStatisticsService::class)->invalidate((int) $mr->user_id);
            }
        } catch (\Throwable $e) {
            Log::warning('gnubg Hata Günlüğü re-gen hata', ['id' => $mr->id, 'err' => $e->getMessage()]);
        }

        Log::info('gnubg PR shadow', [
            'id' => $mr->id, 'player' => $player,
            'client_pr' => $mr->pr, 'gnubg_pr' => round((float) $overall, 2),
            'checker' => $chk['pr'], 'cube' => $cube['pr'],
            'chk_dec' => $chk['decisions'], 'chk_eval' => $chk['evaluated'], 'chk_skip' => $chk['skipped'],
        ]);
    }
}
