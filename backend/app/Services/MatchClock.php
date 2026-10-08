<?php

namespace App\Services;

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
    /** Puan basina ana sure (saniye): maç uzunluğu × bu. */
    public const PER_POINT = ['casual' => 180, 'normal' => 60, 'speed' => 24];

    /** Hamle basina delay (saniye). */
    public const DELAY = ['casual' => 15, 'normal' => 10, 'speed' => 8];

    public const AFK_IDLE = 45;      // uyari esigi (sn) = AFK_TOTAL - AFK_COUNTDOWN
    public const AFK_COUNTDOWN = 15; // son gorunur geri sayim (sn)
    public const AFK_TOTAL = 60;     // toplam hareketsizlik -> kayip (sn)
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
    public const BOT_REVEAL_GRACE = 4.5;
    // VARLIK (presence): oyuncu bu kadar sn poll/update gondermezse "terk etmis" sayilir.
    // Terk eden kaybeder; hazir bekleyen (present) sira sahibi haksiz AFK'dan KORUNUR.
    // 45sn: terk edilen/olu oda ~45sn'de (45 + GRACE, GRACE=0) kapanir. Daha dusuk deger (30) mobilde
    // sekme arka plana atilinca / kisa ag kesintisinde haksiz "terk" (false-forfeit) riskini artirir.
    public const PRESENCE_TIMEOUT = 45;
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
        $bank = $bankOverride !== null && $bankOverride > 0 ? $bankOverride : self::PER_POINT[$mode] * max(1, $target);

        return [
            'mode' => $mode,
            'target' => max(1, $target),
            'delay' => self::DELAY[$mode],
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
            // TAM OLARAK biri terk (ikisi de degil) -> terk eden kaybeder, rakip kazanir.
            $clock['end'] = ['reason' => 'ABANDON', 'winner' => $p1Gone ? 'p2' : 'p1'];
            return $clock;
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

        $bank = (float) ($clock[$active.'_bank'] ?? 0);
        $start = (float) ($clock['started_at'] ?? $now);
        $delay = (float) ($clock['delay'] ?? 0);
        // BANKA 0 -> ANINDA KAYIP (kullanici karari 2026-10-08, "suresi biten oyuncu oynamaya
        // devam ediyor" sikayet dalgasi). Ana sure (rezerv) tukendiyse artik TUR BASI free delay
        // YOK: timeoutAt=start -> aktif oyuncu bu turda derhal timeout. Eskiden timeoutAt=
        // start+delay+bank idi; bank=0 olan oyuncu her yeni turda delay'i sifirlayip (ozellikle
        // bear-off "Hamle Yok" hizli turlari) sonsuza dek oynayabiliyordu. Bank>0 iken delay grace
        // AYNEN korunur (normal oyun akisi + mevcut testler degismez); yalniz rezerv 0'da delay dusser.
        $timeoutAt = $bank <= 0.0 ? $start : $start + $delay + $bank; // ana sure bitisi
        $afkAt = $start + self::AFK_TOTAL;     // hareketsizlik bitisi
        // AFK, macin ILK gercek hamlesinden ONCE SAYILMAZ (matchmaking sonrasi yukleme/acilis
        // payi). O ana kadar sadece TIMEOUT (banka) + presence (terk) yedek olarak calisir
        // -> hazir bekleyen oyuncu acilista haksiz AFK yemez, ama sonsuza dek de stall edemez.
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
        $afkedOut = $moved && ($effNow >= $afkAt + self::GRACE);      // hareketsiz (yalniz ilk hamleden sonra)
        // ADALET (KÖK FIX): aktif oyuncu bu odayi HIC yuklemediyse (seen damgasi YOK = hic poll
        // etmedi) onu forfeit ETME — TIMEOUT de AFK de haksiz. "Oynamadan/görmeden yenildim" bug'i:
        // matchmaking/davet oda acar, sira ona gecer ama istemcisi tahtayi hic almaz; banka
        // started_at'tan GERCEK-ZAMANLI akar. "Yuklenmedi mi / terk mi" AYIRT EDILEMEZ (presence de
        // never-seen'i atliyor) -> kayip yazmak haksiz: NO-CONTEST (winner=null) ile bitir.
        // moved'DAN BAGIMSIZ (canli #XR37P kok fix): eski kosul `! $moved` idi; ama RAKIP acilis
        // hamlesini yapinca moved=TRUE (match-global) olur ve sira hic-gormemis oyuncuya gecince
        // koruma ATLANIYORDU -> acilis non-starter'i ilk zarini goremeden AFK_TIMEOUT ile kaybediyordu.
        // moved "biri oynadi mi" der, "BU oyuncu adil sans aldi mi" DEMEZ; dogru olcu per-oyuncu
        // presence'tir. EXPLOIT YOK: _seen her poll/komutta yazilir ve ileri-only; bir kez gorunen
        // oyuncu sonra null'a donemez (gorup oynamayan timeout/AFK'yi NORMAL yer).
        $activeSeen = $clock[$active.'_seen'] ?? null;
        $otherSeen = $clock[self::other($active).'_seen'] ?? null;
        // (a) ASIMETRIK presence (canli #XR37P kok fix): aktif oyuncu HIC gorulmedi ama RAKIP gorundu
        //     -> moved olsa bile (rakip acilis hamlesini yapti -> moved=true) aktifi forfeit ETME.
        //     moved "biri oynadi mi" der; "BU oyuncu adil sans aldi mi" DEMEZ. Saf-zaman testlerinde
        //     iki damga da null oldugu icin bu dal TETIKLENMEZ (normal timeout/AFK matematigi korunur).
        // (b) ILK hamleden ONCE hic-gormemis aktif (eski koruma aynen): her iki taraf da bilinmese bile.
        // EXPLOIT YOK: _seen her poll/komutta yazilir + ileri-only; bir kez gorunen null'a donemez.
        if (($timedOut || $afkedOut) && $activeSeen === null && ($otherSeen !== null || ! $moved)) {
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
            // AFK geri sayimi yalniz ILK gercek hamleden sonra gorunur (acilis payi).
            $afkRem = ! empty($clock['moved']) ? max(0.0, self::AFK_TOTAL - $elapsed) : null;
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
            // AFK: son 15sn'de gorunur geri sayim; degilse null.
            'afk' => ($afkRem !== null && $afkRem <= self::AFK_COUNTDOWN) ? (int) ceil($afkRem) : null,
            'running' => $running,
            'loss' => $end
                ? ['winner' => $end['winner'] === 'p1' ? 'white' : 'black', 'reason' => $end['reason']]
                : null,
        ];
    }
}
