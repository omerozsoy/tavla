<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Fiziksel magaza urunu. Odeme tipi urun bazinda (coin/money/both), renk = gorsel varyant.
class Product extends Model
{
    protected $fillable = [
        'name', 'slug', 'category_id', 'description', 'images', 'colors',
        'payment_type', 'coin_price', 'money_price', 'stock', 'published', 'sort',
    ];

    protected $casts = [
        'images'      => 'array',
        'colors'      => 'array',
        'published'   => 'boolean',
        'coin_price'  => 'integer',
        'money_price' => 'integer',
        'stock'       => 'integer',
    ];

    public const PAYMENT_TYPES = ['coin', 'money', 'both'];

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function orders()
    {
        return $this->hasMany(ProductOrder::class);
    }

    public function acceptsCoin(): bool
    {
        return in_array($this->payment_type, ['coin', 'both'], true) && (int) $this->coin_price > 0;
    }

    public function acceptsMoney(): bool
    {
        return in_array($this->payment_type, ['money', 'both'], true) && (int) $this->money_price > 0;
    }

    // Frontend katalog gorunumu (public). Sadece yayindaki alanlar.
    public function toCatalog(): array
    {
        return [
            'id'            => $this->id,
            'slug'          => $this->slug,
            'name'          => $this->name,
            'category'      => $this->category?->slug,       // gruplama anahtari
            'category_name' => $this->category?->name,       // gosterim adi (panelden)
            'description'   => $this->description,
            'images'       => array_values($this->images ?? []),
            'colors'       => array_values($this->colors ?? []),
            'payment_type' => $this->payment_type,
            'coin_price'   => $this->acceptsCoin() ? (int) $this->coin_price : null,
            'money_price'  => $this->acceptsMoney() ? (int) $this->money_price : null,
            'stock'        => (int) $this->stock,
        ];
    }
}
