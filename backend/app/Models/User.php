<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Models\Contracts\HasName;
use Filament\Panel;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail, FilamentUser, HasName
{
    // Filament yonetim paneline yalnizca admin (ve yasakli olmayan) erisebilir.
    public function canAccessPanel(Panel $panel): bool
    {
        return $this->is_admin && ! $this->isBanned();
    }

    // Filament ust menude gosterilen ad. Modelde 'name' yok -> nickname/ad kullan.
    public function getFilamentName(): string
    {
        return (string) ($this->nickname
            ?: trim(($this->first_name ?? '').' '.($this->last_name ?? ''))
            ?: $this->email
            ?: 'Admin');
    }

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
        'province',
        'avatar',
        'birth_date',
        'nickname',
        'email',
        'password',
        'game_state',
        // NOT: 'email_verified_at' bilincli olarak fillable DEGIL — kotu niyetli
        // mass-assignment ile e-posta dogrulamasi atlanamasin. Dogrulama yalnizca
        // markEmailAsVerified() / imzali dogrulama akisi ile yapilir.
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

    // is_admin (email tabanli) + plan_active (suresi gecerli plan) JSON'a eklenir
    protected $appends = ['is_admin', 'plan_active'];

    // Suresi gecerli aktif plan: 'free' | 'star' | 'starpro'
    public function getPlanActiveAttribute(): string
    {
        $plan = $this->attributes['plan'] ?? 'free';
        if ($plan === 'free') {
            return 'free';
        }
        $until = $this->plan_until ? \Illuminate\Support\Carbon::parse($this->plan_until) : null;
        if (! $until || $until->isPast()) {
            return 'free';
        }
        return $plan;
    }

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
            'featured_badges' => 'array',
            'plan_until' => 'datetime',
            'plan_since' => 'datetime',
            'trial_used' => 'boolean',
            'auto_renew' => 'boolean',
            'birth_date' => 'date:Y-m-d',
            'banned_at' => 'datetime',
            'last_login_at' => 'datetime',
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

    // ---- Basarim (achievement) sistemi iliskileri ----

    public function stat(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(UserStat::class);
    }

    public function achievements(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(UserAchievement::class);
    }
}
