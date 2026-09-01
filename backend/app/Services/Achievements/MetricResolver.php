<?php

namespace App\Services\Achievements;

use App\Models\User;
use App\Models\UserStat;

/**
 * MetricResolver — bir threshold metriginin kullanici icin GUNCEL degerini dondurur.
 * Tum degerler mevcut sayaclardan (users + user_stats) okunur; gecmis YENIDEN taranmaz.
 * Yeni bir metrik eklemek: buraya bir case ekle + config'de kullan.
 */
final class MetricResolver
{
    /** @return int|float */
    public static function value(User $user, UserStat $stat, string $metric)
    {
        return match ($metric) {
            'total_matches' => (int) ($user->games_played ?? 0),
            'total_wins' => (int) ($user->wins ?? 0),
            'total_losses' => (int) ($user->losses ?? 0),
            'coin_balance' => (int) ($user->coins ?? 0),

            'best_win_streak' => (int) $stat->best_win_streak,
            'total_gammons' => (int) $stat->total_gammons,
            'total_backgammons' => (int) $stat->total_backgammons,
            'total_doubles' => (int) $stat->total_doubles,
            'tournaments_won' => (int) $stat->tournaments_won,
            'tournaments_played' => (int) $stat->tournaments_played,
            'lifetime_coin' => (int) $stat->lifetime_coin,
            'best_rating' => (int) $stat->best_rating,
            'analysis_count' => (int) $stat->analysis_count,
            'clean_matches' => (int) $stat->clean_matches,
            'correct_cube_decisions' => (int) $stat->correct_cube_decisions,
            'best_move_streak' => (int) $stat->best_move_streak,

            default => 0,
        };
    }
}
