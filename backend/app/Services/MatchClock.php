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
 * AFK (normal saatten bagimsiz): sira sahibi 30sn hicbir GERCEK hamle yapmazsa uyari,
 * 45sn'de AFK_TIMEOUT. Iki sayactan hangisi once kayba ularsa mac o nedenle biter.
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

    public const AFK_IDLE = 30;      // uyari esigi (sn)
    public const AFK_COUNTDOWN = 15; // son gorunur geri sayim (sn)
    public const AFK_TOTAL = 45;     // toplam hareketsizlik -> kayip (sn)
    public const GRACE = 3;          // network latency toleransi: kayip ilanini geciktir (sn)
    // VARLIK (presence): oyuncu bu kadar sn poll/update gondermezse "terk etmis" sayilir.
    // Terk eden kaybeder; hazir bekleyen (present) sira sahibi haksiz AFK'dan KORUNUR.
    public const PRESENCE_TIMEOUT = 25;

    public static function normalizeMode(?string $mode): string
    {
        return isset(self::PER_POINT[$mode]) ? $mode : 'normal';
    }

    /** Yeni mac icin baslangic saat durumu (henuz calismaz; ilk gercek hamlede baslar). */
    public static function init(?string $mode, int $target, float $now): array
    {
        $mode = self::normalizeMode($mode);
        $bank = self::PER_POINT[$mode] * max(1, $target);

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
            ! empty($s['cubePending']) ? 1 : 0,
            ! empty($s['gameEnd']) ? 1 : 0,
        ]);
    }

    /** state.turnStart.turn -> slot. beyaz=p1, siyah=p2. */
    public static function turnSlotFromState(array $s): ?string
    {
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
            // Gecen segmentte aktif oyuncunun harcadigi ana sureyi bankadan dus.
            if ($current !== null && ($clock['running'] ?? false)) {
                $elapsed = max(0.0, $now - ($clock['started_at'] ?? $now));
                $used = max(0.0, $elapsed - ($clock['delay'] ?? 0));
                $bankKey = $current.'_bank';
                $clock[$bankKey] = max(0.0, ($clock[$bankKey] ?? 0) - $used);
            }
            // Yeni segment: delay+AFK sifir, sira yeni state'ten.
            $clock['sig'] = $newSig;
            $clock['turn_slot'] = $newTurn;
            $clock['started_at'] = $now;
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
        if (! ($clock['running'] ?? false)) {
            return $clock;
        }
        $active = $clock['turn_slot'] ?? null;
        if ($active === null) {
            return $clock;
        }

        // ---- VARLIK (presence): TERK EDEN KAYBEDER; SIRA SAHIBI KORUNUR ----
        // _seen yalnizca controller poll/update ile damgalanir. Bir oyuncu
        // PRESENCE_TIMEOUT (+GRACE) sn boyunca hic gorunmezse "terk etmis" sayilir.
        // Rakip terk ettiyse sira sahibi haksiz AFK'ya DUSMEZ (once burada karar).
        $other = self::other($active);
        $sa = $clock[$active.'_seen'] ?? null;
        $so = $clock[$other.'_seen'] ?? null;
        $limit = self::PRESENCE_TIMEOUT + self::GRACE;
        $activeGone = $sa !== null && ($now - (float) $sa) > $limit;
        $otherGone = $so !== null && ($now - (float) $so) > $limit;
        if ($activeGone || $otherGone) {
            if ($otherGone && ! $activeGone) {
                // Rakip poll'u kesti (terk) -> rakip kaybeder; sira sahibi korunur.
                $clock['end'] = ['reason' => 'ABANDON', 'winner' => $active];
            } elseif ($activeGone && ! $otherGone) {
                // Sira sahibi poll'u kesti (terk) -> terk eden kaybeder.
                $clock['end'] = ['reason' => 'ABANDON', 'winner' => $other];
            }
            // Ikisi de gitmisse: kimse yok -> haksiz kayip yazma (karar verme).
            return $clock;
        }

        $bank = (float) ($clock[$active.'_bank'] ?? 0);
        $start = (float) ($clock['started_at'] ?? $now);
        $delay = (float) ($clock['delay'] ?? 0);
        $timeoutAt = $start + $delay + $bank; // ana sure bitisi
        $afkAt = $start + self::AFK_TOTAL;     // hareketsizlik bitisi
        // AFK, macin ILK gercek hamlesinden ONCE SAYILMAZ (matchmaking sonrasi yukleme/acilis
        // payi). O ana kadar sadece TIMEOUT (banka) + presence (terk) yedek olarak calisir
        // -> hazir bekleyen oyuncu acilista haksiz AFK yemez, ama sonsuza dek de stall edemez.
        $moved = (bool) ($clock['moved'] ?? false);
        $timedOut = $now >= $timeoutAt + self::GRACE;              // banka tukendi
        $afkedOut = $moved && ($now >= $afkAt + self::GRACE);      // hareketsiz (yalniz ilk hamleden sonra)
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

        if ($running && $active !== null) {
            $elapsed = max(0.0, $now - (float) ($clock['started_at'] ?? $now));
            $used = max(0.0, $elapsed - (float) ($clock['delay'] ?? 0));
            if ($active === 'p1') {
                $p1 = max(0.0, $p1 - $used);
            } else {
                $p2 = max(0.0, $p2 - $used);
            }
            $delayRem = max(0.0, (float) ($clock['delay'] ?? 0) - $elapsed);
            // AFK geri sayimi yalniz ILK gercek hamleden sonra gorunur (acilis payi).
            $afkRem = ! empty($clock['moved']) ? max(0.0, self::AFK_TOTAL - $elapsed) : null;
        }

        $activeColor = $active === 'p1' ? 'white' : ($active === 'p2' ? 'black' : null);
        $end = $clock['end'] ?? null;

        return [
            'white' => round($p1, 1),
            'black' => round($p2, 1),
            'delay' => round($delayRem, 1),
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
