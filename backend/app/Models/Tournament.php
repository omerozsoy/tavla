<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tournament extends Model
{
    protected $fillable = [
        'name', 'venue', 'organizer_id', 'size', 'status', 'active', 'register_until', 'creator_id', 'players', 'bracket', 'champion_id',
        'prize_coins', 'prize_desc', 'prize_paid', 'entry_fee', 'prizes',
        'premium_only', // true: yalniz Premium katilir; false: tum uyeler (misafir hicbir zaman)
        'match_length', 'semi_length', 'final_length', // mac uzunluklari (puan); bkz roundTarget()
        'round_minutes', 'semi_minutes', 'final_minutes', // mac sureleri (dk, oyuncu basina); bkz roundMinutes()
    ];

    protected $casts = [
        'players' => 'array',
        'bracket' => 'array',
        'prizes' => 'array',
        'active' => 'boolean',
        'premium_only' => 'boolean',
        'register_until' => 'datetime',
        'match_length' => 'integer',
        'semi_length' => 'integer',
        'final_length' => 'integer',
        'round_minutes' => 'integer',
        'semi_minutes' => 'integer',
        'final_minutes' => 'integer',
    ];

    /**
     * $ri. turdaki maclarin suresi (dk, oyuncu basina ana sure). Yari final / final bos ->
     * normal tur suresi; o da bos -> null (saat modunun varsayilani).
     */
    public function roundMinutes(int $ri, int $rounds): ?int
    {
        $base = $this->round_minutes ? (int) $this->round_minutes : null;
        $pick = $base;
        if ($ri === $rounds - 1 && $this->final_minutes) {
            $pick = (int) $this->final_minutes;
        } elseif ($ri === $rounds - 2 && $this->semi_minutes) {
            $pick = (int) $this->semi_minutes;
        }

        return $pick && $pick > 0 ? $pick : null;
    }

    /** Secilebilir mac uzunluklari (puan). 1 = tek oyun. */
    public const LENGTHS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25];

    /**
     * Bracket'in $ri. turundaki maclarin uzunlugu (puan). Son tur = final, sondan bir onceki =
     * yari final. Ozel uzunluk secilmediyse (NULL) normal tur uzunlugu (match_length) kullanilir.
     * Yalniz 2 kisilik bracket'ta tek tur hem ilk tur hem final -> final uzunlugu gecerli.
     */
    public function roundTarget(int $ri, int $rounds): int
    {
        $base = max(1, (int) ($this->match_length ?: 1));
        if ($ri === $rounds - 1) {
            return max(1, (int) ($this->final_length ?: $base));
        }
        if ($ri === $rounds - 2) {
            return max(1, (int) ($this->semi_length ?: $base));
        }

        return $base;
    }

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

    // KURA: oyuncular rastgele cekilip 1. tur eslesmeleri uretilir (bye'lar otomatik ilerler).
    // Eskiden rating'e gore seed'leniyordu (1 vs son); kullanici istegi: turnuva basinda kura.
    // Hem API (elle/otomatik baslat) hem admin panel bu tek kaynagi kullanir.
    public function startBracket(): void
    {
        $players = $this->players ?? [];
        $players = array_values(array_filter($players)); // onceki bye (null) kalintilarini at
        shuffle($players); // kura
        // Agac KAYITLI OYUNCU sayisina gore kurulur (bir sonraki 2'nin kuvveti), turnuva kapasitesine
        // (size) gore DEGIL: 16'lik turnuvada 6 oyuncu -> 8'lik agac, 2 bye. Eskiden kapasiteye gore
        // kuruluyordu -> ilk turda "— vs —" maclari, kazanani hic cikmayan olu dallar, turnuva takiliyordu.
        $n = max(2, count($players));
        $size = 1;
        while ($size < $n) {
            $size *= 2;
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
