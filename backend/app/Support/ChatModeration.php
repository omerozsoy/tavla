<?php

namespace App\Support;

use App\Models\User;
use Carbon\Carbon;

/**
 * Sohbet (oyun içi + DM) küfür yaptırımı. Kelime listesi + normalize NicknameFilter'dan gelir
 * (panelden yönetilen tek liste). Küfür tespitinde:
 *   1) küfürlü token'lar **** ile maskelenir (mesaj yine iletilir, sansürlü),
 *   2) artan konuşma yasağı uygulanır: 1. ihlal YALNIZ UYARI (yasak yok), 2=24 saat,
 *      3=1 hafta, 4=1 ay, 5+=1 yıl.
 *
 * ponytail: eşleşme NicknameFilter substring'i (scunthorpe yanlış-pozitif riski) + ilk ihlalde
 * ANINDA 24s yasak sert; liste panelden (banned_nicknames) inceltilir, gerekirse ilk ihlali
 * "yalnız uyarı" yapmak için penalize çağrısı geciktirilebilir.
 */
class ChatModeration
{
    /** İhlal sırasına göre yasak dakikaları: 1. ihlal=0 (yalnız uyarı), 2=24s, 3=1h, 4=1ay, 5+=1yıl. */
    public const BAN_MINUTES = [0, 1440, 10080, 43200, 525600];

    /** İhlal sırasına göre i18n etiket anahtarı (frontend yerelleştirir). 'warn' = yalnız uyarı. */
    public const BAN_LABELS = ['warn', '24h', '1w', '1mo', '1y'];

    private static function idx(int $offense): int
    {
        return min(max(1, $offense), count(self::BAN_MINUTES)) - 1;
    }

    /** Küfürlü token'ları **** ile maskele.
     *  @return array{0:string,1:bool,2:?string} [maskeli_metin, bulundu_mu, tetikleyen_kelime]
     *  tetikleyen_kelime = ilk eşleşen "kullanıcı_token (eşleşen_kök)" (ör. "klasik (sik)") -> Yasaklılar
     *  panelinde gösterilir; admin yanlış-pozitifi görür. ADMIN MUAF: is_admin ise maskelenmez (hit=false). */
    public static function filter(string $text, ?User $u = null): array
    {
        if ($u && $u->is_admin) {
            return [$text, false, null];
        }
        $sub = NicknameFilter::words();          // substring aranan kokler
        $whole = NicknameFilter::wholeWords();   // '=' onekli tam-kelime kokler
        if (! $sub && ! $whole) {
            return [$text, false, null];
        }
        $hit = false;
        $matched = null; // ilk eşleşen kelime (yasak kararı için)
        $out = preg_replace_callback('/\S+/u', function ($m) use ($sub, $whole, &$hit, &$matched) {
            $norm = NicknameFilter::normalize($m[0]);
            if ($norm === '') {
                return $m[0];
            }
            foreach ($sub as $w) {
                if (str_contains($norm, $w)) {
                    $hit = true;
                    if ($matched === null) {
                        $matched = mb_substr($m[0], 0, 60).' ('.$w.')'; // "klasik (sik)"
                    }

                    return '****';
                }
            }
            if (in_array($norm, $whole, true)) { // tam-kelime: token'a birebir esit
                $hit = true;
                if ($matched === null) {
                    $matched = mb_substr($m[0], 0, 60);
                }

                return '****';
            }

            return $m[0];
        }, $text);

        return [$out ?? $text, $hit, $matched];
    }

    /** Kullanıcı şu an konuşma yasaklı mı? Kalan saniye (>0) ya da null.
     *  ADMIN KESİNLİKLE YASAKLANMAZ: is_admin ise daima null (eski bir yasak kalmış olsa bile konuşur). */
    public static function mutedSeconds(User $u): ?int
    {
        if ($u->is_admin) {
            return null;
        }
        $until = $u->chat_muted_until;
        if (! $until instanceof Carbon) {
            return null;
        }
        $left = $until->getTimestamp() - time();

        return $left > 0 ? $left : null;
    }

    /** Bir ihlal işle: sayacı artır; yasak süresi >0 ise uygula (1. ihlal=0 -> yalnız uyarı), kaydet.
     *  $word: ihlali tetikleyen kelime (Yasaklılar panelinde gösterilir).
     *  @return array{level:int,label:string,warning_only:bool,until:?string,seconds:int} */
    public static function penalize(User $u, ?string $word = null): array
    {
        // ADMIN KESİNLİKLE YASAKLANMAZ: sayaç artmaz, yasak yazılmaz; yalnız-uyarı no-op döner.
        if ($u->is_admin) {
            return [
                'level' => 0,
                'label' => 'warn',
                'warning_only' => true,
                'until' => null,
                'seconds' => 0,
            ];
        }
        $offense = (int) $u->chat_offenses + 1;
        $minutes = self::BAN_MINUTES[self::idx($offense)];
        $u->chat_offenses = $offense;
        $until = null;
        if ($minutes > 0) {
            $until = now()->addMinutes($minutes);
            $u->chat_muted_until = $until;
        }
        // Tetikleyen kelimeyi sakla (Yasaklılar paneli gösterir). Kolon yoksa (migrate gecikmesi) atla.
        if ($word !== null && \Illuminate\Support\Facades\Schema::hasColumn('users', 'chat_offense_word')) {
            $u->chat_offense_word = mb_substr($word, 0, 120);
        }
        $u->save();

        return [
            'level' => $offense,
            'label' => self::BAN_LABELS[self::idx($offense)],
            'warning_only' => $minutes === 0,
            'until' => $until?->toIso8601String(),
            'seconds' => $minutes * 60,
        ];
    }
}
