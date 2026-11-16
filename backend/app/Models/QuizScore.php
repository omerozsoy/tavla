<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Soru Maratonu anonim skoru. Giriş gerekmez; takma-ad + skor + doğru sayısı.
 * Puan istemciden gelir (spoof mümkün) — kasual tabela; controller yalnız tip/aralık doğrular.
 */
class QuizScore extends Model
{
    protected $fillable = ['nickname', 'score', 'correct_count', 'ip_hash'];

    protected $casts = [
        'score' => 'integer',
        'correct_count' => 'integer',
    ];
}
