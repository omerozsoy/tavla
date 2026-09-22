<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Takma ad sınırı 15'e indirildi (form + backend + Google yolu hizalandı). Bu veri-migration'ı
 * MEVCUT 15'ten uzun takma adları 15'e KIRPAR. Çakışma olursa (kırpılan taban zaten alınmışsa)
 * sona sayı eki eklenir ve toplam yine <=15 tutulur (Google otomatik-ad mantığıyla aynı).
 *
 * Benzersizlik büyük/küçük harf DUYARSIZ karşılaştırılır (MySQL ci collation ile tutarlı) ->
 * kırpma yeni bir çakışma üretmez. Geri alınamaz (orijinal uzun adlar saklanmaz) -> down() no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        $users = DB::table('users')->select('id', 'nickname')->orderBy('id')->get();

        // 15'i AŞMAYAN mevcut adlar olduğu gibi kalır -> önce onları "alınmış" kümesine koy ki
        // kırpılanlar bunlarla çakışmasın.
        $taken = [];
        foreach ($users as $u) {
            $nick = (string) $u->nickname;
            if (mb_strlen($nick) <= 15) {
                $taken[mb_strtolower($nick)] = true;
            }
        }

        foreach ($users as $u) {
            $nick = (string) $u->nickname;
            if (mb_strlen($nick) <= 15) {
                continue; // zaten kural içinde
            }
            $base = mb_substr($nick, 0, 15);
            $candidate = $base;
            $i = 0;
            while (isset($taken[mb_strtolower($candidate)])) {
                $i++;
                $suffix = (string) $i;
                $candidate = mb_substr($base, 0, max(1, 15 - mb_strlen($suffix))).$suffix;
            }
            $taken[mb_strtolower($candidate)] = true;
            DB::table('users')->where('id', $u->id)->update(['nickname' => $candidate]);
        }
    }

    public function down(): void
    {
        // Orijinal (kırpılmadan önceki) takma adlar saklanmadığından geri alınamaz.
    }
};
