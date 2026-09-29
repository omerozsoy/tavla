<?php

namespace App\Models;

use App\Support\MatBuilder;
use App\Support\StatsConfig;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchResult extends Model
{
    protected $fillable = [
        'user_id', 'won', 'opponent_rating', 'opponent_name', 'opponent_user_id', 'opponent_pr', 'opponent_luck', 'room_code', 'rating_before', 'rating_after', 'delta', 'rated',
        'match_length', 'match_type', 'pr', 'coins_after', 'luck', 'score_self', 'score_opp', 'log',
        'analyzed_at', 'analysis_version',
        // XG-style havuzlama totalleri (§13): dogru lifetime PR icin ham toplamlar.
        'pr_equity_lost', 'pr_decisions',
    ];

    protected $casts = [
        'won' => 'boolean',
        'rated' => 'boolean', // bu satır rating/PR kazandırdı mı (friendly 24h limiti için sayım anahtarı)
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
    /**
     * KANONİK analiz logu (PR/Hata Günlüğü/analiz) — SUNUCU-OTORİTER kaynak. match_moves varsa
     * ORADAN (istemci logu YOK); yoksa eski maçlar için client match_results.log'a düşer.
     * PR job + ErrorJournalService AYNI bu kaynağı kullanır -> logIndex hizası korunur.
     *
     * @return list<array<string,mixed>>
     */
    public function analysisLog(): array
    {
        if (! empty($this->room_code) && \App\Models\MatchMove::existsForRoom($this->room_code)) {
            $srv = \App\Models\MatchMove::buildLog($this->room_code);
            if (! empty($srv)) {
                return $srv;
            }
        }
        $decoded = json_decode((string) $this->log, true);

        return is_array($decoded['log'] ?? null) ? $decoded['log'] : [];
    }

    /** İzleyenin (bu satırın) rengi — client log'un hc'sinden (renk sınıflandırması için). */
    public function analysisHc(): ?string
    {
        $decoded = json_decode((string) $this->log, true);
        $hc = is_array($decoded) ? ($decoded['hc'] ?? null) : null;
        if (in_array($hc, ['white', 'black'], true)) {
            return $hc;
        }
        // Client log YOK (ForfeitLoss / MatchBackstop yedek satırı): rengi RAKİP satırının
        // hc'sinden türet (zıt renk). Böylece log'suz satır da SUNUCU hamleleriyle (match_moves)
        // DOĞRU renkte analiz edilir; yoksa çağıran 'white'a düşüp rakibin PR'ını alırdı.
        if (! empty($this->room_code)) {
            $opp = static::where('room_code', $this->room_code)
                ->where('user_id', '!=', $this->user_id)
                ->latest('id')->first();
            $oppDecoded = $opp ? json_decode((string) $opp->log, true) : null;
            $oppHc = is_array($oppDecoded) ? ($oppDecoded['hc'] ?? null) : null;
            if ($oppHc === 'white') {
                return 'black';
            }
            if ($oppHc === 'black') {
                return 'white';
            }
        }

        return null;
    }

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

        // SUNUCU-OTORİTER KAYNAK (yeni maçlar): match_moves varsa .mat ORADAN kurulur — istemci
        // loguna bağımlı DEĞİL. İstemci reload/disconnect'te log kaybı ("olmayan hamle"/yarım
        // oyun/sonuçsuz maç) KÖKTEN biter. Eski maçlar (kayıt yok) aşağıdaki client-log yoluna düşer.
        if (! empty($this->room_code) && \App\Models\MatchMove::existsForRoom($this->room_code)) {
            [$whiteName, $blackName] = $myHc === 'black' ? [$oppName, $selfName] : [$selfName, $oppName];
            $mat = \App\Models\MatchMove::buildMat($this->room_code, [
                'matchLength' => $matchLen, 'whiteName' => $whiteName, 'blackName' => $blackName,
            ]);
            if (trim($mat) !== '') {
                return $mat;
            }
        }

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

    /** İndirme dosya adı: <oyuncu1>_<oyuncu2>_<GG-AA-YYYY>_<oyunid>.mat (nokta yok; ext hariç). */
    public function matFilename(): string
    {
        $clean = static function (?string $s, string $fb): string {
            $s = str_replace(' ', '', (string) ($s ?? ''));
            $s = preg_replace('/[^\p{L}\p{N}_-]/u', '', $s) ?? '';

            return $s !== '' ? $s : $fb;
        };
        $mine = json_decode((string) $this->log, true);
        $myHc = is_array($mine) ? ($mine['hc'] ?? null) : null;
        $self = $clean($this->user?->nickname, 'Oyuncu');
        $opp = $clean($this->opponent_name, 'Rakip');
        // p1=beyaz, p2=siyah sirasi (GameLog ile ayni mantik).
        [$p1, $p2] = $myHc === 'black' ? [$opp, $self] : [$self, $opp];
        $date = optional($this->created_at)->format('d-m-Y');
        $id = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($this->room_code ?: ('mac-'.$this->id))) ?: 'mac';
        $parts = array_filter([$p1, $p2, $date, $id]);

        return implode('_', $parts).'.mat';
    }
}
