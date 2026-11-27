<?php

namespace App\Services;

/**
 * Sunucu-otoriter, provably-fair (commit-reveal) zar üretimi.
 *
 * AKIŞ (v2 — oda kurulduğundan beri):
 *  1) Oda OLUŞTURULURKEN (Room::creating) sunucu gizli `serverSeed` (32 bayt, 64 hex metin) üretir;
 *     `commit = SHA256(serverSeed)` hemen istemcilere görünür. Henüz hiçbir istemci tohumu yoktur.
 *  2) Her İNSAN oyuncu, commit'i GÖRDÜKTEN SONRA kendi rastgele tohumunu (hex) gönderir (poll veya
 *     roll ile). Sunucu bunu `clientSeed = "<p1>.<p2>"` biçiminde birleştirir. İlk zar (açılış)
 *     atıldıktan sonra tohum DONAR; yeni katkı kabul edilmez. Sunucu kendi tohumunu oyuncu
 *     tohumlarından ÖNCE taahhüt ettiği için onlara göre seçemez.
 *  3) Zar baytı = HMAC_SHA256(key = serverSeed'in hex METNİ (çözülmez), mesaj):
 *       normal el : "v2:roll:<clientSeed>:<index>:<round>"
 *       açılış    : "v2:single:<clientSeed>:<gameNo>:<attempt>:<round>"
 *     round=0,1,… bloklarında 252 ve üzeri baytlar ATLANIR (252 = 42×6 -> modulo yanlılığı yok);
 *     zar = (bayt % 6) + 1. "roll"/"single" önekleri iki alanı ayırır; açılış oyun numarasıyla
 *     anahtarlandığı için beraberlik tekrarları bir sonraki oyunun açılışına taşmaz.
 *  4) Maç bitince serverSeed + clientSeed + zar logu AÇILIR -> herkes commit'i ve tüm zarları doğrular.
 *
 * v1 (ESKİ odalar, clientSeed içinde '.' YOK): mesaj "<clientSeed>:<index>:<round>" ve açılış
 * "<clientSeed>:single:<gameNo*4+k>:<round>". Eski maçların doğrulaması bozulmasın diye korunur.
 * Sürüm clientSeed biçiminden anlaşılır (versionOf) -> şema değişikliği gerekmez.
 *
 * MOTOR/AI ÇALIŞTIRMAZ; salt kriptografik türetim. Deterministik (aynı girdi -> aynı zar).
 */
class FairDiceService
{
    /** v2 oyuncu tohumu: yalnız küçük harf hex, 8-31 hane (iki parça + '.' = 64 karakterlik kolona sığar). */
    public const PLAYER_SEED_PATTERN = '/^[0-9a-f]{8,31}$/';

    /** Yeni gizli sunucu tohumu (64 hex = 32 bayt). */
    public function newSeed(): string
    {
        return bin2hex(random_bytes(32));
    }

    /** İstemcilere gösterilen taahhüt (tohumu açığa vurmadan). */
    public function commit(string $serverSeed): string
    {
        return hash('sha256', $serverSeed);
    }

    /** v2 odanın başlangıç clientSeed'i: iki oyuncu parçası da boş. */
    public static function emptyV2ClientSeed(): string
    {
        return '.';
    }

    /** clientSeed biçiminden algoritma sürümü: "<p1>.<p2>" = v2, aksi = v1 (eski odalar). */
    public static function versionOf(string $clientSeed): int
    {
        return str_contains($clientSeed, '.') ? 2 : 1;
    }

    /**
     * v2 clientSeed'e `slot` oyuncusunun tohumunu ekler. Eklenemiyorsa (v1 oda, geçersiz tohum,
     * o slot zaten katkı vermiş) null döner. Dondurma (ilk zardan sonra) kontrolü ÇAĞIRANDADIR.
     */
    public static function withPlayerSeed(string $clientSeed, string $slot, mixed $seed): ?string
    {
        if (self::versionOf($clientSeed) !== 2 || ($slot !== 'p1' && $slot !== 'p2') || ! is_string($seed)) {
            return null;
        }
        $seed = strtolower(trim($seed));
        if (! preg_match(self::PLAYER_SEED_PATTERN, $seed)) {
            return null;
        }
        [$p1, $p2] = explode('.', $clientSeed, 2);
        if ($slot === 'p1') {
            if ($p1 !== '') {
                return null;
            }
            $p1 = $seed;
        } else {
            if ($p2 !== '') {
                return null;
            }
            $p2 = $seed;
        }

        return $p1.'.'.$p2;
    }

    /**
     * `index` elindeki zar çifti (deterministik). Her ikisi de 1..6.
     *
     * @return array{0:int,1:int} [d1, d2]
     */
    public function roll(string $serverSeed, string $clientSeed, int $index): array
    {
        $message = self::versionOf($clientSeed) === 2
            ? 'v2:roll:'.$clientSeed.':'.$index
            : $clientSeed.':'.$index;
        $bytes = $this->uniformBytes($serverSeed, $message, 2);

        return [($bytes[0] % 6) + 1, ($bytes[1] % 6) + 1];
    }

    /**
     * Açılış zarı: `gameNo` oyununun `attempt`. denemesi (0 = beyaz, 1 = siyah, 2+ = beraberlik
     * sonrası siyahın yeniden atışı). v2'de oyun numarası mesajda ayrı alan -> oyunlar arası çakışma yok.
     */
    public function openingDie(string $serverSeed, string $clientSeed, int $gameNo, int $attempt): int
    {
        if (self::versionOf($clientSeed) === 2) {
            $bytes = $this->uniformBytes($serverSeed, 'v2:single:'.$clientSeed.':'.$gameNo.':'.$attempt, 1);

            return ($bytes[0] % 6) + 1;
        }

        return $this->single($serverSeed, $clientSeed, $gameNo * 4 + $attempt); // v1 (eski odalar)
    }

    /** v1 açılış zarı (eski odalar): mesaj "<clientSeed>:single:<index>". Yeni kod openingDie kullanır. */
    public function single(string $serverSeed, string $clientSeed, int $index): int
    {
        $bytes = $this->uniformBytes($serverSeed, $clientSeed.':single:'.$index, 1);

        return ($bytes[0] % 6) + 1;
    }

    /**
     * HMAC_SHA256(key=serverSeed metni, "<message>:<round>") bloklarından [0,251] aralığındaki
     * baytları `count` adet toplar (252-255 atlanır).
     *
     * @return list<int>
     */
    private function uniformBytes(string $serverSeed, string $message, int $count): array
    {
        $accepted = [];
        for ($round = 0; count($accepted) < $count; $round++) {
            $mac = hash_hmac('sha256', $message.':'.$round, $serverSeed, true);
            for ($i = 0, $length = strlen($mac); $i < $length && count($accepted) < $count; $i++) {
                $byte = ord($mac[$i]);
                if ($byte < 252) {
                    $accepted[] = $byte;
                }
            }
        }

        return $accepted;
    }

    /**
     * Doğrulama: açığa vurulan tohum verilen commit'i üretiyor mu?
     */
    public function verifyCommit(string $serverSeed, string $commit): bool
    {
        return hash_equals($commit, $this->commit($serverSeed));
    }
}
