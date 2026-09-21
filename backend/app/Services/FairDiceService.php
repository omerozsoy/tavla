<?php

namespace App\Services;

/**
 * Sunucu-otoriter, provably-fair (commit-reveal) zar üretimi. Para maçı güvenliği Faz 1.
 *
 * Akış:
 *  1) Oyun/oda: sunucu gizli `serverSeed` üretir; `commit = SHA256(serverSeed)` istemcilere verilir.
 *  2) İstemci `clientSeed` katkısı verebilir (yoksa boş). Sunucu belirler; istemci zarı SEÇEMEZ.
 *  3) `index` sıralı el numarası. Zar = HMAC_SHA256(serverSeed, "clientSeed:index") ilk baytlarından.
 *  4) Oyun sonunda sunucu `serverSeed`'i AÇAR (reveal) -> iki taraf da commit + tüm zarları doğrular.
 *
 * MOTOR/AI ÇALIŞTIRMAZ; salt kriptografik türetim. Deterministik (aynı girdi -> aynı zar).
 */
class FairDiceService
{
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

    /**
     * `index` elindeki zar çifti (deterministik). Her ikisi de 1..6.
     * 256, 6'nın katı olmadığı için modulo bias oluşmaması adına 252 üzerindeki baytlar
     * reddedilir ve HMAC çıktısı bir sonraki domain-separated bloktan sürdürülür.
     *
     * @return array{0:int,1:int} [d1, d2]
     */
    public function roll(string $serverSeed, string $clientSeed, int $index): array
    {
        $bytes = $this->uniformBytes($serverSeed, $clientSeed.':'.$index, 2);
        $d1 = ($bytes[0] % 6) + 1;
        $d2 = ($bytes[1] % 6) + 1;

        return [$d1, $d2];
    }

    /** Açılış zarı: tek zar (başlayanı belirler). index'e göre deterministik. */
    public function single(string $serverSeed, string $clientSeed, int $index): int
    {
        $bytes = $this->uniformBytes($serverSeed, $clientSeed.':single:'.$index, 1);

        return ($bytes[0] % 6) + 1;
    }

    /** @return list<int> accepted bytes in [0, 251], uniformly mappable to 1..6. */
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
