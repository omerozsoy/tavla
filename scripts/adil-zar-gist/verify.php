<?php

/**
 * TavlaTV — Adil Zar BAĞIMSIZ DOĞRULAYICI (tek dosya, Laravel GEREKMEZ).
 *
 * Maç bitince açığa çıkan `serverSeed` + `clientSeed` + `commit` ile o maçın TÜM zarlarını
 * sıfırdan yeniden üretir, sunucunun kaydıyla karşılaştırır VE index bütünlüğünü denetler.
 * Algoritma `App\Services\FairDiceService` ile BYTE-AYNI (v1 eski odalar + v2 commit-reveal).
 *
 * KULLANIM
 *   php verify.php --self-test               # gömülü ground-truth vektörleriyle kendini sına
 *   php verify.php --compare-live <path>     # CANLI FairDiceService.php ile birebir mi (sync öncesi)
 *   php verify.php reveal.json               # gerçek bir maçın reveal verisini doğrula
 *
 * reveal.json BİÇİMİ (maç sonu "reveal" çıktısı):
 *   {
 *     "commit":     "<sha256 hex>",
 *     "serverSeed": "<64 hex>",
 *     "clientSeed": "<p1>.<p2>"   (v2)   ya da   "<tek tohum>"  (v1),
 *     "bot":        false,   // (istege bagli) bot maci ise true -> p2 tohum parcasinin bos olmasi normaldir
 *     "rolls": [
 *       {"opening": 1, "white": 2, "black": 6, "starter": "black"},
 *       {"index": 0, "dice": [6, 2]},
 *       {"index": 1, "dice": [6, 1]},
 *       {"index": 2, "dice": [1, 1, 1, 1]}
 *     ]
 *   }
 *
 * ÖNEMLİ — index bütünlüğü: sunucu normal el zarlarını `index` 0,1,2,… ARALIKSIZ atar
 * (RoomController: dice_roll_index). Bir index EKSİK/TEKRAR/boşluklu ise sunucu beğenmediği bir
 * zarı atlamış olabilir; bu doğrulayıcı bunu YAKALAR ve sonucu "başarısız" sayar.
 */

/* ---------------- Çekirdek (FairDiceService ile birebir) ---------------- */

function fd_version_of(string $clientSeed): int
{
    return str_contains($clientSeed, '.') ? 2 : 1;
}

/** HMAC_SHA256(key = serverSeed metni, "<message>:<round>") bloklarından <252 baytları, `count` adet. */
function fd_uniform_bytes(string $serverSeed, string $message, int $count): array
{
    $accepted = [];
    for ($round = 0; count($accepted) < $count; $round++) {
        $mac = hash_hmac('sha256', $message.':'.$round, $serverSeed, true);
        for ($i = 0, $len = strlen($mac); $i < $len && count($accepted) < $count; $i++) {
            $byte = ord($mac[$i]);
            if ($byte < 252) { // 252 = 42×6 -> modulo yanlılığı yok
                $accepted[] = $byte;
            }
        }
    }

    return $accepted;
}

/** `index` elindeki zar çifti [d1, d2] (1..6). */
function fd_roll(string $serverSeed, string $clientSeed, int $index): array
{
    $message = fd_version_of($clientSeed) === 2
        ? 'v2:roll:'.$clientSeed.':'.$index
        : $clientSeed.':'.$index;
    $b = fd_uniform_bytes($serverSeed, $message, 2);

    return [($b[0] % 6) + 1, ($b[1] % 6) + 1];
}

/** v1 tek zar (eski odaların açılışı). */
function fd_single(string $serverSeed, string $clientSeed, int $index): int
{
    $b = fd_uniform_bytes($serverSeed, $clientSeed.':single:'.$index, 1);

    return ($b[0] % 6) + 1;
}

/** Açılış zarı: attempt 0 = beyaz, 1 = siyah, 2+ = beraberlik sonrası siyahın yeniden atışı. */
function fd_opening_die(string $serverSeed, string $clientSeed, int $gameNo, int $attempt): int
{
    if (fd_version_of($clientSeed) === 2) {
        $b = fd_uniform_bytes($serverSeed, 'v2:single:'.$clientSeed.':'.$gameNo.':'.$attempt, 1);

        return ($b[0] % 6) + 1;
    }

    return fd_single($serverSeed, $clientSeed, $gameNo * 4 + $attempt);
}

/** Açılış eli: beraberlikte siyah farklı çıkana dek yeniden atar. Başlayan = yüksek zar. */
function fd_reproduce_opening(string $serverSeed, string $clientSeed, int $gameNo): array
{
    $white = fd_opening_die($serverSeed, $clientSeed, $gameNo, 0);
    $black = fd_opening_die($serverSeed, $clientSeed, $gameNo, 1);
    for ($k = 2; $white === $black; $k++) {
        $black = fd_opening_die($serverSeed, $clientSeed, $gameNo, $k);
    }

    return ['white' => $white, 'black' => $black, 'starter' => $white > $black ? 'white' : 'black'];
}

/** Zar çiftini oyundaki diziye çevir (çift = 4 zar). */
function fd_played(array $pair): array
{
    [$a, $b] = $pair;

    return $a === $b ? [$a, $a, $a, $a] : [$a, $b];
}

/* ---------------- Reveal doğrulama ---------------- */

function fd_verify_reveal(array $reveal): array
{
    $serverSeed = (string) ($reveal['serverSeed'] ?? '');
    $clientSeed = (string) ($reveal['clientSeed'] ?? '');
    $commit = (string) ($reveal['commit'] ?? '');
    $isBot = (bool) ($reveal['bot'] ?? false);
    $rolls = (array) ($reveal['rolls'] ?? []);

    $commitOk = $commit !== '' && hash_equals($commit, hash('sha256', $serverSeed));
    $out = ['commitOk' => $commitOk, 'rolls' => [], 'warnings' => [], 'integrity' => null, 'allOk' => $commitOk];

    // --- #2: v2 boş tohum parçası uyarısı ---
    if (fd_version_of($clientSeed) === 2) {
        [$p1, $p2] = array_pad(explode('.', $clientSeed, 2), 2, '');
        if ($p1 === '') {
            $out['warnings'][] = 'p1 tohum parcasi BOS — oyuncu-1 hic katki vermemis.';
        }
        if ($p2 === '' && ! $isBot) {
            $out['warnings'][] = 'p2 tohum parcasi BOS — PvP\'de rakip tohumu dusurulmus olabilir ("bot": true ise normaldir).';
        }
    }

    // --- her kaydı yeniden üret ---
    $regularIdx = [];
    foreach ($rolls as $e) {
        if (isset($e['opening'])) {
            $c = fd_reproduce_opening($serverSeed, $clientSeed, (int) $e['opening']);
            $ok = (int) ($e['white'] ?? -1) === $c['white']
                && (int) ($e['black'] ?? -1) === $c['black']
                && ($e['starter'] ?? null) === $c['starter'];
            $out['rolls'][] = [
                'kind' => 'opening',
                'game' => (int) $e['opening'],
                'recorded' => [(int) ($e['white'] ?? 0), (int) ($e['black'] ?? 0), $e['starter'] ?? null],
                'computed' => [$c['white'], $c['black'], $c['starter']],
                'ok' => $ok,
            ];
        } else {
            $idx = (int) ($e['index'] ?? -1);
            $regularIdx[] = $idx;
            $computed = fd_played(fd_roll($serverSeed, $clientSeed, $idx));
            $recorded = array_map('intval', (array) ($e['dice'] ?? []));
            $ok = $computed === $recorded;
            $out['rolls'][] = [
                'kind' => 'roll',
                'index' => $idx,
                'recorded' => $recorded,
                'computed' => $computed,
                'ok' => $ok,
            ];
        }
        if (! $ok) {
            $out['allOk'] = false;
        }
    }

    // --- #1: index bütünlüğü — normal el index'leri 0..N-1 ARALIKSIZ, TEKRARSIZ olmalı ---
    if ($regularIdx !== []) {
        $sorted = $regularIdx;
        sort($sorted);
        $expected = range(0, count($sorted) - 1);
        $contiguous = ($sorted === $expected); // sort edilmiş dizi tam 0..N-1 ise boşluk/tekrar yok
        $out['integrity'] = [
            'ok' => $contiguous,
            'count' => count($sorted),
            'got' => $sorted,
            'expected' => $expected,
        ];
        if (! $contiguous) {
            $out['allOk'] = false;
        }
    }

    // Uyarılar da sonucu kirletir (boş tohum = adalet şüphesi; bot ise reveal "bot":true demeli).
    if ($out['warnings'] !== []) {
        $out['allOk'] = false;
    }

    return $out;
}

/* ---------------- Self-test ---------------- */

function fd_self_test(): bool
{
    $SEED = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
    $CS = '0123456789abcdef.fedcba9876543210';
    $pass = true;
    $check = function (string $label, $got, $exp) use (&$pass): void {
        $ok = $got === $exp;
        if (! $ok) {
            $pass = false;
        }
        printf("  [%s] %-24s got=%s  exp=%s\n", $ok ? 'OK' : 'X', $label, json_encode($got), json_encode($exp));
    };

    // -- çekirdek vektörler (FairDiceService ground-truth) --
    $check('commit', hash('sha256', $SEED), '83418260fe3c7bf5063efde5c04315bab07ae31ea393e5adf84dbc7a52181eef');
    $check('v1 roll0', fd_roll($SEED, 'clientX', 0), [5, 5]);
    $check('v1 roll1', fd_roll($SEED, 'clientX', 1), [3, 2]);
    $check('v1 roll3', fd_roll($SEED, 'clientX', 3), [1, 6]);
    $check('v1 roll7', fd_roll($SEED, 'clientX', 7), [2, 1]);
    $check('v1 roll0 bos-cs', fd_roll($SEED, '', 0), [4, 6]);
    $check('v1 single4', fd_single($SEED, 'clientX', 4), 5);
    $check('v1 opening g1', fd_reproduce_opening($SEED, 'clientX', 1), ['white' => 5, 'black' => 4, 'starter' => 'white']);
    $check('v2 roll0', fd_roll($SEED, $CS, 0), [6, 2]);
    $check('v2 roll2', fd_roll($SEED, $CS, 2), [1, 1]);
    $check('v2 roll7', fd_roll($SEED, $CS, 7), [1, 4]);
    $check('v2 roll0 bos-cs', fd_roll($SEED, '.', 0), [4, 1]);
    $check('v2 openingDie g1 a2', fd_opening_die($SEED, $CS, 1, 2), 6);
    $check('v2 openingDie g2 a0', fd_opening_die($SEED, $CS, 2, 0), 3);
    $check('v2 opening g1', fd_reproduce_opening($SEED, $CS, 1), ['white' => 2, 'black' => 6, 'starter' => 'black']);

    // -- reveal mantığı: index bütünlüğü + boş tohum uyarısı --
    $mk = function (string $cs, array $idxs, array $extra = []) use ($SEED): array {
        $rolls = array_map(fn ($i) => ['index' => $i, 'dice' => fd_played(fd_roll($SEED, $cs, $i))], $idxs);

        return array_merge(['commit' => hash('sha256', $SEED), 'serverSeed' => $SEED, 'clientSeed' => $cs, 'rolls' => $rolls], $extra);
    };
    $check('integrity contiguous ok', fd_verify_reveal($mk($CS, [0, 1, 2]))['allOk'], true);
    $check('integrity gap -> fail', fd_verify_reveal($mk($CS, [0, 2]))['allOk'], false);   // index 1 atlanmış
    $check('integrity dup -> fail', fd_verify_reveal($mk($CS, [0, 1, 1]))['allOk'], false);
    $check('empty p2 pvp -> warn', count(fd_verify_reveal($mk('0123456789abcdef.', [0]))['warnings']) > 0, true);
    $check('empty p2 bot -> no warn', count(fd_verify_reveal($mk('0123456789abcdef.', [0], ['bot' => true]))['warnings']), 0);

    return $pass;
}

/* ---------------- CANLI servisle karşılaştırma (sync öncesi) ---------------- */

function fd_compare_live(string $serviceFile): bool
{
    if (! is_file($serviceFile)) {
        fwrite(STDERR, "Servis dosyasi yok: $serviceFile\n");

        return false;
    }
    require $serviceFile;
    $cls = 'App\\Services\\FairDiceService';
    if (! class_exists($cls)) {
        fwrite(STDERR, "FairDiceService sinifi yuklenemedi.\n");

        return false;
    }
    $svc = new $cls();
    $SEED = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
    $pass = true;
    foreach (['clientX', '', '0123456789abcdef.fedcba9876543210', '.'] as $cs) {
        for ($i = 0; $i < 64; $i++) {
            if ($svc->roll($SEED, $cs, $i) !== fd_roll($SEED, $cs, $i)) {
                $pass = false;
                printf("  X roll cs=%s i=%d\n", $cs === '' ? '(bos)' : $cs, $i);
            }
        }
        for ($g = 0; $g < 6; $g++) {
            for ($a = 0; $a < 6; $a++) {
                if ($svc->openingDie($SEED, $cs, $g, $a) !== fd_opening_die($SEED, $cs, $g, $a)) {
                    $pass = false;
                    printf("  X openingDie cs=%s g=%d a=%d\n", $cs === '' ? '(bos)' : $cs, $g, $a);
                }
            }
        }
    }

    return $pass;
}

/* ---------------- CLI (yalnız bu dosya doğrudan çalıştırılınca; require edilince sessiz) ---------------- */

if (PHP_SAPI === 'cli' && isset($argv[0]) && realpath($argv[0]) === realpath(__FILE__)) {
    $arg = $argv[1] ?? null;

    if ($arg === '--self-test') {
        echo "FairDice self-test (gomulu ground-truth vektorleri):\n";
        $ok = fd_self_test();
        echo $ok
            ? "\nTUMU GECTI — verify.php, gomulu vektorlerle tutarli.\n  (Bu vektorler PHP FairDiceService'ten uretildi; CANLI dosyayla birebirligi icin: --compare-live)\n"
            : "\nBASARISIZ — verify.php bozulmus.\n";
        exit($ok ? 0 : 1);
    }

    if ($arg === '--compare-live') {
        $svcFile = $argv[2] ?? '';
        echo "verify.php, CANLI FairDiceService.php ile karsilastiriliyor...\n";
        $ok = fd_compare_live($svcFile);
        echo $ok ? "BIREBIR — yayina hazir.\n" : "FARK VAR — verify.php guncellenmeli, push ETME.\n";
        exit($ok ? 0 : 1);
    }

    if ($arg !== null && is_file($arg)) {
        $json = json_decode((string) file_get_contents($arg), true);
        if (! is_array($json)) {
            fwrite(STDERR, "Gecersiz JSON: $arg\n");
            exit(2);
        }
        $res = fd_verify_reveal($json);
        printf("commit: %s\n", $res['commitOk'] ? 'OK (SHA256(serverSeed) == commit)' : 'UYUSMUYOR');
        foreach ($res['warnings'] as $w) {
            printf("UYARI: %s\n", $w);
        }
        foreach ($res['rolls'] as $r) {
            if ($r['kind'] === 'opening') {
                printf("  [%s] oyun %d acilis   kayit=%s  hesap=%s\n", $r['ok'] ? 'OK' : 'X', $r['game'], json_encode($r['recorded']), json_encode($r['computed']));
            } else {
                printf("  [%s] index %-3d       kayit=%s  hesap=%s\n", $r['ok'] ? 'OK' : 'X', $r['index'], json_encode($r['recorded']), json_encode($r['computed']));
            }
        }
        if ($res['integrity'] !== null && ! $res['integrity']['ok']) {
            printf("INDEX BUTUNLUGU BOZUK: normal el index'leri 0..%d araliksiz olmali. gelen=%s\n",
                $res['integrity']['count'] - 1, json_encode($res['integrity']['got']));
        }
        printf("\nSONUC: %s\n", $res['allOk'] ? 'TUM ZARLAR DOGRULANDI (bosluk/tekrar yok, uyari yok)' : 'DOGRULAMA BASARISIZ — yukariya bak');
        exit($res['allOk'] ? 0 : 1);
    }

    echo "Kullanim:\n  php verify.php --self-test\n  php verify.php --compare-live <FairDiceService.php>\n  php verify.php reveal.json\n";
    exit(0);
}
