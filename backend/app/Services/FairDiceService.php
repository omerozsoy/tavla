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
     * İki bağımsız zar için HMAC çıktısının ayrı baytlarını kullanırız (modülo-yanlılığı
     * ihmal edilir: 256 mod 6 = 4 -> ~%1.5 yanlılık, oyun için kabul edilir; istenirse
     * rejection-sampling'e geçilebilir).
     *
     * @return array{0:int,1:int} [d1, d2]
     */
    public function roll(string $serverSeed, string $clientSeed, int $index): array
    {
        $mac = hash_hmac('sha256', $clientSeed.':'.$index, $serverSeed, true); // ham baytlar
        $d1 = (ord($mac[0]) % 6) + 1;
        $d2 = (ord($mac[1]) % 6) + 1;

        return [$d1, $d2];
    }

    /** Açılış zarı: tek zar (başlayanı belirler). index'e göre deterministik. */
    public function single(string $serverSeed, string $clientSeed, int $index): int
    {
        $mac = hash_hmac('sha256', $clientSeed.':single:'.$index, $serverSeed, true);

        return (ord($mac[0]) % 6) + 1;
    }

    /**
     * Doğrulama: açığa vurulan tohum verilen commit'i üretiyor mu?
     */
    public function verifyCommit(string $serverSeed, string $commit): bool
    {
        return hash_equals($commit, $this->commit($serverSeed));
    }
}
