<?php

/**
 * TavlaTV — Adil Zar BAĞIMSIZ DOĞRULAYICI (tek dosya, Laravel GEREKMEZ).
 *
 * Maç bitince açığa çıkan `serverSeed` + `clientSeed` + `commit` ile o maçın TÜM zarlarını
 * sıfırdan yeniden üretir ve sunucunun kaydıyla birebir karşılaştırır. Algoritma
 * `App\Services\FairDiceService` ile BYTE-AYNI (v1 eski odalar + v2 commit-reveal).
 *
 * KULLANIM
 *   php verify.php --self-test     # gömülü ground-truth vektörleriyle kendini sına (kod doğru mu?)
 *   php verify.php reveal.json     # gerçek bir maçın reveal verisini doğrula
 *
 * reveal.json BİÇİMİ (maç sonu "reveal" çıktısı):
 *   {
 *     "commit":     "<sha256 hex>",
 *     "serverSeed": "<64 hex>",
 *     "clientSeed": "<p1>.<p2>"   (v2)   ya da   "<tek tohum>"  (v1),
 *     "rolls": [
 *       {"opening": 1, "white": 2, "black": 6, "starter": "black"},
 *       {"index": 0, "dice": [6,6,6,6]},
 *       {"index": 1, "dice": [3,2]}
 *     ]
 *   }
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
    $rolls = $reveal['rolls'] ?? [];

    $commitOk = $commit !== '' && hash_equals($commit, hash('sha256', $serverSeed));
    $out = ['commitOk' => $commitOk, 'rolls' => [], 'allOk' => $commitOk];

    foreach ((array) $rolls as $e) {
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
            $computed = fd_played(fd_roll($serverSeed, $clientSeed, (int) ($e['index'] ?? 0)));
            $recorded = array_map('intval', (array) ($e['dice'] ?? []));
            $ok = $computed === $recorded;
            $out['rolls'][] = [
                'kind' => 'roll',
                'index' => (int) ($e['index'] ?? 0),
                'recorded' => $recorded,
                'computed' => $computed,
                'ok' => $ok,
            ];
        }
        if (! $ok) {
            $out['allOk'] = false;
        }
    }

    return $out;
}

/* ---------------- Self-test (PHP FairDiceService ground-truth) ---------------- */

function fd_self_test(): bool
{
    $SEED = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';
    $pass = true;
    $check = function (string $label, $got, $exp) use (&$pass): void {
        $ok = $got === $exp;
        if (! $ok) {
            $pass = false;
        }
        printf("  [%s] %-22s got=%s  exp=%s\n", $ok ? 'OK' : 'X', $label, json_encode($got), json_encode($exp));
    };

    $check('commit', hash('sha256', $SEED), '83418260fe3c7bf5063efde5c04315bab07ae31ea393e5adf84dbc7a52181eef');

    // v1 (clientSeed = 'clientX', nokta yok)
    $check('v1 roll0', fd_roll($SEED, 'clientX', 0), [5, 5]);
    $check('v1 roll1', fd_roll($SEED, 'clientX', 1), [3, 2]);
    $check('v1 roll3', fd_roll($SEED, 'clientX', 3), [1, 6]);
    $check('v1 roll7', fd_roll($SEED, 'clientX', 7), [2, 1]);
    $check('v1 roll0 bos-cs', fd_roll($SEED, '', 0), [4, 6]);
    $check('v1 single4', fd_single($SEED, 'clientX', 4), 5);
    $check('v1 opening g1', fd_reproduce_opening($SEED, 'clientX', 1), ['white' => 5, 'black' => 4, 'starter' => 'white']);

    // v2 (clientSeed = '<p1>.<p2>')
    $CS = '0123456789abcdef.fedcba9876543210';
    $check('v2 roll0', fd_roll($SEED, $CS, 0), [6, 2]);
    $check('v2 roll2', fd_roll($SEED, $CS, 2), [1, 1]);
    $check('v2 roll7', fd_roll($SEED, $CS, 7), [1, 4]);
    $check('v2 roll0 bos-cs', fd_roll($SEED, '.', 0), [4, 1]);
    $check('v2 openingDie g1 a2', fd_opening_die($SEED, $CS, 1, 2), 6);
    $check('v2 openingDie g2 a0', fd_opening_die($SEED, $CS, 2, 0), 3);
    $check('v2 opening g1', fd_reproduce_opening($SEED, $CS, 1), ['white' => 2, 'black' => 6, 'starter' => 'black']);

    return $pass;
}

/* ---------------- CLI ---------------- */

if (PHP_SAPI === 'cli') {
    $arg = $argv[1] ?? null;

    if ($arg === '--self-test') {
        echo "FairDice self-test (PHP ground-truth vektörleri):\n";
        $ok = fd_self_test();
        echo $ok ? "\nTUMU GECTI — kod sunucuyla birebir.\n" : "\nBASARISIZ — port bozulmus.\n";
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
        foreach ($res['rolls'] as $r) {
            if ($r['kind'] === 'opening') {
                printf("  [%s] oyun %d acilis   kayit=%s  hesap=%s\n", $r['ok'] ? 'OK' : 'X', $r['game'], json_encode($r['recorded']), json_encode($r['computed']));
            } else {
                printf("  [%s] index %-3d       kayit=%s  hesap=%s\n", $r['ok'] ? 'OK' : 'X', $r['index'], json_encode($r['recorded']), json_encode($r['computed']));
            }
        }
        printf("\nSONUC: %s\n", $res['allOk'] ? 'TUM ZARLAR DOGRULANDI' : 'TUTMAYAN KAYIT VAR');
        exit($res['allOk'] ? 0 : 1);
    }

    echo "Kullanim:\n  php verify.php --self-test\n  php verify.php reveal.json\n";
    exit(0);
}
