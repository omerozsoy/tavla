<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;
use App\Services\CareerPrService;
use App\Services\DiceStatisticsService;
use App\Services\PlayerStatisticsService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Profil SIFIRLAMA (temiz başlangıç) — kullanıcı KENDİ profilini "beyaz sayfa"ya döndürür:
 * oynadığı maçlar, PR (match + kariyer), başarımlar ve istatistik sayaçları silinir; rating
 * yeni üye gibi başlangıç değerine döner (0 DEĞİL — 0 lider tablosu/eşleşmeyi bozar).
 *
 * tavla:reset-matches (TÜM oyuncular, global) komutunun TEK-KULLANICI karşılığı — aynı tablo/kolon
 * seti ama user_id ile daraltılmış. KORUNUR: hesap, jetonlar (coins — satın alınmış), ödemeler,
 * üyelik/plan, kostümler (unlocks), arkadaşlar, kulüp, kimlik/avatar.
 *
 * Yalnız user_id'ye AİT satırları siler -> rakibin kaydını (game_logs/rooms p1·p2 paylaşımlı) BOZMAZ.
 * Çocuk FK'ler (match_result_id) match_results'tan ÖNCE silinir. Kendi transaction'ında.
 */
class UserProfileReset
{
    /** user_id kolonuyla tamamen temizlenen tablolar (çocuk FK -> ebeveyn sırası). */
    private const WIPE = [
        'user_wxp_transactions', // FK: match_result_id -> match_results'tan önce
        'decision_analyses',     // FK: match_result_id
        'blunders',
        'match_results',         // maç geçmişi + kariyer PR kaynağı
        'user_achievements',
        'user_stats',            // istatistik sayaçları
    ];

    public static function reset(User $user): void
    {
        DB::transaction(function () use ($user) {
            foreach (self::WIPE as $table) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'user_id')) {
                    DB::table($table)->where('user_id', $user->id)->delete();
                }
            }

            // users: hesabı KORU, yalnız türetilmiş yarış alanlarını sıfırla. rating -> yeni üye
            // başlangıcı (Setting 'starting_rating', varsayılan 1400). career_pr* recalc ile null olur.
            $reset = [];
            foreach ([
                'rating' => Setting::int('starting_rating', 1400),
                'wins' => 0, 'losses' => 0, 'games_played' => 0, 'total_wxp' => 0,
            ] as $col => $val) {
                if (Schema::hasColumn('users', $col)) {
                    $reset[$col] = $val;
                }
            }
            if ($reset !== []) {
                $user->forceFill($reset)->save(); // rating/wins $fillable değil -> forceFill
            }

            // Kariyer PR aggregate cache'ini maçlardan yeniden kur -> maç kalmadığı için null/0.
            (new CareerPrService)->recalc($user);

            // İstatistik CACHE'leri de temizlensin -> yoksa "Maç Tipine Göre PR" (median/pooled) ve
            // "Zar Ortalamaları" veriler silinse de bayat cache'ten gösterilmeye devam eder (maç-sonu
            // analiz job'ı bu ikisini zaten invalidate ediyor; reset de etmeli).
            app(PlayerStatisticsService::class)->invalidate($user->id);
            app(DiceStatisticsService::class)->invalidate($user->id);
        });
    }
}
