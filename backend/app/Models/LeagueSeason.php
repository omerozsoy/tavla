<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Türkiye Online Tavla Ligi sezonu. Bağımsız modül — Tournament ile ilişkisi YOK.
 *
 * Durum makinesi (§2, §11): draft -> applications -> selection -> league -> knockout -> finished.
 * active_lock: aktif sezonda 1, değilse null (UNIQUE kolon -> ikinci aktif sezon DB düzeyinde engellenir).
 */
class LeagueSeason extends Model
{
    public const MIN_PLAYERS = 33;   // §2 en az 33 seçilmiş oyuncuyla başlayabilir

    public const MAX_PLAYERS = 48;   // §2 hedef ve üst sınır 48 seçilmiş oyuncu

    public const LEAGUE_ROUNDS = 8;  // §3 lig aşaması 8 tur

    /** §2 "aktif" sayılan (aynı anda yalnız bir tane olabilen) durumlar. */
    public const ACTIVE_STATES = ['applications', 'selection', 'league', 'knockout'];

    /**
     * §16 Kurallar sekmesi — TEK global metin (tüm sezonlara uygulanır). Admin panelden
     * (Setting 'league_rules') düzenlenebilir; kayıt yoksa bu varsayılan gösterilir. Frontend
     * i18n 'league.rulesText' yalnız ağ/boş hâli için son-çare fallback. "## " = başlık.
     */
    public const DEFAULT_RULES = <<<'TR'
## Katılım
Lig Premium üyelere özeldir. Başvurular açıkken başvurursun; asıl ve yedek oyuncuları TavlaTV Yönetimi seçer. Bir sezon 48 oyuncuyla başlar ve aynı anda yalnız bir aktif sezon olur.
## Lig Aşaması (8 Tur)
Swiss usulü 8 tur oynanır. Her turda benzer puanlı oyuncular eşleşir; aynı iki oyuncu lig aşamasında tekrar eşleşmez. Oyuncu sayısı tek kalırsa bir oyuncu "bay" geçer (otomatik 1 puan).
## Puanlama ve Sıralama
Galibiyet, hükmen galibiyet ve bay 1 puan; mağlubiyet, hükmen mağlubiyet ve çift gelmeme 0 puandır. Eşitlikte sıralama: 1) lig puanı, 2) karşılaşılan rakiplerin toplam puanı, 3) yenilen rakiplerin toplam puanı, 4) güncel rating, 5) admin sırası.
## Eleme
İlk 8 doğrudan Son 16'ya gider; 9–24 arası ön eleme oynar; 25 ve sonrası elenir. Son 16 → Çeyrek Final → Yarı Final → Final şeklinde ilerler. Tüm eleme maçları (final dahil) tek maçtır; kaybeden elenir, üçüncülük maçı yoktur.
## Maç Saati ve Hazır Olma
Maç saatini rakibinle teklif edip onaylayarak belirlersin; saat turun son oynanma zamanını aşamaz. Geçerli saatten 15 dakika sonra: iki oyuncu da hazırsa maç otomatik başlar, yalnız biri hazırsa diğeri hükmen kaybeder, ikisi de gelmezse çift gelmeme sayılır. Finalde iki taraf da gelmezse otomatik şampiyon ilan edilmez; admin yeni tarih belirler.
## Çekilme
Çekilen oyuncunun topladığı puanlar silinmez; o anki açık maçını rakibi hükmen kazanır. Çekilenin yerine yedek alınmaz.
## Rating ve Ödüller
Yalnızca gerçekten oynanan maçlar TavlaTV rating'ini etkiler; hükmen ve bay rating'i değiştirmez. Maçlar varsayılan 9 sayıdır. Şampiyon, finalist, yarı finalist, çeyrek finalist ve Son 16 oyuncuları açıklanacak ödülleri, coin ve rozet ödülü kazanır.
TR;

    protected $fillable = [
        'name', 'status', 'active_lock', 'applications_open_at', 'applications_close_at',
        'league_match_length', 'knockout_match_length', 'current_round', 'rounds_total',
        'standings_final', 'bracket', 'tiebreak_manual', 'prizes', 'prizes_paid', 'config',
    ];

    protected $casts = [
        'applications_open_at' => 'datetime',
        'applications_close_at' => 'datetime',
        'league_match_length' => 'integer',
        'knockout_match_length' => 'integer',
        'current_round' => 'integer',
        'rounds_total' => 'integer',
        'standings_final' => 'array',
        'bracket' => 'array',
        'tiebreak_manual' => 'array',
        'prizes' => 'array',
        'prizes_paid' => 'boolean',
        'config' => 'array',
    ];

    public function participants(): HasMany
    {
        return $this->hasMany(LeagueParticipant::class, 'season_id');
    }

    public function matches(): HasMany
    {
        return $this->hasMany(LeagueMatch::class, 'season_id');
    }

    public function awards(): HasMany
    {
        return $this->hasMany(LeagueAward::class, 'season_id');
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATES, true);
    }
}
