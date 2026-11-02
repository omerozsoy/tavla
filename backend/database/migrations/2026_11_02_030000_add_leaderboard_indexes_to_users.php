<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Liderlik tablolari halka acik + sik poll edilir. `rating` zaten indeksli ama `coins`/`total_wxp`
// (leaderboard?by=coins|wxp) ve `career_pr` (PR Siralamasi) indekssizdi -> her istek full-table
// filesort yapiyordu (kullanici sayisiyla buyur). 30sn onbellek ilk-miss disindaki maliyeti keser;
// bu indeksler o ilk-miss (ve admin/arama) sorgusunu da ucuzlatir.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'coins')) {
                $table->index('coins', 'users_coins_index');
            }
            if (Schema::hasColumn('users', 'total_wxp')) {
                $table->index('total_wxp', 'users_total_wxp_index');
            }
            if (Schema::hasColumn('users', 'career_pr')) {
                $table->index('career_pr', 'users_career_pr_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['users_coins_index', 'users_total_wxp_index', 'users_career_pr_index'] as $idx) {
                try {
                    $table->dropIndex($idx);
                } catch (\Throwable $e) {
                    // indeks yoksa (kolon yoktu) sessiz gec
                }
            }
        });
    }
};
