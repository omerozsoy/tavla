<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Site Ayarları (Ekonomi) — yönetim panelinden düzenlenir. Değerler settings tablosunda tutulur;
 * kod Setting::int(...) ile okur (cache'li). Başlangıç rating, hoşgeldin coin, 6 saatlik ödül
 * (normal/premium), komisyon %.
 */
class SiteSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-adjustments-horizontal';

    protected static ?string $navigationLabel = 'Site Ayarları';

    protected static ?string $title = 'Site Ayarları (Ekonomi)';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 1;

    protected static string $view = 'filament.pages.site-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'starting_rating' => Setting::int('starting_rating', 1400),
            'welcome_coins' => Setting::int('welcome_coins', 100),
            'reward_normal' => Setting::int('reward_normal', 25),
            'reward_premium' => Setting::int('reward_premium', 50),
            'commission_pct' => Setting::int('commission_pct', 5),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Üyelik')
                    ->schema([
                        TextInput::make('starting_rating')->label('Başlangıç Rating')
                            ->numeric()->required()->minValue(100)->maxValue(4000)
                            ->helperText('Tüm yeni üyeler bu rating ile başlar (varsayılan 1400).'),
                        TextInput::make('welcome_coins')->label('Hoşgeldin Coin')
                            ->numeric()->required()->minValue(0)->suffix('GC')
                            ->helperText('E-posta doğrulayınca / Google ile girince verilir (kayıtta değil).'),
                    ])->columns(2),
                Section::make('6 Saatlik Ödül')
                    ->schema([
                        TextInput::make('reward_normal')->label('Normal kullanıcı')
                            ->numeric()->required()->minValue(0)->suffix('GC'),
                        TextInput::make('reward_premium')->label('Premium üye (Star/StarPRO)')
                            ->numeric()->required()->minValue(0)->suffix('GC'),
                    ])->columns(2),
                Section::make('Bahis')
                    ->schema([
                        TextInput::make('commission_pct')->label('Komisyon')
                            ->numeric()->required()->minValue(0)->maxValue(90)->suffix('%')
                            ->helperText('Kazanan stake × (1 − oran) alır; fark platforma (Komisyonlar ledger). 0 = kapalı.'),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        foreach (['starting_rating', 'welcome_coins', 'reward_normal', 'reward_premium', 'commission_pct'] as $k) {
            if (array_key_exists($k, $data)) {
                Setting::put($k, (int) $data[$k]);
            }
        }
        Notification::make()->title('Site ayarları kaydedildi')->success()->send();
    }
}
