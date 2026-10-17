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
use Illuminate\Support\Facades\Cache;
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
        if (! $mr) {
            return;
        }
        // SUNUCU-OTORİTER kaynak varsa client log boş olsa bile analiz edilir.
        $hasServer = ! empty($mr->room_code) && \App\Models\MatchMove::existsForRoom($mr->room_code);
        if (! $hasServer && empty($mr->log)) {
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
            throw new \App\Exceptions\TransientAnalysisException('gnubg servisi erisilemez (hicbir analyze instance ayakta degil) -> PR analizi ertelendi (retry)');
        }
        // ŞANS (luck) PR ile AYNI JOB'DA, ağır PR döngüsünden ÖNCE hesaplanır -> AYRI kuyruk beklemesi
        // YOK (eskiden luck ayrı job'da PR'ın arkasında bekliyordu -> geç geliyordu). luck = TEK hızlı
        // matchluck çağrısı (heavy havuz) -> job'un ilk saniyelerinde luck_mwc/emg yazılır; istemci
        // poll'u önce ŞANS'ı, sonra (PR döngüsü bitince) PR'ı doldurur -> ekran ADIM ADIM dolar.
        // handle() self-contained + hata yutar (PR'ı ASLA bozmaz). $gnubg null ise (test) atla.
        if ($gnubg !== null) {
            try {
                (new AnalyzeMatchLuckJob($this->matchResultId))->handle($gnubg);
            } catch (\Throwable $e) {
                Log::warning('PR job inline luck hata (bastırıldı)', ['id' => $this->matchResultId, 'err' => $e->getMessage()]);
            }
        }
        $player = $mr->analysisHc() ?? 'white';
        // SUNUCU-OTORİTER analiz logu (match_moves varsa ORADAN; yoksa client). checkerPr + Hata
        // Günlüğü (ErrorJournalService) AYNI kaynağı kullanır -> perDecision.logIndex hizası korunur.
        // Filtreleyip reindex ETMİYORUZ (gnubg loss doğru karara eşlensin).
        $log = $mr->analysisLog();
        if (empty($log)) {
            return;
        }
        $ml = (int) ($mr->match_length ?? 0);

        // DEDUPE (perf): aynı maçın DİĞER oyuncusunun işi önce bittiyse, RAKİP tarafını gnubg'de YENİDEN
        // hesaplama — sibling satırından AYNALA. İki satır AYNI match_moves'tan türer: sibling'in
        // "opponent" değerleri = benim "self" değerlerim; sibling'in "self" = benim "opponent"ım (birebir).
        // Böylece ikinci oyuncunun GÖSTERİLEN PR'ı ~anında gelir + rakip-tarafı tekrar hesaplanmaz
        // (gnubg yükü ~yarıya iner). KENDİ tarafımı yine analiz ederim (kariyer pr_equity_lost/
        // pr_decisions + Hata Günlüğü perDecision bunu gerektirir). pvb (bot) maçında sibling yok.
        $sibling = (! empty($mr->room_code) && ($mr->match_type ?? null) !== \App\Support\StatsConfig::MATCH_TYPE_AI)
            ? MatchResult::where('room_code', $mr->room_code)
                ->where('user_id', '!=', $mr->user_id)
                ->whereNotNull('gnubg_pr_at')
                ->latest('id')->first()
            : null;
        // sibling benim PR'ımı (onun "opponent"ını) GERÇEKTEN skorladı mı? (yalnız OPPONENT tarafını
        // aynalamak için; KENDİ gösterilen PR'ım DAİMA kendi self-analizimden gelir — aşağıya bak.)
        $mirror = $sibling && $sibling->gnubg_opponent_pr !== null;
        // KÖK FIX (5EPMC swap): Eskiden burada "hızlı gösterim" için KENDİ gnubg_pr'ımı sibling'in
        // OPPONENT hesabından ANINDA yazıyorduk. Ama sibling maç-sonu YARIM match_moves'ta koşmuşsa
        // (az karar -> yanlış PR) o değer kazananın ekranına RAKİBİN PR'ı olarak düşüyordu (miayke
        // 3.01 yerine 29.2). Kaldırıldı: gösterilen PR SADECE bu satırın KENDİ (tam log) self-analizinden
        // yazılır. Sibling yalnız OPPONENT PR'ı (pahalı yarı) için aynalanır.

        // İLERLEME ÇUBUĞU (gerçek per-pozisyon): gnubg'ye gidecek TOPLAM pozisyonu baştan say
        // (self + mirror değilse opp) -> yüzde = analiz edilen / toplam. Her pencere (chunk) bitince
        // closure Cache'e yazar; matchGnubgPr ucu okuyup istemciye verir (prefix tavlatv-cache-,
        // worker->web paylaşımlı store). Önbellek isabetleri de "bitmiş" sayılır (dürüst: iş bitmiş).
        $computeOppPr = ($mr->match_type ?? null) === \App\Support\StatsConfig::MATCH_TYPE_AI
            || ! empty($mr->room_code);
        $oppColor = $player === 'white' ? 'black' : 'white';
        $prTotal = $orch->countPositions($log, $player)
            + (($computeOppPr && ! $mirror) ? $orch->countPositions($log, $oppColor) : 0);
        $prTotal = max(1, $prTotal); // 0'a bölme yok; toplam yoksa settled hızlı gelir
        $prDoneCount = 0;
        $progressKey = 'pr:progress:'.$mr->id;
        $onProgress = function (int $n = 0) use (&$prDoneCount, $prTotal, $progressKey) {
            $prDoneCount = min($prTotal, $prDoneCount + $n);
            Cache::put($progressKey, ['done' => $prDoneCount, 'total' => $prTotal], now()->addMinutes(10));
        };
        $onProgress(0); // ilk yaz: done=0 -> istemci bar'ı 0'dan başlatır (belirsiz spinner değil)

        try {
            $chk = $orch->checkerPr($log, $player, $ml, 2, $onProgress);
            $cube = $orch->cubePr($log, $player, $ml, $onProgress);
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
            throw new \App\Exceptions\TransientAnalysisException('gnubg PR: self kararlar skorlanamadi (gnubg_null='.$selfGnubgNull.', eval=0) -> retry');
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
            throw new \App\Exceptions\TransientAnalysisException('gnubg PR: 0 sayilan karar (eval='.$totEval.') = degrade run -> retry (temiz rerun gercek PR yazar)');
        }
        // PR = Σloss / SAYILAN karar. decisions=0 -> PR TANIMSIZ (null/"—"); ASLA 0 sentinel yazma.
        $overall = $totDec > 0 ? ($totLoss / $totDec) * 500 : null;

        $upd = [];
        // Her kova SAYILAN kararına göre: decisions>0 -> gerçek değer; yoksa NULL (varsa eski sentinel
        // 0'ı da TEMİZLER -> ekran dürüst "—"). Eskiden evaluated>0 ile yazılıyordu; bu, 0-karar degrade
        // run'da sahte 0.00 sızdırıyordu (bu maçın kök nedeni).
        // GÖSTERİLEN gnubg PR'ı DAİMA KENDİ self-analizinden (bu satırın tam logu) yazılır — sibling
        // mirror'ı KENDİ PR'ıma ASLA dokunmaz (5EPMC swap kök fix). Yalnız GERÇEK karar bulununca yaz:
        // 0 kararda eski/"—" değer kalır (sahte 0 ya da yanlış sibling değeri YAZMA). Bu, self otoritesini
        // garantiler: kazananın ekranına rakibin PR'ı bir daha düşemez.
        if ($totDec > 0 && Schema::hasColumn('match_results', 'gnubg_pr')) {
            $upd['gnubg_pr'] = round((float) $overall, 2);
        }
        if ($chkDec > 0 && Schema::hasColumn('match_results', 'gnubg_checker_pr')) {
            $upd['gnubg_checker_pr'] = round((float) $chk['pr'], 2);
        }
        if ($cubeDec > 0 && Schema::hasColumn('match_results', 'gnubg_cube_pr')) {
            $upd['gnubg_cube_pr'] = round((float) $cube['pr'], 2);
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
        // ($computeOppPr + $oppColor ilerleme toplamıyla birlikte yukarıda hesaplandı.)
        // DEDUPE: sibling zaten analiz edildiyse rakip tarafını onun KENDİ değerlerinden aynala
        // (yeniden gnubg YOK -> işin ağır yarısı atlanır). Aksi halde eskisi gibi gnubg ile hesapla.
        if ($computeOppPr && $mirror) {
            if (Schema::hasColumn('match_results', 'gnubg_opponent_pr')) {
                $upd['gnubg_opponent_pr'] = $sibling->gnubg_pr;
            }
            if (Schema::hasColumn('match_results', 'gnubg_opponent_checker_pr')) {
                $upd['gnubg_opponent_checker_pr'] = $sibling->gnubg_checker_pr;
            }
            if (Schema::hasColumn('match_results', 'gnubg_opponent_cube_pr')) {
                $upd['gnubg_opponent_cube_pr'] = $sibling->gnubg_cube_pr;
            }
            if ($mr->opponent_pr === null && $sibling->gnubg_pr !== null
                && Schema::hasColumn('match_results', 'opponent_pr')) {
                $upd['opponent_pr'] = $sibling->gnubg_pr;
            }
        } elseif ($computeOppPr) {
            $opp = $oppColor;
            try {
                $oChk = $orch->checkerPr($log, $opp, $ml, 2, $onProgress);
                $oCube = $orch->cubePr($log, $opp, $ml, $onProgress);
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

        // REVIEW-BASED PR YETKİLİ: gnubg_review önbelleklendiyse (CacheMatchReviewJob reviewMatch'ten
        // DOĞRU per-karar PR yazdı) bu job'un per-pozisyon cubePr'ı ONU EZMESİN -> PR alanlarını $upd'den
        // çıkar. (per-pozisyon cubePr küp kararlarında runtime hatalıydı: EU6CD kusursuz oyuncu 18.54 PR.)
        //
        // KÖK FIX (p2/black kalıcı "—" + kariyer maç sayısı yarıya düşüyor): ortak review log'u İKİ satırda
        // da cache'li ama CacheMatchReviewJob review'dan PR türetmede çoğu kez yalnız RAPORLAYAN tarafı
        // (p1=white) skorluyor, DİĞER tarafı (p2=black) NULL bırakıyor. Eskiden review VARSA bu job'un
        // DOĞRU per-pozisyon PR'ını ($overall, ör. 10.14) KOŞULSUZ unset ediyorduk -> review'ın NULL'ı
        // kalıp maç kalıcı "—" oluyordu (sitede ~yarı satır; oyuncular PR sıralamasından düşüyordu).
        // ARTIK: review bu satırı GERÇEKTEN skorladıysa (gnubg_pr dolu) ONA bırak; review bu tarafı
        // skorlayamayıp null bıraktıysa per-pozisyon (doğru) değerlerimiz YAZILSIN.
        $reviewAuthoritative = Schema::hasColumn('match_results', 'gnubg_review')
            && $mr->gnubg_pr !== null
            && MatchResult::where('id', $mr->id)->whereNotNull('gnubg_review')->exists();
        if ($reviewAuthoritative) {
            foreach (['gnubg_pr', 'gnubg_checker_pr', 'gnubg_cube_pr', 'pr', 'pr_equity_lost', 'pr_decisions',
                'gnubg_opponent_pr', 'gnubg_opponent_checker_pr', 'gnubg_opponent_cube_pr'] as $k) {
                unset($upd[$k]);
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
        if (! $reviewAuthoritative && (string) config('gnubg.pr_mode', 'off') === 'authoritative' && $totDec > 0) {
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
                    // Kayıp + gnubg'nin EN İYİ hamlesi/equity'leri/adayları (wildbg önerisi KULLANILMAZ).
                    $lossByIndex[(int) $d['logIndex']] = [
                        'loss' => (float) $d['loss'],
                        'best' => $d['bestMove'] ?? null,
                        'bestEquity' => $d['bestEquity'] ?? null,
                        'playedEquity' => $d['playedEquity'] ?? null,
                        'cands' => $d['cands'] ?? null,
                    ];
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
