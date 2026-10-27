<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Tek turnuva duyurusu. Admin panelden girilir, turnuva lobisinde gosterilir.
class TournamentAnnouncement extends Model
{
    protected $fillable = ['tournament_id', 'message'];

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    /**
     * Turnuva BAŞLAYINCA tipine göre kaydedilmiş STANDART duyuru metnini ($settingKey) otomatik yayınla.
     * Tek-kaynak başlatma metotlarından (Tournament::startBracket + SwissRuntime::start) çağrılır →
     * admin panel, API, autoStartDue ve cron HEPSİ kapsanır; admin elle "Turnuva Duyuru" yazmak zorunda kalmaz.
     * Metin boşsa VEYA turnuvada zaten duyuru varsa dokunmaz (idempotent — çift-başlatmaya dayanıklı).
     */
    public static function publishStandard(Tournament $t, string $settingKey): void
    {
        $msg = trim((string) Setting::get($settingKey));
        if ($msg === '' || static::where('tournament_id', $t->id)->exists()) {
            return;
        }
        static::create(['tournament_id' => $t->id, 'message' => $msg]);
    }
}
