<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\HtmlString;

/**
 * PayTR Ödeme Ayarları — kart ödemeleri PayTR iframe ile. Mağaza bilgileri (No / Parola / Gizli
 * Anahtar) PayTR mağaza panelinden gelir. Burada girilenler .env'i EZER ve CANLI okunur
 * (config:clear / php-fpm restart GEREKMEZ). Boş bırakılırsa .env (PAYTR_*) kullanılır.
 */
class PayTRSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static ?string $navigationLabel = 'PayTR Ödeme';

    protected static ?string $title = 'PayTR Ödeme Ayarları';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.pages.site-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'paytr_merchant_id' => Setting::get('paytr_merchant_id'),
            'paytr_merchant_key' => Setting::get('paytr_merchant_key'),
            'paytr_merchant_salt' => Setting::get('paytr_merchant_salt'),
            'paytr_test_mode' => (bool) ((int) (Setting::get('paytr_test_mode') ?? (config('paytr.test_mode') ? 1 : 0))),
        ]);
    }

    public function form(Form $form): Form
    {
        $callbackUrl = rtrim((string) config('app.url'), '/').'/pay/paytr-callback';

        return $form
            ->schema([
                Section::make('PayTR Mağaza Bilgileri')
                    ->description('Kart ödemeleri PayTR iframe ile alınır (kart formunu PayTR barındırır; kart verisi sunucuya ulaşmaz). Bilgileri PayTR mağaza panelinden alıp buraya gir. Buradaki değerler .env (PAYTR_*) ayarını EZER ve anında geçerli olur. Hepsi boşsa ödeme "yapılandırılmadı" sayılır (demo/kapalı).')
                    ->schema([
                        TextInput::make('paytr_merchant_id')->label('Mağaza No (Merchant ID)')
                            ->maxLength(32)
                            ->helperText('PayTR panelinde "Mağaza No".'),
                        TextInput::make('paytr_merchant_key')->label('Mağaza Parola (Merchant Key)')
                            ->password()->revealable()
                            ->maxLength(64)
                            ->helperText('PayTR "API Entegrasyon Bilgileri" > Mağaza Parola. GİZLİ.'),
                        TextInput::make('paytr_merchant_salt')->label('Mağaza Gizli Anahtar (Merchant Salt)')
                            ->password()->revealable()
                            ->maxLength(64)
                            ->helperText('PayTR "API Entegrasyon Bilgileri" > Mağaza Gizli Anahtar. GİZLİ.'),
                        Toggle::make('paytr_test_mode')->label('Test modu')
                            ->helperText('Açıkken gerçek para çekilmez (PayTR test kartı). Canlıya geçince KAPAT.'),
                        Placeholder::make('callback')->label('Bildirim (Callback) URL')
                            ->content(new HtmlString('PayTR panelinde <b>Bildirim URL</b> olarak şunu gir: <code>'.e($callbackUrl).'</code>')),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        foreach (['paytr_merchant_id', 'paytr_merchant_key', 'paytr_merchant_salt'] as $k) {
            Setting::put($k, trim((string) ($data[$k] ?? '')));
        }
        Setting::put('paytr_test_mode', ! empty($data['paytr_test_mode']) ? 1 : 0);
        Notification::make()->title('PayTR ayarları kaydedildi')->success()->send();
    }
}
