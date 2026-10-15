<?php

namespace App\Models;

use App\Support\MatBuilder;
use App\Support\StatsConfig;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchResult extends Model
{
    protected $fillable = [
        'user_id', 'won', 'opponent_rating', 'opponent_name', 'opponent_user_id', 'opponent_pr', 'room_code', 'rating_before', 'rating_after', 'delta', 'rated',
        'match_length', 'match_type', 'pr', 'coins_after', 'stake', 'score_self', 'score_opp', 'log',
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
        // SUNUCU-OTORİTER kaynak (match_moves) VARSA onu kullan (istemci log'una tercih). İstemci log'u
        // yalnız SON ÇARE (match_moves yok -> eski/edge). NOT: EU6CD PR bug'ı match_moves HAZIR iken bile
        // oluştu -> kök neden analysisLog DEĞİL, cubePr (küp kaybı hesabı). match_moves zaten tercih ediliyor.
        if (! empty($this->room_code) && \App\Models\MatchMove::existsForRoom($this->room_code)) {
            $srv = \App\Models\MatchMove::buildLog($this->room_code);
            if (! empty($srv)) {
                return $srv;
            }
        }
        $decoded = json_decode((string) $this->log, true);

        return is_array($decoded['log'] ?? null) ? $decoded['log'] : [];
    }

    /**
     * Bu satırın (oyuncunun) rengi — SUNUCU-OTORİTER: oda slotundan türetilir (p1_user_id=white,
     * p2_user_id=black; bkz RoomController winColor). İstemci log'unun 'hc'sine GÜVENİLMEZ (kullanıcı
     * direktifi: oyuncudan gelen bilgiyle hesaplama yapılmaz). Oda yoksa (eski kayıt) son çare client hc.
     */
    public function analysisHc(): ?string
    {
        if (! empty($this->room_code)) {
            $room = \App\Models\Room::where('code', $this->room_code)->first();
            if ($room) {
                if ((int) $this->user_id === (int) $room->p1_user_id) {
                    return 'white';
                }
                if ((int) $this->user_id === (int) $room->p2_user_id) {
                    return 'black';
                }
            }
        }
        // SON ÇARE (oda silinmiş eski maç): client log hc. Yeni maçlarda buraya DÜŞÜLMEZ (oda var).
        $decoded = json_decode((string) $this->log, true);
        $hc = is_array($decoded) ? ($decoded['hc'] ?? null) : null;

        return in_array($hc, ['white', 'black'], true) ? $hc : null;
    }

    public function matText(): string
    {
        $mine = json_decode((string) $this->log, true);
        // Renk (hc): client log'dan al; YOKSA (client log'suz sunucu-otoriter satır — reload/
        // disconnect) rakip satırdan türet. Eskiden burada `return ''` ile çıkılıyor, match_moves
        // dolu olsa bile .mat ÜRETİLMİYORDU -> "analiz yok". Artık log'suz satır da match_moves'tan kurulur.
        $myHc = is_array($mine) ? ($mine['hc'] ?? null) : null;
        if (! in_array($myHc, ['white', 'black'], true)) {
            $myHc = $this->analysisHc();
        }
        $myLog = is_array($mine) && is_array($mine['log'] ?? null) ? $mine['log'] : [];
        $matchLen = max(1, (int) ($this->match_length ?? 1));
        // Money oyunu (bahisli, 1-puanlık ama CANLI küp): .mat money-session ("0 point match")
        // kurulmalı -> gnubg küpü canlı + gammon sayar (aksi halde "1 point match" küpü ölü sanıp
        // ÇÖP PR üretir). Bkz MatSerializer isMoney.
        $isMoney = (int) ($this->match_length ?? 0) <= 1 && (int) ($this->stake ?? 0) > 0;

        $selfName = $this->user?->nickname ?: 'Oyuncu';
        $oppName = $this->opponent_name ?: 'Rakip';

        // SUNUCU-OTORİTER KAYNAK (yeni maçlar): match_moves varsa .mat ORADAN kurulur — istemci
        // loguna bağımlı DEĞİL. İstemci reload/disconnect'te log kaybı ("olmayan hamle"/yarım
        // oyun/sonuçsuz maç) KÖKTEN biter. Eski maçlar (kayıt yok) aşağıdaki client-log yoluna düşer.
        if (! empty($this->room_code) && \App\Models\MatchMove::existsForRoom($this->room_code)) {
            [$whiteName, $blackName] = $myHc === 'black' ? [$oppName, $selfName] : [$selfName, $oppName];
            $mat = \App\Models\MatchMove::buildMat($this->room_code, [
                'matchLength' => $matchLen, 'whiteName' => $whiteName, 'blackName' => $blackName,
                'isMoney' => $isMoney,
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
                    return MatBuilder::build($merged, $matchLen, $whiteName, $blackName, $isMoney);
                }
            }
        }

        // Tek log (rakip yok / pvb / yerel): kendi logundan üret. Renk bilinmiyorsa self=white.
        if (count($myLog) < 1) {
            return '';
        }
        [$whiteName, $blackName] = $myHc === 'black' ? [$oppName, $selfName] : [$selfName, $oppName];

        return MatBuilder::build($myLog, $matchLen, $whiteName, $blackName, $isMoney);
    }

    /**
     * Admin detay: OKUNUR hamle/zar kaydı (oyun -> sıralı hamle/küp/sonuç; her hamlede zar).
     * Otoriter kaynak match_moves; yoksa istemci logundan (notation + pos.dice) kurulur.
     * .mat zaten zarı taşır ama ham/XG; bu okunur Türkçe liste admin için.
     *
     * @return list<array<string,mixed>>
     */
    public function moveDiceLog(): array
    {
        $mine = json_decode((string) $this->log, true);
        $myHc = is_array($mine) ? ($mine['hc'] ?? null) : null;
        if (! in_array($myHc, ['white', 'black'], true)) {
            $myHc = $this->analysisHc();
        }
        $selfName = $this->user?->nickname ?: 'Oyuncu';
        $oppName = $this->opponent_name ?: 'Rakip';
        [$whiteName, $blackName] = $myHc === 'black' ? [$oppName, $selfName] : [$selfName, $oppName];
        $nameOf = fn (?string $c) => $c === 'black' ? $blackName : $whiteName;
        $fmtDice = function ($d): string {
            $d = is_array($d) ? array_values($d) : [];

            return count($d) >= 2 ? ((int) $d[0]).'-'.((int) $d[1]) : (count($d) === 1 ? (string) (int) $d[0] : '');
        };
        $cubeLabel = ['double' => 'Küp çekti (×2)', 'take' => 'Küpü kabul etti', 'drop' => 'Pas (çekilmedi)'];

        $out = [];

        // Otoriter kaynak: match_moves (iki oyuncu, sıralı, zarlı).
        if (! empty($this->room_code) && \App\Models\MatchMove::existsForRoom($this->room_code)) {
            $lastGame = null;
            $num = 0;
            foreach (\App\Models\MatchMove::orderedRows($this->room_code) as $r) {
                $g = (int) $r->game_no;
                if ($g !== $lastGame) {
                    $out[] = ['kind' => 'game', 'no' => $g + 1];
                    $lastGame = $g;
                    $num = 0;
                }
                if ($r->kind === 'move') {
                    $notation = trim((string) ($r->notation ?? ''));
                    $out[] = [
                        'kind' => 'move', 'no' => ++$num, 'player' => $r->player, 'name' => $nameOf($r->player),
                        'dice' => $fmtDice($r->dice), 'notation' => $notation !== '' ? $notation : 'Hamle yok',
                        'noMove' => $notation === '',
                    ];
                } elseif (in_array($r->kind, ['double', 'take', 'drop'], true)) {
                    $out[] = ['kind' => 'cube', 'player' => $r->player, 'name' => $nameOf($r->player), 'action' => $cubeLabel[$r->kind] ?? $r->kind];
                } elseif ($r->kind === 'end' && $r->winner) {
                    $out[] = ['kind' => 'end', 'name' => $nameOf($r->winner), 'points' => (int) $r->points];
                }
            }

            return $out;
        }

        // Fallback (eski maç, match_moves yok): istemci logu — her iki rengi taşır, zar pos.dice'te.
        $log = is_array($mine) && is_array($mine['log'] ?? null) ? $mine['log'] : [];
        $num = 0;
        foreach ($log as $e) {
            $player = $e['player'] ?? null;
            if (! in_array($player, ['white', 'black'], true)) {
                continue;
            }
            if (! empty($e['cube'])) {
                $chosen = $e['cube']['chosen'] ?? ($e['cube']['action'] ?? null);
                if ($chosen) {
                    $out[] = ['kind' => 'cube', 'player' => $player, 'name' => $nameOf($player), 'action' => $cubeLabel[$chosen] ?? $chosen];
                }

                continue;
            }
            $notation = trim((string) ($e['notation'] ?? ''));
            $out[] = [
                'kind' => 'move', 'no' => ++$num, 'player' => $player, 'name' => $nameOf($player),
                'dice' => $fmtDice($e['pos']['dice'] ?? ($e['dice'] ?? [])),
                'notation' => $notation !== '' ? $notation : 'Hamle yok', 'noMove' => $notation === '',
            ];
        }

        return $out;
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

    /**
     * HAKEM=gnubg: bu maçın hamle-hamle review'i (MatchReport/MatchSummary'nin yediği LogEntry[]).
     * .mat'i matText() (match_moves VEYA client log) ile kurar, GnuBgClient ile per-karar
     * loss/best/equity çıkarır. plies=2 sonucu DB kolonunda (gnubg_review) önbelleklenir -> ilk
     * hesap ağır (~saniyeler), sonrakiler anında. matchGnubgReview (sahip) + roomSummary (izleyici)
     * ORTAK bu kaynağı kullanır. Dönen: {ok, matchLength, names, decisions, log, luck?} veya {ok:false,error}.
     *
     * @return array<string,mixed>
     */
    public function gnubgReview(int $plies = 2): array
    {
        $plies = max(0, min(3, $plies));
        $useCache = $plies === 2 && \Illuminate\Support\Facades\Schema::hasColumn('match_results', 'gnubg_review');
        if ($useCache && ! empty($this->gnubg_review)) {
            $cached = json_decode((string) $this->gnubg_review, true);
            if (is_array($cached) && ! empty($cached['ok'])) {
                return $cached;
            }
        }
        try {
            $mat = $this->matText();
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'mat-build', 'message' => $e->getMessage()];
        }
        if (trim((string) $mat) === '') {
            return ['ok' => false, 'error' => 'empty-mat'];
        }
        $res = app(\App\Services\GnuBg\GnuBgClient::class)->reviewMatch($mat, $plies);
        if (! is_array($res) || empty($res['ok'])) {
            return [
                'ok' => false, 'error' => 'review-failed',
                'detail' => is_array($res) ? ($res['error'] ?? $res['exception'] ?? null) : null,
            ];
        }
        if ($useCache) {
            static::where('id', $this->id)->update([
                'gnubg_review' => json_encode($res),
                'gnubg_review_at' => now(),
            ]);
        }

        return $res;
    }
}
