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
                Section::make('Sembol Olasılıkları')
                    ->description('Her zar yüzü aynı ağırlıkta; 64 küpü ayrı. 64 küpü ağırlığı düştükçe jackpot daha nadir gelir. Sağdaki panelde gerçek olasılıkları gör.')
                    ->schema([
                        TextInput::make('die_weight')->label('Zar yüzü ağırlığı (her 1..6)')
                            ->numeric()->required()->minValue(1),
                        TextInput::make('cube_weight')->label('64 küpü ağırlığı')
                            ->numeric()->required()->minValue(1),
                    ])->columns(2),
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
        $die = max(1, DSS::int('die_weight'));
        $cube = max(1, DSS::int('cube_weight'));
        $total = 6 * $die + $cube;

        $pFace = $die / $total;              // tek zar yüzü olasılığı
        $pCube = $cube / $total;             // 64 küpü olasılığı
        $pTripleFace = $pFace ** 3;          // belirli bir üçlü zar (ör. 6-6-6)
        $pAnyTriple = 6 * $pTripleFace;      // herhangi bir üçlü zar
        $pJackpot = $pCube ** 3;             // üçlü 64

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
                'anyTriple' => $fmtOdds($pAnyTriple),
                'triple6' => $fmtOdds($pTripleFace),
                'jackpot' => $fmtOdds($pJackpot),
                'cubePct' => number_format($pCube * 100, 2),
            ],
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
