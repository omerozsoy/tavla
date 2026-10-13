<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Saka reklami (AdStrip PRANK_AD_ID) tiklama kaydi. created_at DB tarafindan set edilir.
class AdClick extends Model
{
    public $timestamps = false;

    protected $fillable = ['ad_id', 'user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
