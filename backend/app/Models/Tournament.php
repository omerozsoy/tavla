<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tournament extends Model
{
    protected $fillable = [
        'name', 'venue', 'organizer_id', 'size', 'status', 'register_until', 'creator_id', 'players', 'bracket', 'champion_id',
        'prize_coins', 'prize_desc', 'prize_paid', 'entry_fee', 'prizes',
    ];

    protected $casts = [
        'players' => 'array',
        'bracket' => 'array',
        'prizes' => 'array',
        'register_until' => 'datetime',
    ];

    // Turnuvayi olusturan kullanici (admin panelde isimle secilir/gosterilir)
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    // Sampiyon kullanici
    public function champion(): BelongsTo
    {
        return $this->belongsTo(User::class, 'champion_id');
    }

    // Turnuvayi duzenleyen kurum (contents type='kurum')
    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Content::class, 'organizer_id');
    }

    // Rating'e gore seed'leyip 1. tur eslesmelerini uret (bye'lar otomatik ilerler).
    // Hem API (elle/otomatik baslat) hem admin panel bu tek kaynagi kullanir.
    public function startBracket(): void
    {
        $players = $this->players ?? [];
        usort($players, fn ($a, $b) => ($b['rating'] ?? 0) <=> ($a['rating'] ?? 0));
        $size = (int) $this->size;
        // Sinirsiz (0): oyuncu sayisina gore bir sonraki 2'nin kuvvetine yuvarla
        if ($size < 4) {
            $n = max(2, count($players));
            $size = 1;
            while ($size < $n) {
                $size *= 2;
            }
        }
        while (count($players) < $size) {
            $players[] = null; // bye
        }
        // Standart seed sirasi (1 vs son, 2 vs sondan bir onceki ...)
        $round0 = [];
        for ($i = 0; $i < $size / 2; $i++) {
            $p1 = $players[$i];
            $p2 = $players[$size - 1 - $i];
            $m = ['key' => "r0m$i", 'p1' => $p1, 'p2' => $p2, 'winner' => null];
            // Bye: rakip yoksa otomatik kazanir
            if ($p1 && ! $p2) {
                $m['winner'] = $p1['id'];
            } elseif ($p2 && ! $p1) {
                $m['winner'] = $p2['id'];
            }
            $round0[] = $m;
        }
        // Bos turlari olustur
        $bracket = [$round0];
        $count = $size / 2;
        $r = 1;
        while ($count > 1) {
            $count = intdiv($count, 2);
            $round = [];
            for ($i = 0; $i < $count; $i++) {
                $round[] = ['key' => "r{$r}m$i", 'p1' => null, 'p2' => null, 'winner' => null];
            }
            $bracket[] = $round;
            $r++;
        }
        // Round0 bye kazananlarini round1'e tasi
        foreach ($round0 as $mi => $m) {
            if (! empty($m['winner']) && isset($bracket[1])) {
                $w = $m['p1'] && $m['p1']['id'] === $m['winner'] ? $m['p1'] : $m['p2'];
                $slot = $mi % 2 === 0 ? 'p1' : 'p2';
                $bracket[1][intdiv($mi, 2)][$slot] = $w;
            }
        }
        $this->bracket = $bracket;
        $this->status = 'running';
        $this->players = $players;
        $this->save();
    }
}
