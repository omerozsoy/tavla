<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Şans Çarkı admin değişiklik günlüğü (ekonomik değer taşıdığı için izlenebilirlik).
 */
class LuckyWheelAudit extends Model
{
    public $timestamps = false; // yalnızca created_at

    protected $fillable = [
        'admin_id', 'admin_name', 'action', 'target', 'changes', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /** Denetim kaydı oluştur (yardımcı). $actor null ise auth()->user() denenir. */
    public static function log(string $action, ?string $target = null, ?array $changes = null, $actor = null): void
    {
        try {
            $actor = $actor ?: auth()->user();
            static::create([
                'admin_id' => $actor?->id,
                'admin_name' => $actor?->getFilamentName() ?? $actor?->email,
                'action' => $action,
                'target' => $target,
                'changes' => $changes,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // audit kaydı asıl işlemi bozmasın
        }
    }
}
