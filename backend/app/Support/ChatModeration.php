<?php

namespace App\Support;

use App\Models\User;
use Carbon\Carbon;

/**
 * Sohbet (oyun içi + DM) küfür yaptırımı. Kelime listesi + normalize NicknameFilter'dan gelir
 * (panelden yönetilen tek liste). Küfür tespitinde:
 *   1) küfürlü token'lar **** ile maskelenir (mesaj yine iletilir, sansürlü),
 *   2) artan konuşma yasağı uygulanır: 1=24 saat, 2=1 hafta, 3=1 ay, 4+=1 yıl.
 *
 * ponytail: eşleşme NicknameFilter substring'i (scunthorpe yanlış-pozitif riski) + ilk ihlalde
 * ANINDA 24s yasak sert; liste panelden (banned_nicknames) inceltilir, gerekirse ilk ihlali
 * "yalnız uyarı" yapmak için penalize çağrısı geciktirilebilir.
 */
class ChatModeration
{
    /** İhlal sırasına göre yasak dakikaları: 24s, 1h, 1ay, 1yıl (4+ hep 1yıl). */
    public const BAN_MINUTES = [1440, 10080, 43200, 525600];

    /** İhlal sırasına göre i18n etiket anahtarı (frontend yerelleştirir). */
    public const BAN_LABELS = ['24h', '1w', '1mo', '1y'];

    private static function idx(int $offense): int
    {
        return min(max(1, $offense), count(self::BAN_MINUTES)) - 1;
    }

    /** Küfürlü token'ları **** ile maskele. @return array{0:string,1:bool} [maskeli_metin, bulundu_mu] */
    public static function filter(string $text): array
    {
        $words = NicknameFilter::words();
        if (! $words) {
            return [$text, false];
        }
        $hit = false;
        $out = preg_replace_callback('/\S+/u', function ($m) use ($words, &$hit) {
            $norm = NicknameFilter::normalize($m[0]);
            if ($norm === '') {
                return $m[0];
            }
            foreach ($words as $w) {
                if (str_contains($norm, $w)) {
                    $hit = true;

                    return '****';
                }
            }

            return $m[0];
        }, $text);

        return [$out ?? $text, $hit];
    }

    /** Kullanıcı şu an konuşma yasaklı mı? Kalan saniye (>0) ya da null. */
    public static function mutedSeconds(User $u): ?int
    {
        $until = $u->chat_muted_until;
        if (! $until instanceof Carbon) {
            return null;
        }
        $left = $until->getTimestamp() - time();

        return $left > 0 ? $left : null;
    }

    /** Bir ihlal işle: sayacı artır, artan yasağı uygula, kaydet. @return array{level:int,label:string,until:string,seconds:int} */
    public static function penalize(User $u): array
    {
        $offense = (int) $u->chat_offenses + 1;
        $minutes = self::BAN_MINUTES[self::idx($offense)];
        $until = now()->addMinutes($minutes);
        $u->chat_offenses = $offense;
        $u->chat_muted_until = $until;
        $u->save();

        return [
            'level' => $offense,
            'label' => self::BAN_LABELS[self::idx($offense)],
            'until' => $until->toIso8601String(),
            'seconds' => $minutes * 60,
        ];
    }
}
