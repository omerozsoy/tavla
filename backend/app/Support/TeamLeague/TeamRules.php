<?php

namespace App\Support\TeamLeague;

/**
 * Takımlar Ligi tek kural/ayar noktası (calibration knobs). Sayıları buradan değiştir;
 * mantık kodu dokunulmaz. Değerler spec §2-§10'dan.
 */
final class TeamRules
{
    // §2 Kuruluş
    public const FOUND_COST = 10_000;          // coin, yalnız başarılı kuruluşta bir kez

    public const MIN_RATED_MATCHES = 20;       // tamamlanmış puanlı maç

    public const CAPACITY = 24;                 // kurucu + yardımcılar dahil

    public const NAME_MIN = 3;

    public const NAME_MAX = 30;

    public const TAG_MIN = 2;

    public const TAG_MAX = 5;

    // §2 İsim/etiket değişikliği (yalnız kurucu)
    public const RENAME_COST = 2_500;          // işlem başına

    public const RENAME_COOLDOWN_DAYS = 30;

    // §3 Roller
    public const MAX_ASSISTANTS = 2;

    // §4 Üyelik
    public const MAX_OPEN_APPLICATIONS = 3;

    public const JOIN_COOLDOWN_HOURS = 24;     // ayrılma/çıkarılma/premium-düşme/kapanma sonrası

    // §5 Premium devamlılığı
    public const PREMIUM_GRACE_DAYS = 7;       // normal üye/yardımcı yenileme süresi

    public const FOUNDER_INACTIVE_DAYS = 60;   // son girişten → otomatik devir

    // §6 Sıralama
    public const MIN_RANK_MEMBERS = 5;

    // §7 Karşılaşma
    public const MATCH_MIN_LEAD_HOURS = 1;     // onay anında başlangıca en az

    public const MAX_ACTIVE_MATCHES = 3;       // takım başına onaylı+sonuçlanmamış

    public const REMATCH_COOLDOWN_HOURS = 72;  // aynı çift tekrar oynama

    // §8 Kadro
    public const LINEUP_SIZE = 5;

    public const LOCK_BEFORE_MINUTES = 10;     // başlangıçtan önce kadro kilidi

    public const READY_WINDOW_MINUTES = 5;     // hazır olma süresi

    // §9 Puan
    public const GAME_POINTS = 5;              // her bireysel maç

    // §10 Aylık
    public const PTS_WIN = 3;

    public const PTS_DRAW = 1;

    public const PTS_LOSS = 0;
}
