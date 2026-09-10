<?php

namespace App\Models;

use App\Support\MatBuilder;
use App\Support\StatsConfig;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchResult extends Model
{
    protected $fillable = [
        'user_id', 'won', 'opponent_rating', 'opponent_name', 'opponent_pr', 'room_code', 'rating_before', 'rating_after', 'delta',
        'match_length', 'match_type', 'pr', 'coins_after', 'luck', 'score_self', 'score_opp', 'log',
        'analyzed_at', 'analysis_version',
        // XG-style havuzlama totalleri (§13): dogru lifetime PR icin ham toplamlar.
        'pr_equity_lost', 'pr_decisions',
    ];

    protected $casts = [
        'won' => 'boolean',
        'analyzed_at' => 'datetime',
        'pr_equity_lost' => 'float',
        'pr_decisions' => 'integer',
    ];

    // GERCEK (puanli) maclar: yapay zeka (match_type='ai') HARIC. rating/WXP/median/basarim
    // istatistikleri yalniz bunlardan hesaplanir. NULL match_type = eski gercek maclar -> DAHIL.
    public function scopeReal($q)
    {
        return $q->where(function ($w) {
            $w->whereNull('match_type')->orWhere('match_type', '!=', StatsConfig::MATCH_TYPE_AI);
        });
    }

    // Bu sonucun sahibi oyuncu (yonetim panelinde "Oyuncu" kolonu icin sart).
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // Online macin odasi: bahis (coin) tutari + mod (friendly/matchmake) buradan okunur.
    // room_code -> rooms.code. Oda temizlenmisse null (bahis "—" gorunur).
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_code', 'code');
    }

    /**
     * Bu maçın XG (Extreme Gammon) uyumlu .mat metni. Kaynak = match_results.log
     * (istemcinin kendi kaydı: {hc: 'white'|'black', log: MoveLogEntry[]}).
     *
     * Online'da (room_code) her istemci KENDİ kısmi logunu tutar; TAM .mat için rakip
     * satırını bulup iki logu BİRLEŞTİRİR (AnalyzeMatchLuckJob ile aynı yol: her renk kendi
     * logunda tamdır). Rakip henüz raporlamadıysa / pvb-yerel'de tek logdan üretir.
     * Üretilecek hamle yoksa boş döner (UI "hamle yok" gösterir).
     */
    public function matText(): string
    {
        $mine = json_decode((string) $this->log, true);
        if (! is_array($mine)) {
            return '';
        }
        $myHc = $mine['hc'] ?? null;
        $myLog = is_array($mine['log'] ?? null) ? $mine['log'] : [];
        $matchLen = max(1, (int) ($this->match_length ?? 1));

        $selfName = $this->user?->nickname ?: 'Oyuncu';
        $oppName = $this->opponent_name ?: 'Rakip';

        // Online: rakip satırını birleştir -> TAM .mat (her renk kendi logunda tam).
        if (! empty($this->room_code) && in_array($myHc, ['white', 'black'], true)) {
            $oppRow = static::where('room_code', $this->room_code)
                ->where('user_id', '!=', $this->user_id)->latest('id')->first();
            $theirs = $oppRow ? json_decode((string) $oppRow->log, true) : null;
            $theirHc = is_array($theirs) ? ($theirs['hc'] ?? null) : null;
            if (is_array($theirs) && in_array($theirHc, ['white', 'black'], true) && $theirHc !== $myHc) {
                $theirLog = is_array($theirs['log'] ?? null) ? $theirs['log'] : [];
                [$whiteLog, $blackLog] = $myHc === 'white' ? [$myLog, $theirLog] : [$theirLog, $myLog];
                [$whiteName, $blackName] = $myHc === 'white'
                    ? [$selfName, $oppName] : [$oppName, $selfName];
                $merged = MatBuilder::mergeLogs($whiteLog, $blackLog);
                if (count($merged) >= 2) {
                    return MatBuilder::build($merged, $matchLen, $whiteName, $blackName);
                }
            }
        }

        // Tek log (rakip yok / pvb / yerel): kendi logundan üret. Renk bilinmiyorsa self=white.
        if (count($myLog) < 1) {
            return '';
        }
        [$whiteName, $blackName] = $myHc === 'black' ? [$oppName, $selfName] : [$selfName, $oppName];

        return MatBuilder::build($myLog, $matchLen, $whiteName, $blackName);
    }

    /** İndirme için güvenli dosya adı: tavlatv-<oda|mac-id>.mat */
    public function matFilename(): string
    {
        $base = $this->room_code ?: ('mac-'.$this->id);
        $safe = preg_replace('/[^A-Za-z0-9_-]/', '', (string) $base) ?: 'mac';

        return "tavlatv-{$safe}.mat";
    }
}
