<?php

namespace App\Filament\Pages;

use App\Models\DiceSlotJackpot;
use App\Models\DiceSlotSpin;
use App\Support\DiceSlotSettings as DSS;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Zar Slotu — Genel Ayarlar. Değerler Setting deposunda ('ds_*') tutulur (cache'li);
 * kayıt yoksa config/dice-slot.php varsayılanına düşer. (Şans Çarkı Ayarları kardeşi.)
 */
class DiceSlotSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-squares-2x2';

    protected static ?string $navigationLabel = 'Zar Slotu Ayarları';

    protected static ?string $title = 'Zar Slotu — Ayarlar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 7;

    protected static string $view = 'filament.pages.dice-slot-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill(DSS::all());
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Genel')
                    ->schema([
                        Toggle::make('enabled')->label('Slot açık')->helperText('Kapalıyken kullanıcılar çeviremez.'),
                        Toggle::make('require_login')->label('Giriş zorunlu'),
                        TextInput::make('free_spins_per_day')->label('Günlük ücretsiz hak')
                            ->numeric()->required()->minValue(0),
                        TextInput::make('spin_cost')->label('Coin ile çevirme bedeli')
                            ->numeric()->required()->minValue(0)->suffix('coin')
                            ->helperText('Ücretsiz hak bitince kullanıcı bu kadar coin ödeyerek çevirir. 0 = ödemeli çevirme kapalı.'),
                        TextInput::make('cooldown_minutes')->label('Ardışık bekleme (dk)')
                            ->numeric()->required()->minValue(0)
                            ->helperText('0 = ardışık çevirmede bekleme yok.'),
                    ])->columns(2),
                Section::make('Sonuç Olasılıkları (ağırlık)')
                    ->description('GERÇEK SLOT MANTIĞI: sunucu önce sonucu bu ağırlıklarla seçer, sonra makarayı ona göre gösterir. Her kombinasyonun olasılığı BAĞIMSIZ → P = ağırlık / (tüm ağırlıklar toplamı). Kent (sıralama) artık kendi ağırlığına sahip (jackpot gibi). Kural: YÜKSEK ödüle DÜŞÜK ağırlık. "Kayıp" ağırlığı baskın olmalı (çoğu spin kazanmaz). Sağdaki panelde her sonucun gerçek olasılığını + toplam RTP\'yi gör.')
                    ->schema([
                        TextInput::make('lose_weight')->label('Kayıp (kazanmayan)')
                            ->numeric()->required()->minValue(0)
                            ->helperText('Baskın olmalı; RTP\'yi bu belirler.'),
                        TextInput::make('straight_weight')->label('Kent / Sıralama ağırlığı')
                            ->numeric()->required()->minValue(0)
                            ->helperText('Bağımsız — nadir tutun (ödülü yüksek).'),
                        TextInput::make('jackpot_weight')->label('Jackpot (64-64-64) ağırlığı')
                            ->numeric()->required()->minValue(0)
                            ->helperText('Çok nadir olmalı.'),
                        TextInput::make('triple_weight_1')->label('1-1-1 ağırlığı')->numeric()->required()->minValue(0),
                        TextInput::make('triple_weight_2')->label('2-2-2 ağırlığı')->numeric()->required()->minValue(0),
                        TextInput::make('triple_weight_3')->label('3-3-3 ağırlığı')->numeric()->required()->minValue(0),
                        TextInput::make('triple_weight_4')->label('4-4-4 ağırlığı')->numeric()->required()->minValue(0),
                        TextInput::make('triple_weight_5')->label('5-5-5 ağırlığı')->numeric()->required()->minValue(0),
                        TextInput::make('triple_weight_6')->label('6-6-6 ağırlığı')->numeric()->required()->minValue(0),
                    ])->columns(3),
                Section::make('Üçlü Zar Ödülleri (coin)')
                    ->description('Aynı üç zar geldiğinde verilen coin. Küçükten büyüğe artmalı (klasik slot).')
                    ->schema([
                        TextInput::make('payout_1')->label('1 – 1 – 1')->numeric()->required()->minValue(0)->suffix('coin'),
                        TextInput::make('payout_2')->label('2 – 2 – 2')->numeric()->required()->minValue(0)->suffix('coin'),
                        TextInput::make('payout_3')->label('3 – 3 – 3')->numeric()->required()->minValue(0)->suffix('coin'),
                        TextInput::make('payout_4')->label('4 – 4 – 4')->numeric()->required()->minValue(0)->suffix('coin'),
                        TextInput::make('payout_5')->label('5 – 5 – 5')->numeric()->required()->minValue(0)->suffix('coin'),
                        TextInput::make('payout_6')->label('6 – 6 – 6')->numeric()->required()->minValue(0)->suffix('coin'),
                    ])->columns(3),
                Section::make('Sıralama / Kent — Ödül (coin)')
                    ->description('Ardışık üç FARKLI zar (1-2-3, 2-3-4, 3-4-5, 4-5-6) herhangi sırada — poker straight gibi. Olasılığı yukarıdaki "Kent ağırlığı" belirler; burada yalnız ödül miktarı.')
                    ->schema([
                        TextInput::make('payout_straight')->label('Sıralama ödülü')
                            ->numeric()->required()->minValue(0)->suffix('coin'),
                    ])->columns(1),
                Section::make('Jackpot (64 – 64 – 64)')
                    ->description('Artan havuz: her spinde büyür; biri üçlü 64 yapınca havuzu kazanır ve taban değere sıfırlanır.')
                    ->schema([
                        TextInput::make('jackpot_base')->label('Taban havuz')
                            ->numeric()->required()->minValue(0)->suffix('coin')
                            ->helperText('Başlangıç ve kazanıldıktan sonraki sıfırlama değeri.'),
                        TextInput::make('jackpot_increment')->label('Spin başına katkı')
                            ->numeric()->required()->minValue(0)->suffix('coin')
                            ->helperText('Her çevirmede havuza eklenen coin.'),
                    ])->columns(2),
                Section::make('Günlük Sıfırlama')
                    ->schema([
                        TextInput::make('reset_hour')->label('Sıfırlama saati (0-23)')
                            ->numeric()->required()->minValue(0)->maxValue(23),
                        TextInput::make('timezone')->label('Saat dilimi')->required()->maxLength(60),
                    ])->columns(2),
            ])
            ->statePath('data');
    }

    // Sağ panel: güncel jackpot, gerçek olasılıklar ve son büyük kazançlar.
    protected function getViewData(): array
    {
        // SONUÇ ağırlıkları (outcome-first) -> her kombinasyonun BAĞIMSIZ olasılığı.
        $w = ['lose' => max(0, DSS::int('lose_weight'))];
        for ($v = 1; $v <= 6; $v++) {
            $w['t'.$v] = max(0, DSS::int('triple_weight_'.$v));
        }
        $w['straight'] = max(0, DSS::int('straight_weight'));
        $w['jackpot'] = max(0, DSS::int('jackpot_weight'));
        $total = max(1, array_sum($w));

        $tripleOdds = [];
        $pAnyTriple = 0.0;
        for ($v = 1; $v <= 6; $v++) {
            $tripleOdds[$v] = $w['t'.$v] / $total;
            $pAnyTriple += $tripleOdds[$v];
        }
        $pStraight = $w['straight'] / $total;
        $pJackpot = $w['jackpot'] / $total;
        $pLose = $w['lose'] / $total;

        // RTP (ödemeli spin): EV / spin_cost. Progressive jackpot uzun-vade katkısı = P*base + increment.
        $ev = 0.0;
        for ($v = 1; $v <= 6; $v++) {
            $ev += $tripleOdds[$v] * max(0, DSS::int('payout_'.$v));
        }
        $ev += $pStraight * max(0, DSS::int('payout_straight'));
        $jpBase = max(0, DSS::int('jackpot_base'));
        $jpInc = max(0, DSS::int('jackpot_increment'));
        $ev += $pJackpot > 0 ? ($pJackpot * $jpBase + $jpInc) : 0.0;
        $spinCost = max(0, DSS::int('spin_cost'));
        $rtp = $spinCost > 0 ? $ev / $spinCost * 100 : null;

        $fmtOdds = fn (float $p) => $p > 0 ? '1 / '.number_format(1 / $p, 0, ',', '.') : '—';

        $jp = DiceSlotJackpot::current();
        $lastWinner = null;
        if ($jp->last_won_user_id) {
            $lastWinner = \App\Models\User::find($jp->last_won_user_id)?->name;
        }

        $recent = DiceSlotSpin::where('payout', '>', 0)
            ->orderByDesc('id')->limit(8)->get()
            ->map(fn ($s) => [
                'user' => \App\Models\User::find($s->user_id)?->name ?? '#'.$s->user_id,
                'reels' => is_array($s->reels) ? implode(' ', array_map(fn ($c) => $c === 'c64' ? '64' : substr($c, 1), $s->reels)) : '',
                'payout' => (int) $s->payout,
                'jackpot' => (bool) $s->jackpot_won,
            ])->all();

        return [
            'jackpotPool' => (int) $jp->pool,
            'jackpotBase' => max(0, DSS::int('jackpot_base')),
            'lastWinner' => $lastWinner,
            'lastWonAmount' => $jp->last_won_amount ? (int) $jp->last_won_amount : null,
            'odds' => [
                'straight' => $fmtOdds($pStraight),
                'anyTriple' => $fmtOdds($pAnyTriple),
                'triples' => collect($tripleOdds)->map(fn ($p, $v) => [
                    'value' => $v,
                    'odds' => $fmtOdds($p),
                ])->values()->all(),
                'jackpot' => $fmtOdds($pJackpot),
                'losePct' => number_format($pLose * 100, 1),
            ],
            'ev' => round($ev, 1),
            'spinCost' => $spinCost,
            'rtp' => $rtp === null ? null : round($rtp, 1),
            'recent' => $recent,
        ];
    }

    public function save(): void
    {
        $data = $this->form->getState();

        foreach (DSS::all() as $k => $_) {
            if (array_key_exists($k, $data)) {
                DSS::put($k, $data[$k]);
            }
        }

        Notification::make()->title('Zar Slotu ayarları kaydedildi')->success()->send();
    }
}
