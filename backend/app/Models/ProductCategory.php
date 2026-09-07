<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Panelden yonetilen urun kategorisi. slug = URL/anahtar; sort = mağaza/menu sirasi.
class ProductCategory extends Model
{
    protected $fillable = ['name', 'slug', 'sort', 'published'];

    protected $casts = [
        'published' => 'boolean',
        'sort'      => 'integer',
    ];

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }
}
