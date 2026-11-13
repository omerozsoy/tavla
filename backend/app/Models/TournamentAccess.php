<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Canlı Turnuva Sistemi dernek/grup erişimi: admin isim + şifre tanımlar. Bu şifreyle giren grup
 * /canli-turnuva-sistemi formundan turnuva kurar. Şifre DÜZ METİN (join_password gibi, admin görsün).
 */
class TournamentAccess extends Model
{
    protected $fillable = ['name', 'password', 'active', 'created_count', 'last_used_at'];

    protected $casts = [
        'active' => 'boolean',
        'last_used_at' => 'datetime',
        'created_count' => 'integer',
    ];

    /** Verilen şifreye uyan AKTİF erişimi döndürür (yoksa null). */
    public static function match(?string $password): ?self
    {
        $password = trim((string) $password);
        if ($password === '') {
            return null;
        }
        foreach (self::where('active', true)->get() as $a) {
            if (hash_equals($a->password, $password)) {
                return $a;
            }
        }

        return null;
    }
}
