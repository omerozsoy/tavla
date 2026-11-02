<?php

namespace App\Support;

// Tie-farkında turnuva ödül dağıtımı (denetim R2). Eskiden ortak-rütbeli (aynı turda elenen / Swiss
// aynı derece) oyuncular düz listeye açılıp prizes[i]'yi SIRAYLA (seed/rating) alıyordu -> aynı
// dereceye farklı ödül = keyfi/haksız. Burada ortak-rütbe grubunun KAPSADIĞI ödül dilimleri toplanıp
// gruba EŞİT bölünür. KORUNUM: ödenen toplam == kapsanan dilimlerin toplamı (ne fazladan basar ne
// kaybeder); kalan (sum % size) ilk üyelere 1'er coin dağıtılır.
class PrizeDistribution
{
    /**
     * @param  array<int, array<int>>  $rankGroups  rütbe sırasıyla kohortlar; grup 0 = 1.'lik kohortu,
     *                                               her grup aynı dereceyi paylaşan oyuncu id'leri.
     * @param  array<int, array{coins?: int}>  $prizes  genel sıraya (0-tabanlı) göre ödül tablosu.
     * @return array<int, int>  [userId => coins] (yalnız >0 ödül alanlar).
     */
    public static function payouts(array $rankGroups, array $prizes): array
    {
        $out = [];
        $pos = 0; // genel 0-tabanlı sıra imleci
        foreach ($rankGroups as $group) {
            $group = array_values(array_filter(array_map('intval', $group), fn ($id) => $id > 0));
            $size = count($group);
            if ($size === 0) {
                continue;
            }
            // Bu grubun kapsadığı ödül dilimleri: [pos .. pos+size-1].
            $sum = 0;
            for ($k = 0; $k < $size; $k++) {
                $sum += (int) ($prizes[$pos + $k]['coins'] ?? 0);
            }
            $pos += $size;
            if ($sum <= 0) {
                continue;
            }
            $each = intdiv($sum, $size);
            $rem = $sum - $each * $size; // ilk $rem üyeye +1 coin (korunum: toplam == $sum)
            foreach ($group as $idx => $uid) {
                $amt = $each + ($idx < $rem ? 1 : 0);
                if ($amt > 0) {
                    $out[$uid] = ($out[$uid] ?? 0) + $amt;
                }
            }
        }

        return $out;
    }
}
