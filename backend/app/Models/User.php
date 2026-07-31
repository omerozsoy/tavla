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
            'birth_date' => 'date:Y-m-d',
        ];
    }

    // Yonetici mi? (config'deki admin e-posta listesine gore)
    public function getIsAdminAttribute(): bool
    {
        $admins = array_map('strtolower', config('services.admin_emails', []));
        return in_array(strtolower((string) $this->email), $admins, true);
    }
}
