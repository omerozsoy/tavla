<?php

namespace App\Services;

use App\Models\Setting;

/**
 * Sunucu-otoriter oyun saati (DELAY sistemi) + AFK motoru.
 *
 * DELAY sistemi (increment DEGIL):
 *  - Sira/hamle basladiginda once mod'un delay suresi calisir; delay icinde ana sure AZALMAZ.
 *  - Delay bitince aktif oyuncunun ana suresi (banka) geri sayar.
 *  - Her yeni gercek hamlede delay ve AFK sayaci yeniden TAM baslar (kalan delay devretmez).
 *  - Ana sure 0 -> TIMEOUT (aktif oyuncu maci kaybeder).
 *
 * AFK (normal saatten bagimsiz): sira sahibi 45sn hicbir GERCEK hamle yapmazsa uyari,
 * 60sn'de AFK_TIMEOUT. Iki sayactan hangisi once kayba ularsa mac o nedenle biter.
 *
 * Otorite/guvenlik: "gercek hamle" state IMZASINDAN tespit edilir (sahte etkilesimle
 * sifirlanamaz). Sira DEVRI yalnizca mevcut sira sahibinin token'iyla kabul edilir;
 * boylece rakibi haksiz yere AFK'ya dusurup (state forge) coin calmak engellenir.
 *
 * Butun metotlar SAF: 'now' (epoch saniye, float) disaridan verilir -> deterministik test.
 * Saat durumu (clock) diskte JSON olarak tutulur; slotlar 'p1'=beyaz, 'p2'=siyah.
 */
class MatchClock
{
    /**
     * Puan basina ana sure (saniye) VARSAYILANlari: maç uzunluğu × bu.
     * Admin panel > Ayarlar > "Maç Süreleri" bunlari settings.clock_bank_<mode> ile EZER;
     * kayit yoksa buradaki deger kullanilir (deploy/test guvenli). Yeni maclarda init'te okunur.
     */
    public const PER_POINT = ['casual' => 180, 'normal' => 60, 'speed' => 24];

    /** Hamle basina delay (saniye) VARSAYILANlari. settings.clock_delay_<mode> ile ezilir. */
    public const DELAY = ['casual' => 15, 'normal' => 10, 'speed' => 8];

    /** Yururlukteki puan-basi banka (sn): admin ayari varsa o, yoksa sabit varsayilan. */
    public static function perPoint(string $mode): int
    {
        $mode = self::normalizeMode($mode);

        return max(1, Setting::int('clock_bank_'.$mode, self::PER_POINT[$mode]));
    }

    /** Yururlukteki hamle delay'i (sn): admin ayari varsa o, yoksa sabit varsayilan. */
    public static function delayFor(string $mode): int
    {
        $mode = self::normalizeMode($mode);

        return max(0, Setting::int('clock_delay_'.$mode, self::DELAY[$mode]));
    }

    public const AFK_IDLE = 90;       // uyari esigi (sn) = AFK_TOTAL - AFK_COUNTDOWN

    public const AFK_COUNTDOWN = 30;  // son gorunur geri sayim (sn)

    public const AFK_TOTAL = 120;     // toplam hareketsizlik -> kayip (sn) = 2 dk

    // KALDIRILDI (2026-09-25, oyuncu itirazi): eskiden 3sn'lik ag-latency toleransi vardi;
    // sure bitince (TIMEOUT), 60sn hareketsizlikte (AFK) ve terk esiginde kayip ilanini 3sn
    // geciktiriyordu -> "sure bitti ama rakip 3sn daha oynadi" sikayeti. Artik 0: kayip
    // deadline dolar dolmaz ANINDA ilan edilir. Sabit korunuyor (yerler kod olarak degismedi;
    // gerekirse tekrar >0 yapilabilir), ama etkisi tamamen kapali.
    public const GRACE = 0;          // network latency toleransi KALDIRILDI (0 = grace yok)

    // BOT REVEAL GRACE: bot maçında bot hamlesi SUNUCUDA anında oynanır ve sıra/saat aynı anda
    // insana (p1) döner; ama insanın İSTEMCİSİ botun hamlesini REVEAL/animasyonla gösterip (zar
    // ~0.85sn + adımlar + tur-devri ~0.5sn) sonra oto-roll (~0.5sn) eder — bu wall-clock süre
    // gerçekte botun turudur ama saat p1'e döndüğü için insandan işlerdi ("sıra botta ama benim
    // sürem azalıyor", özellikle mobilde timer kısılınca pencere delay'i aşar). Bu kadar sn'lik
    // grace, bot turundan sonra insanın İLK segmentinin started_at'ını ileri iterek reveal süresini
    // insana yazmaz; insan roll'unda started_at zaten gerçek now'a sıfırlanır (sömürüye kapalı,
    // AFK/presence korumaları aynen işler).
    public const BOT_REVEAL_GRACE = 2.0;

    // VARLIK (presence): oyuncu bu kadar sn poll/update gondermezse "terk etmis" sayilir.
    // Terk eden kaybeder; hazir bekleyen (present) sira sahibi haksiz AFK'dan KORUNUR.
    // 60sn: terk edilen/olu oda ~60sn'de (60 + GRACE, GRACE=0) kapanir. Daha dusuk deger (30/45) mobilde
    // sekme arka plana atilinca / kisa ag kesintisinde haksiz "terk" (false-forfeit) riskini artirir.
    // 45->60 (2026-10-23): sunucu-geneli ~45sn blip'te onlarca mac AYNI ANDA haksiz ABANDON oldu
    // (00:14 T8LCX/YQ29U/7EUXQ/YNLYW...); grace'i 1dk'ya cekince kisa kesintiler maci kesmez.
    public const PRESENCE_TIMEOUT = 60;

    /** In-flight kalkanin azami suresi (sn): komut isleme + retry payi. Daha eski _acted etkisiz (A-02). */
    public const INFLIGHT_MAX = 30;

    public static function normalizeMode(?string $mode): string
    {
        return isset(self::PER_POINT[$mode]) ? $mode : 'normal';
    }

    /**
     * Yeni mac icin baslangic saat durumu (henuz calismaz; ilk gercek hamlede baslar).
     * $bankOverride (sn): verilirse oyuncu basina ana sure budur (turnuva turunun elle girilen
     * dakikasi); yoksa mod x mac uzunlugu.
     */
    public static function init(?string $mode, int $target, float $now, ?int $bankOverride = null): array
    {
        $mode = self::normalizeMode($mode);
        $bank = $bankOverride !== null && $bankOverride > 0 ? $bankOverride : self::perPoint($mode) * max(1, $target);

        return [
            'mode' => $mode,
            'target' => max(1, $target),
            'delay' => self::delayFor($mode),
            'p1_bank' => (float) $bank,
            'p2_bank' => (float) $bank,
            'turn_slot' => null,   // 'p1' | 'p2' | null
            'started_at' => $now,  // aktif segmentin (son gercek hamle/devir) sunucu ts'i
            'sig' => null,         // en son islenen state imzasi
            'running' => false,
            'moved' => false,      // macin ILK gercek hamlesi yapildi mi? (AFK bundan once SAYILMAZ)
            'end' => null,         // ['reason' => TIMEOUT|AFK_TIMEOUT|ABANDON, 'winner' => 'p1'|'p2']
        ];
    }

    /** state alanlarindan gercek-hamle imzasi (sahte etkilesim degistiremez). */
    public static function signature(array $s): string
    {
        $ts = $s['turnStart'] ?? [];
        $turn = is_array($ts) ? ($ts['turn'] ?? '') : '';
        $played = $s['played'] ?? [];
        $playedN = is_array($played) ? count($played) : 0;
        $match = $s['match'] ?? [];
        $cube = is_array($match) ? ($match['cube'] ?? []) : [];
        $cubeVal = is_array($cube) ? ($cube['value'] ?? 1) : 1;
        $cubeOwner = is_array($cube) ? ($cube['owner'] ?? '') : '';

        return implode('|', [
            $s['turnsPlayed'] ?? 0,
            $playedN,
            $turn,
            $s['starter'] ?? '',
            $cubeVal,
            $cubeOwner,
            // Yalniz "var/yok" degil KIM teklif etti: aktif taraf buna gore degisiyor.
            is_string($s['cubePending'] ?? null) ? $s['cubePending'] : (! empty($s['cubePending']) ? 1 : 0),
            ! empty($s['gameEnd']) ? 1 : 0,
        ]);
    }

    /**
     * state.turnStart.turn -> slot. beyaz=p1, siyah=p2.
     * KÜP TEKLİFİ BEKLİYORSA aktif taraf teklif eden DEĞİL, YANITLAYANDIR: karar onun
     * (take/drop) ve düşünme süresi onun bankasından işlemeli. Aksi halde rakip "kabul mü
     * pas mı" diye düşünürken saat teklif edenin bankasından iniyordu (ve AFK sayacı da
     * yanlış tarafa bakıyordu).
     */
    public static function turnSlotFromState(array $s): ?string
    {
        $pending = $s['cubePending'] ?? null;
        if ($pending === 'white') {
            return 'p2'; // beyaz teklif etti -> karar siyahin
        }
        if ($pending === 'black') {
            return 'p1';
        }
        $ts = $s['turnStart'] ?? [];
        $turn = is_array($ts) ? ($ts['turn'] ?? null) : null;
        if ($turn === 'white') {
            return 'p1';
        }
        if ($turn === 'black') {
            return 'p2';
        }

        return null;
    }

    /** Saat calisiyor mu? Oyun bitmis/mac bitmis degil ve bir sira sahibi var. */
    public static function isRunning(array $s): bool
    {
        if (! empty($s['gameEnd'])) {
            return false;
        }
        if (! empty($s['matchOver'])) {
            return false;
        }

        return self::turnSlotFromState($s) !== null;
    }

    public static function other(string $slot): string
    {
        return $slot === 'p1' ? 'p2' : 'p1';
    }

    /**
     * Varlik damgasi: bir oyuncunun (slot) son poll/update zamanini isaretle.
     * Yalnizca controller cagirir; saf zaman testlerinde damgalanmaz -> presence atlanir.
     */
    public static function seen(array $clock, ?string $slot, float $now): array
    {
        if ($slot === 'p1' || $slot === 'p2') {
            $clock[$slot.'_seen'] = $now;
        }

        return $clock;
    }

    /**
     * Bir state guncellemesini isle. Gercek hamle/devir varsa segment islenir, delay+AFK sifirlanir.
     *
     * @param  array  $clock  mevcut saat durumu
     * @param  array  $state  gelen tam oyun state'i
     * @param  string|null  $requesterSlot  istegi yapan oyuncunun slotu ('p1'|'p2'|null)
     * @param  float  $now  sunucu zamani (epoch sn)
     */
    public static function onUpdate(array $clock, array $state, ?string $requesterSlot, float $now): array
    {
        if (! empty($clock['end'])) {
            return $clock; // zaten bitti
        }

        $newSig = self::signature($state);
        $newTurn = self::turnSlotFromState($state);
        $running = self::isRunning($state);

        // Ilk kez: oyun basliyor -> imza/sira/segment kur.
        if (($clock['sig'] ?? null) === null) {
            $clock['sig'] = $newSig;
            $clock['turn_slot'] = $newTurn;
            $clock['started_at'] = $now;
            $clock['running'] = $running;

            return self::maybeEnd($clock, $now);
        }

        $sigChanged = $newSig !== $clock['sig'];
        $current = $clock['turn_slot'] ?? null;

        // GUVENLIK: Saati/AFK'yi yalnizca MEVCUT sira sahibinin gercek hamlesi ilerletebilir.
        // Sira sahibi yoksa (null) ilk aksiyon her iki taraftan kabul (acilis zari).
        $authorized = $current === null || $requesterSlot === null || $requesterSlot === $current;

        if ($sigChanged && $authorized) {
            // TUR BASINA TEK DELAY: delay+banka tahsili yalniz SIRA DEGISINCE (turn_slot degisince).
            // Ayni oyuncunun tur-ici aksiyonlari (zar at -> hamle) started_at'i SIFIRLAMAZ -> tek 10sn
            // delay + banka turun tamamini kapsar. (Eskiden her aksiyon sifirliyordu: zar+hamle ayri delay.)
            $wasRunning = (bool) ($clock['running'] ?? false);
            $turnChanged = $newTurn !== $current;
            // Biten oyuncunun turunun TAMAMINI bankadan dus — YALNIZ gercek sira devrinde + saat calisirken.
            if ($turnChanged && $wasRunning && $current !== null) {
                $elapsed = max(0.0, $now - ($clock['started_at'] ?? $now));
                $used = max(0.0, $elapsed - ($clock['delay'] ?? 0));
                $bankKey = $current.'_bank';
                $clock[$bankKey] = max(0.0, ($clock[$bankKey] ?? 0) - $used);
            }
            // started_at'i SIRA DEGISINCE veya YENIDEN BASLAYINCA (resume: oyun-sonu/ara durdu -> yeni
            // oyun) sifirla. RESUME sart: aksi halde oyunlar-arasi (sonuc ekrani + sonraki oyun kurulumu)
            // gecen sure, yeni oyun ayni slot'ta basliyorsa (turnChanged=false) started_at eski kalip
            // clientView'de dev elapsed -> bankadan toptan dususturuyordu ("432->78"/"300->10" jump).
            $resumed = ! $wasRunning && $running;
            if ($turnChanged || $resumed) {
                $clock['turn_slot'] = $newTurn;
                $clock['started_at'] = $now;
            }
            $clock['sig'] = $newSig;
            $clock['running'] = $running;
            $clock['moved'] = true; // ILK gercek hamle yapildi -> AFK artik gecerli
        } else {
            // Gercek hamle yok (echo/clock-only) VEYA yetkisiz forge denemesi:
            // started_at'a DOKUNMA (AFK korunur). Yalnizca running bayragini guncelle.
            $clock['running'] = $running;
        }

        return self::maybeEnd($clock, $now);
    }

    /** Okuma aninda (poll) kayip kosulunu uygula (state degismeden). */
    public static function tick(array $clock, float $now): array
    {
        return self::maybeEnd($clock, $now);
    }

    /** Kayip deadline'i (grace ile) gectiyse clock.end ata. */
    public static function maybeEnd(array $clock, float $now): array
    {
        if (! empty($clock['end'])) {
            return $clock;
        }

        // ---- VARLIK (presence): TERK EDEN KAYBEDER — saat CALISMASA da gecerli ----
        // KOK FIX: presence-abandon eskiden yalnizca saat calisirken (running) isliyordu.
        // Acilis / 0-0 / oyunlar-arasi gibi saatin durdugu anlarda bir oyuncu terk edince
        // mac HIC finalize edilmiyor, oda 'playing'de asili kaliyor ve poll updated_at'i
        // tazeledigi icin "Devam Eden Maç" + "Canli Maclar"da HAYALET olarak gorunuyordu.
        // Artik running fark etmeksizin: bir oyuncu once gorunup (seen damgasi VAR) sonra
        // PRESENCE_TIMEOUT+GRACE boyunca kaybolduysa terk etmis sayilir -> rakip kazanir.
        // Damga yoksa (hic poll etmedi -> "yuklenmedi mi/terk mi" ayrilamaz) presence ATLANIR.
        $p1s = $clock['p1_seen'] ?? null;
        $p2s = $clock['p2_seen'] ?? null;
        $limit = self::PRESENCE_TIMEOUT + self::GRACE;
        $p1Gone = $p1s !== null && ($now - (float) $p1s) > $limit;
        $p2Gone = $p2s !== null && ($now - (float) $p2s) > $limit;
        if ($p1Gone !== $p2Gone) {
            // KOK FIX (J9N5R, 2026-10-26; RAFINE 2026-10-26): presence-ABANDON kararini saatin kimde
            // oldugu + BEKLEYENIN NE ZAMAN kayboldugu belirler:
            //  - AKTIF (sira sahibi) terk -> her zaman forfeit (gone kaybeder).
            //  - Saat DURMUS / aktif yok (acilis / oyunlar-arasi / kup-bekleme) -> gone forfeit (hayalet kapanir).
            //  - BEKLEYEN (sirasi olmayan) terk -> IKI DURUM:
            //      a) Bekleyen BU TUR BASLAMADAN ONCE gitmis (son-gorulme < started_at) = GERCEK TERK ->
            //         present sira sahibi KORUNUR, bekleyen forfeit eder (turn-owner protection; eski davranis).
            //      b) Bekleyen AKTIFIN TURU SIRASINDA gorulup sonra kaybolmus (son-gorulme >= started_at) =
            //         STALLER senaryosu: aktif oyalaniyorken beklerken ekrani uyuyan oyuncu HAKSIZ forfeit
            //         OLMASIN -> presence KARAR VERMEZ, aktifin kendi AFK/TIMEOUT'u (asagida) kaybettirir
            //         ("oyalayan kaybeder"; toplu-haksiz-abandon koku). Aktif bir kez hamle yapinca sira
            //         bekleyene gecer ve O artik gone==active yoluyla "aktif-terk" olarak kaybeder.
            $gone = $p1Gone ? 'p1' : 'p2';
            $active = $clock['turn_slot'] ?? null;
            $runningNow = (bool) ($clock['running'] ?? false);
            $goneSeen = (float) ($clock[$gone.'_seen'] ?? 0);
            $turnStart = (float) ($clock['started_at'] ?? $now);
            $stallerShield = $runningNow && $active !== null && $gone !== $active && $goneSeen >= $turnStart;
            if (! $stallerShield) {
                // KÖK FIX (975NM, 2026-10-28): presence-ABANDON'da "kazanan" taraf odayı HİÇ yüklemediyse
                // (seen=null) bu ADİL kazanç DEĞİL -> no-contest (winner=null; applyClockEnd puan/coin
                // İŞLEMEZ, yalnız odayı kapatır). Aksi halde maça hiç bağlanmamış rakip, yüklenip sonra
                // presence'ı donan (maç-başı geçiş/poll kesintisi) oyuncuya karşı KAZANIYORDU -> kabul
                // eden (p2) yükleniyor ama hiç gelmeyen p1'e hükmen yeniliyordu. Her iki taraf da gitmişse
                // zaten aşağıda (p1Gone && p2Gone) no-contest. seen her poll'da yazılır (ileri-only) ->
                // gerçekten oynamış/görülmüş kazanan etkilenmez; yalnız no-show "kazanan" no-contest'e döner.
                $winner = self::other($gone);
                $winnerSeen = $clock[$winner.'_seen'] ?? null;
                $clock['end'] = ['reason' => 'ABANDON', 'winner' => $winnerSeen !== null ? $winner : null];

                return $clock;
            }
            // Staller korumasi: bekleyen aktifin turu SIRASINDA kayboldu -> presence KARAR VERMEZ; AFK/TIMEOUT'a birak.
        }
        if ($p1Gone && $p2Gone) {
            // IKISI DE terk -> eskiden presence KARAR VERMEZDI ve saat de durmussa (acilis / 0-0 /
            // oyunlar-arasi / kup-bekleme) mac HIC finalize edilmiyordu: oda 'playing'de asili kalir,
            // poll updated_at'i tazeledikce "Devam Eden Maç" HAYALETI + izleyici DONMASI olusur.
            // KOK FIX: sonuc BELLI DEGILSE no-contest (winner=null) ile bitir -> applyClockEnd
            // puan/coin ISLEMEZ, yalniz odayi 'finished' isaretler (decided ise gercek kazanan
            // orada uygulanir). Boylece hem banner hem izleyici temizlenir.
            $clock['end'] = ['reason' => 'ABANDON', 'winner' => null];

            return $clock;
        }
        // Ikisi de present -> presence KARAR VERMEZ; asagida saat/AFK isler.

        if (! ($clock['running'] ?? false)) {
            return $clock;
        }
        $active = $clock['turn_slot'] ?? null;
        if ($active === null) {
            return $clock;
        }

        // BANKA (rezerv) 0 -> O OYUNCU ANINDA KAYBEDER, siranin kimde oldugundan BAGIMSIZ
        // (kullanici karari 2026-10-08: "bank 0 oldugu an oyun bitsin, 0 olan kaybetsin";
        // "suresi biten oyuncu oynamaya devam ediyor" sikayet dalgasi).
        // KOK: oyuncu bir turda delay+banka suresini ASARSA ama o an kimse tick ETMEZSE (rakip
        // poll etmiyor / aktif kendi hamlesini once gonderiyor), onUpdate'teki sira-devri dususu
        // bankayi max(0,...) ile 0'a KIRPAR ve sira rakibe gecer; eski maybeEnd yalniz AKTIFI
        // kontrol ettiginden 0-bankali (artik pasif) oyuncu forfeit EDILMEZ -> rakip oynarken
        // "canli" kalir, bear-off hizli turlarla sonsuza oynar. Cozum: her iki slotu kontrol et.
        // Guvenli: bank init'te daima >0, yalniz gercek oyunla erir -> 0 olan mutlaka oynamis/
        // gorunmus demektir (haksiz no-contest/never-seen riski yok). Esitlikte (ikisi de 0)
        // AKTIF once kontrol edilir -> saat kimdeyse o kaybeder.
        foreach ([$active, self::other($active)] as $slot) {
            if ((float) ($clock[$slot.'_bank'] ?? 0) <= 0.0) {
                $clock['end'] = ['reason' => 'TIMEOUT', 'winner' => self::other($slot)];

                return $clock;
            }
        }

        $bank = (float) ($clock[$active.'_bank'] ?? 0);
        $start = (float) ($clock['started_at'] ?? $now);
        $delay = (float) ($clock['delay'] ?? 0);
        $timeoutAt = $start + $delay + $bank; // ana sure bitisi (bank>0 iken; bank=0 yukarida bitti)
        $afkAt = $start + self::AFK_TOTAL;     // hareketsizlik bitisi
        // AFK ILK HAMLEDEN ONCE DE SAYILIR (kullanici karari 2026-10-17): odaya girip (seen) hic
        // hamle yapmayan aktif oyuncu da AFK_TOTAL hareketsizlikte kaybeder (0 hamle senaryosu).
        // Yukleme/acilis payi artik AFK_TOTAL'in kendisidir (2dk). Hic gorulmeyen (seen=null)
        // oyuncu icin no-show (rakip bekliyorsa) / no-contest (ikisi de yok) dallari asagida AYRICA
        // korunur -> baglanamamis oyuncu "AFK kaybetti" gibi puan islemez. $moved yalniz o
        // no-contest guvenligi (ikisi de hic oynamadi) icin tutulur.
        $moved = (bool) ($clock['moved'] ?? false);
        // IN-FLIGHT KALKANI ("Gonderiliyor..." haksiz AFK/terk KOKU, yuzlerce turnuva sikayeti):
        // aktif oyuncu bir OYUN KOMUTU (hamle/zar/kup/pes) gonderdiginde sunucu VARISTA _acted
        // damgalar (yavas validate/lock/retry ONCESI). Komut yolda/islenirken henuz commit olmadigi
        // icin started_at sifirlanmaz; o sirada RAKIBIN rutin poll'u (kilitsiz tickClock, ~1.5sn)
        // bu oyuncuyu "hareketsiz" sanip AFK/TIMEOUT ilan ediyordu -> hamlesini zamaninda yapmis
        // oyuncu bankasinda sure VARKEN "mactan cekildi" ile kaybediyordu. Cozum: aktif oyuncunun
        // kayip deadline'larini poll'un 'now'una gore DEGIL son KOMUT VARISina (_acted) gore
        // degerlendir -> aktif olarak hamle gonderen oyuncu tanim geregi hareketsiz DEGILDIR.
        // Guvenli: effNow = min(now, acted); grace yalnizca now-acted = sunucu islem/poll gecikmesi
        // (retry'ler acted'i ilerletir, acted now'u asamaz) -> sinirsiz stall/grief exploit YOK,
        // ana banka gercek-zamanli akmaya devam eder (TIMEOUT hard anti-stall limiti korunur: bir
        // kez acted now'a yetisirse timeout normal uygular). acted bu segmentte degilse (<= start,
        // or. onceki turdan kalma) etkisizdir.
        // SINIR (denetim A-02): _acted, komut REDDEDILSE bile (409/422, tekrar /roll) yazilir. Tek bir
        // damga effNow'u o ana SABITLIYOR, TIMEOUT/AFK hic tetiklenmiyordu -> oyuncu bir gecersiz komut
        // gonderip sonra hic oynamadan (yalniz poll ile "bagli" kalarak) maci sonsuza dek kilitleyebiliyordu.
        // Kalkan yalniz komut ISLENIRKEN gecerli: damga INFLIGHT_MAX'tan eskiyse etkisiz. Damgayi surekli
        // tazelemek de kazandirmaz (effNow=acted damgayla ilerler; gecikme <= INFLIGHT_MAX).
        $acted = (float) ($clock[$active.'_acted'] ?? 0);
        $inFlight = $acted > $start && $acted < $now && ($now - $acted) <= self::INFLIGHT_MAX;
        $effNow = $inFlight ? $acted : $now;
        $timedOut = $effNow >= $timeoutAt + self::GRACE;              // banka tukendi
        $afkedOut = ($effNow >= $afkAt + self::GRACE);                // hareketsiz (ilk hamleden ONCE de)
        // ADALET: aktif oyuncu bu odayi HIC yuklemediyse (_seen damgasi YOK = hic poll etmedi) iki yol
        // var ve RAKIBIN presence'ina gore AYRISIR (saf-zaman testlerinde iki damga da null -> hicbiri
        // tetiklenmez, normal timeout/AFK matematigi korunur). EXPLOIT YOK: _seen her poll/komutta
        // yazilir + ileri-only; bir kez gorunen oyuncu sonra null'a donemez.
        $activeSeen = $clock[$active.'_seen'] ?? null;
        $otherSeen = $clock[self::other($active).'_seen'] ?? null;
        // NO-SHOW FORFEIT (kullanici karari 2026-10-15, QT5XF): aktif oyuncu odayi HIC yuklemedi
        // (seen=null) ama RAKIP yuklenip bekledi (otherSeen!=null) ve sure/AFK doldu -> hazir bekleyen
        // rakip KAZANIR. (Eski XR37P "gormeyeni forfeit etme" no-contest'i BU dal icin bilerek override
        // edildi: hazir rakip varken hic baglanmayan no-show cezalandirilir.)
        if (($timedOut || $afkedOut) && $activeSeen === null && $otherSeen !== null) {
            $clock['end'] = ['reason' => 'ABANDON', 'winner' => self::other($active)];

            return $clock;
        }
        // NO-CONTEST: aktif hic gorulmedi + ilk gercek hamle hic yapilmadi (ikisi de no-show / salt-zaman
        // degilse). Kimse adil sans almadi -> kazanan yok, rating/coin islemez ("ikisi de gormeden
        // yenildi" haksizligini onler). (otherSeen!=null ustteki dalda forfeit edildi; burada other=null.)
        if (($timedOut || $afkedOut) && $activeSeen === null && ! $moved) {
            $clock['end'] = ['reason' => 'ABANDON', 'winner' => null];

            return $clock;
        }
        if ($timedOut || $afkedOut) {
            // Hangi deadline ONCE geldiyse kayip nedeni odur (AFK yalniz armed ise aday).
            $afkFirst = $afkedOut && (! $timedOut || $afkAt < $timeoutAt);
            $clock['end'] = [
                'reason' => $afkFirst ? 'AFK_TIMEOUT' : 'TIMEOUT',
                'winner' => self::other($active),
            ];
        }

        return $clock;
    }

    /**
     * Istemciye donen canli goruntu (beyaz/siyah kalan sure, delay, aktif renk, AFK, kayip).
     * Slotlar renge cevrilir: p1=white, p2=black.
     */
    public static function clientView(array $clock, float $now): array
    {
        $active = $clock['turn_slot'] ?? null;
        $running = (bool) ($clock['running'] ?? false);
        $p1 = (float) ($clock['p1_bank'] ?? 0);
        $p2 = (float) ($clock['p2_bank'] ?? 0);
        $delayRem = (float) ($clock['delay'] ?? 0);
        $afkRem = null;
        // HOLD = segment başlangıcı GELECEKTE ise (bot-reveal grace: started_at ileri itilir) delay/banka
        // henüz İŞLEMEZ; istemci bu kadar sn DELAY'i SABİT tutmalı. Yoksa istemci 10'dan aşağı sayar,
        // her poll 10'a geri döner -> "10 9 10 9" titreme. (started_at <= now iken 0.)
        $hold = max(0.0, (float) ($clock['started_at'] ?? $now) - $now);

        if ($running && $active !== null) {
            $elapsed = max(0.0, $now - (float) ($clock['started_at'] ?? $now));
            $used = max(0.0, $elapsed - (float) ($clock['delay'] ?? 0));
            if ($active === 'p1') {
                $p1 = max(0.0, $p1 - $used);
            } else {
                $p2 = max(0.0, $p2 - $used);
            }
            $delayRem = max(0.0, (float) ($clock['delay'] ?? 0) - $elapsed);
            // BANKA 0 -> delay grace yok (bkz. maybeEnd): UI de free delay GOSTERMESIN (yaniltmasin,
            // kayip zaten bu turda aninda ilan edilir). Aktif oyuncunun STORED rezervi 0 ise delay=0.
            $activeBankStored = (float) ($clock[$active.'_bank'] ?? 0);
            if ($activeBankStored <= 0.0) {
                $delayRem = 0.0;
            }
            // AFK geri sayimi ILK HAMLEDEN ONCE DE gorunur (0 hamleli oyuncu da AFK ile kaybeder).
            $afkRem = max(0.0, self::AFK_TOTAL - $elapsed);
        }

        $activeColor = $active === 'p1' ? 'white' : ($active === 'p2' ? 'black' : null);
        $end = $clock['end'] ?? null;

        return [
            'white' => round($p1, 1),
            'black' => round($p2, 1),
            'delay' => round($delayRem, 1),
            // İstemci bu kadar sn delay'i SABİT tutsun (grace); 0 ise normal geri say.
            'hold' => $running ? round($hold, 1) : 0.0,
            'active' => $running ? $activeColor : null,
            // AFK: son AFK_COUNTDOWN sn'de gorunur geri sayim; degilse null.
            'afk' => ($afkRem !== null && $afkRem <= self::AFK_COUNTDOWN) ? (int) ceil($afkRem) : null,
            'running' => $running,
            'loss' => $end
                ? ['winner' => $end['winner'] === 'p1' ? 'white' : 'black', 'reason' => $end['reason']]
                : null,
        ];
    }
}
