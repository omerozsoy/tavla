<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'country',
        'avatar',
        'birth_date',
        'nickname',
        'email',
        'password',
        'game_state',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    // is_admin'i JSON'a ekle (email tabanli hesaplanir)
    protected $appends = ['is_admin'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'game_state' => 'array',
            'unlocks' => 'array',
            'badges' => 'array',
            'birth_date' => 'date:Y-m-d',
            'banned_at' => 'datetime',
        ];
    }

    // Yonetici mi? DB bayragi VEYA config'deki admin e-posta listesi.
    // (Config e-postalari her zaman admin kalir -> sahip kendini kilitleyemez.)
    public function getIsAdminAttribute(): bool
    {
        if (! empty($this->attributes['is_admin'])) {
            return true;
        }
        $admins = array_map('strtolower', config('services.admin_emails', []));
        return in_array(strtolower((string) $this->email), $admins, true);
    }

    // Config e-postasiyla admin mi? (DB bayragi degistirilemez olanlar)
    public function isConfigAdmin(): bool
    {
        $admins = array_map('strtolower', config('services.admin_emails', []));
        return in_array(strtolower((string) $this->email), $admins, true);
    }

    public function isBanned(): bool
    {
        return $this->banned_at !== null;
    }
}
