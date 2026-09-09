<?php

namespace App\Filament\Pages;

use App\Models\LuckyWheelAudit;
use App\Models\LuckyWheelReward;
use App\Support\LuckyWheelSettings as LWS;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Şans Çarkı — Genel Ayarlar. Değerler Setting deposunda ('lw_*') tutulur (cache'li);
 * kayıt yoksa config/lucky-wheel.php varsayılanına düşer.
 */
class LuckyWheelSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';

    protected static ?string $navigationLabel = 'Şans Çarkı Ayarları';

    protected static ?string $title = 'Şans Çarkı — Ayarlar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 6;

    protected static string $view = 'filament.pages.lucky-wheel-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill(LWS::all());
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Genel')
                    ->schema([
                        Toggle::make('enabled')->label('Çark açık')->helperText('Kapalıyken kullanıcılar çeviremez.'),
                        Toggle::make('require_login')->label('Giriş zorunlu'),
                        TextInput::make('free_spins_per_day')->label('Günlük ücretsiz hak')
                            ->numeric()->required()->minValue(0),
                        TextInput::make('spin_cost')->label('Coin ile çevirme bedeli')
                            ->numeric()->required()->minValue(0)->suffix('coin')
                            ->helperText('Ücretsiz/bonus hak bitince kullanıcı bu kadar coin ödeyerek çevirir. 0 = ödemeli çevirme kapalı.'),
                        TextInput::make('cooldown_minutes')->label('Ardışık bekleme (dk)')
                            ->numeric()->required()->minValue(0)
                            ->helperText('0 = ardışık çevirmede bekleme yok (yalnız günlük hak sınırlar).'),
                    ])->columns(2),
                Section::make('Dilim Sınırları')
                    ->description('Dilim sayısı SABİT DEĞİL: aktif+geçerli+stoktaki ödül sayısı kadardır, bu aralıkla sınırlanır.')
                    ->schema([
                        TextInput::make('min_slice_count')->label('Minimum dilim')
                            ->numeric()->required()->minValue(2)->maxValue(32),
                        TextInput::make('max_slice_count')->label('Maksimum dilim')
                            ->numeric()->required()->minValue(2)->maxValue(32),
                    ])->columns(2),
                Section::make('Gösterim')
                    ->schema([
                        TextInput::make('animation_duration')->label('Animasyon süresi (ms)')
                            ->numeric()->required()->minValue(1000)->maxValue(15000),
                        Toggle::make('show_probability')->label('Kullanıcıya gerçek yüzdeyi göster'),
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

    // Sağ paneldeki çark ön izlemesi için kayıtlı aktif ödüller (renk + gerçek %).
    protected function getViewData(): array
    {
        $pool = LuckyWheelReward::query()->eligible()->get();
        $total = (float) $pool->sum(fn ($r) => max(0, (float) $r->weight));
        $palette = config('lucky-wheel.palette', []);
        $rewards = [];
        foreach ($pool->values() as $i => $r) {
            $rewards[] = [
                'name' => $r->name,
                'color' => $r->slice_color ?: ($palette[$i % max(1, count($palette))] ?? '#a83a2b'),
                'textColor' => $r->text_color ?: '#ffffff',
                'pct' => $total > 0 ? number_format(max(0, (float) $r->weight) / $total * 100, 1) : '0',
            ];
        }
        return ['preview' => ['count' => $pool->count(), 'rewards' => $rewards]];
    }

    public function save(): void
    {
        $data = $this->form->getState();

        $min = (int) $data['min_slice_count'];
        $max = (int) $data['max_slice_count'];
        if ($min > $max) {
            Notification::make()->title('Minimum dilim, maksimumdan büyük olamaz.')->danger()->send();
            return;
        }

        // Uyarı (engel değil): aktif ödül sayısı minimumun altındaysa çark çalışmaz.
        $activeCount = LuckyWheelReward::query()->eligible()->count();
        if (($data['enabled'] ?? false) && $activeCount < $min) {
            Notification::make()
                ->title('Dikkat: yeterli aktif ödül yok')
                ->body("Çark açık ama uygun ödül sayısı ($activeCount) minimum dilimden ($min) az. Çark çevrilemez.")
                ->warning()->send();
        }

        foreach (LWS::all() as $k => $_) {
            if (array_key_exists($k, $data)) {
                LWS::put($k, $data[$k]);
            }
        }

        LuckyWheelAudit::log('settings', 'settings', ['saved' => [null, 'ok']]);
        Notification::make()->title('Şans Çarkı ayarları kaydedildi')->success()->send();
    }
}
