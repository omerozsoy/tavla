<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Services\MatchClock;
use Filament\Forms\Components\Fieldset;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\HtmlString;

/**
 * Maç Süreleri — oyun saatini tempo (maç tipi) başına ayarla.
 *
 * Saat = PUAN BAŞINA banka (sn) × maç uzunluğu  +  HAMLE başına delay (sn).
 * Örn. normal tempo, puan-başı 60 sn → 3 puanlık maç = 3 dk, 5 puanlık = 5 dk banka.
 *
 * Değerler settings.clock_bank_<mode> / clock_delay_<mode> satırlarında tutulur; MatchClock::init
 * YENİ maçlarda buradan okur (sürmekte olan maçlar başlangıç değerini korur). Kayıt yoksa
 * MatchClock sabitleri (casual 180/15, normal 60/10, speed 24/8) geçerli — deploy/test güvenli.
 */
class MacSureleri extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-clock';

    protected static ?string $navigationLabel = 'Maç Süreleri';

    protected static ?string $title = 'Maç Süreleri (Oyun Saati)';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.pages.mac-sureleri';

    /** mode => Türkçe etiket. */
    public const MODES = ['casual' => 'Sakin (uzun)', 'normal' => 'Normal', 'speed' => 'Hızlı'];

    /** Önizlemede gösterilecek maç uzunlukları. */
    private const PREVIEW_LENGTHS = [1, 3, 5, 7, 9, 11];

    public ?array $data = [];

    public function mount(): void
    {
        $state = [];
        foreach (array_keys(self::MODES) as $m) {
            $state['bank_'.$m] = MatchClock::perPoint($m);
            $state['delay_'.$m] = MatchClock::delayFor($m);
        }
        $this->form->fill($state);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Oyun Saati — Tempo Başına')
                    ->description('Her tempo için PUAN BAŞINA ana süre ve HAMLE başına düşünme (delay) süresi. '
                        .'Maçın toplam banka süresi = puan-başı × maç uzunluğu. Delay her hamlede sıfırlanır; '
                        .'delay içinde ana süre azalmaz. Değişiklik yalnız YENİ başlayan maçlara uygulanır.')
                    ->schema(array_map(fn ($m) => $this->modeFields($m), array_keys(self::MODES)))
                    ->columns(1),
            ])
            ->statePath('data');
    }

    private function modeFields(string $mode): Fieldset
    {
        return Fieldset::make(self::MODES[$mode])
            ->schema([
                TextInput::make('bank_'.$mode)
                    ->label('Puan başına süre')
                    ->numeric()->required()->minValue(5)->maxValue(1800)
                    ->suffix('sn')->live(onBlur: true)
                    ->helperText('Varsayılan '.MatchClock::PER_POINT[$mode].' sn'),
                TextInput::make('delay_'.$mode)
                    ->label('Hamle süresi (delay)')
                    ->numeric()->required()->minValue(0)->maxValue(120)
                    ->suffix('sn')
                    ->helperText('Varsayılan '.MatchClock::DELAY[$mode].' sn'),
                Placeholder::make('preview_'.$mode)
                    ->label('Maç başına toplam süre')
                    ->content(fn (Get $get) => $this->previewFor((int) $get('bank_'.$mode))),
            ])
            ->columns(2);
    }

    /** Puan-başı saniyeden maç uzunluğu başına toplam dakikayı insan-okunur gösterir. */
    private function previewFor(int $perPoint): HtmlString
    {
        $perPoint = max(0, $perPoint);
        $parts = [];
        foreach (self::PREVIEW_LENGTHS as $len) {
            $sec = $perPoint * $len;
            $txt = $sec >= 60
                ? rtrim(rtrim(number_format($sec / 60, 1, ',', ''), '0'), ',').' dk'
                : $sec.' sn';
            $parts[] = '<b>'.$len.'p</b> '.$txt;
        }

        return new HtmlString('<span class="text-primary-600 dark:text-primary-400">'.implode(' · ', $parts).'</span>');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        foreach (array_keys(self::MODES) as $m) {
            Setting::put('clock_bank_'.$m, max(5, (int) ($data['bank_'.$m] ?? MatchClock::PER_POINT[$m])));
            Setting::put('clock_delay_'.$m, max(0, (int) ($data['delay_'.$m] ?? MatchClock::DELAY[$m])));
        }

        Notification::make()
            ->title('Maç saati kaydedildi')
            ->body('Yeni başlayan maçlarda geçerli; sürmekte olan maçlar başlangıç süresini korur.')
            ->success()
            ->send();
    }
}
