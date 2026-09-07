<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Şans Çarkı ödül tanımı. Admin panelden yönetilir. Çarkta gösterilecek dilimler
 * scopeEligible() ile belirlenir (aktif + tarih aralığında + stokta). Dilim sayısı
 * BU havuzun büyüklüğüdür — kodda sabit değildir.
 */
class LuckyWheelReward extends Model
{
    public const TYPE_COIN = 'COIN';
    public const TYPE_PREMIUM_DAY = 'PREMIUM_DAY';
    public const TYPE_AVATAR = 'AVATAR';
    public const TYPE_BOARD_THEME = 'BOARD_THEME';
    public const TYPE_BADGE = 'BADGE';
    public const TYPE_FREE_SPIN = 'FREE_SPIN';
    public const TYPE_CUSTOM = 'CUSTOM';

    public const TYPES = [
        self::TYPE_COIN,
        self::TYPE_PREMIUM_DAY,
        self::TYPE_AVATAR,
        self::TYPE_BOARD_THEME,
        self::TYPE_BADGE,
        self::TYPE_FREE_SPIN,
        self::TYPE_CUSTOM,
    ];

    protected $fillable = [
        'name', 'description', 'type', 'amount', 'reference_id', 'weight', 'icon',
        'slice_color', 'text_color', 'sort', 'stock', 'daily_win_limit',
        'per_user_daily_limit', 'per_user_lifetime_limit', 'starts_at', 'ends_at',
        'is_active', 'total_won',
    ];

    // Admin değişiklik günlüğü (ekonomik değer -> izlenebilirlik). Yalnız anlamlı
    // alan değişiklikleri kaydedilir; salt sıralama (sort) sürükle-bırak spam'ı atlanır.
    protected static function booted(): void
    {
        static::created(function (self $r) {
            LuckyWheelAudit::log('created', 'reward:'.$r->id, ['name' => [null, $r->name], 'type' => [null, $r->type]]);
        });
        static::updated(function (self $r) {
            $changes = collect($r->getChanges())->except(['updated_at', 'total_won'])->all();
            if (empty($changes)) {
                return;
            }
            if (array_keys($changes) === ['sort']) {
                return; // sürükle-bırak sıralama -> günlüğe yazma
            }
            $diff = [];
            foreach ($changes as $k => $new) {
                $diff[$k] = [$r->getOriginal($k), $new];
            }
            $action = (array_keys($changes) === ['is_active']) ? 'toggled' : 'updated';
            LuckyWheelAudit::log($action, 'reward:'.$r->id, $diff);
        });
        static::deleted(function (self $r) {
            LuckyWheelAudit::log('deleted', 'reward:'.$r->id, ['name' => [$r->name, null]]);
        });
    }

    /** Aktif ödüllerin toplam ağırlığı (gerçek yüzde hesabı için, kısa cache). */
    public static function totalActiveWeight(): int
    {
        return (int) static::query()->where('is_active', true)->sum('weight');
    }

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'weight' => 'integer',
            'sort' => 'integer',
            'stock' => 'integer',
            'daily_win_limit' => 'integer',
            'per_user_daily_limit' => 'integer',
            'per_user_lifetime_limit' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
            'total_won' => 'integer',
        ];
    }

    /**
     * ÇARK HAVUZU: bu an çarkta görünmeye/kazanılmaya uygun ödüller.
     * - aktif (is_active)
     * - tarih aralığında (starts_at <= now <= ends_at; null = sınırsız)
     * - stokta (stock null = sınırsız; stock > 0 gerekli)
     * Ağırlık kontrolü (weight > 0) burada değil, seçimde yapılır (weight=0 dilim
     * gösterilir ama asla kazanılamaz -> weighted pool'a girmez).
     */
    public function scopeEligible(Builder $q): Builder
    {
        $now = now();
        return $q->where('is_active', true)
            ->where(function ($w) use ($now) {
                $w->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($w) use ($now) {
                $w->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->where(function ($w) {
                $w->whereNull('stock')->orWhere('stock', '>', 0);
            })
            ->orderBy('sort')
            ->orderBy('id');
    }

    public function isUnlimitedStock(): bool
    {
        return $this->stock === null;
    }

    /** Kazanıldığı anki değişmez kopya (spin geçmişi için). */
    public function snapshot(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'amount' => (int) $this->amount,
            'reference_id' => $this->reference_id,
            'icon' => $this->icon,
            'slice_color' => $this->slice_color,
            'text_color' => $this->text_color,
        ];
    }
}
