<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Havale/EFT Ödeme Ayarları — IBAN + hesap sahibi + banka + müşteriye açıklama. Açıkken
 * checkout'ta "Havale/EFT ile öde" seçeneği çıkar; müşteri IBAN'a gönderir, sipariş 'pending'
 * kalır. Ödeme banka dekontu görülüp admin panelden ELLE 'paid' yapılınca işleme alınır
 * (coin/üyelik otomatik yüklenmez; elle verilir).
 */
class BankTransferSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-building-library';

    protected static ?string $navigationLabel = 'Havale / EFT';

    protected static ?string $title = 'Havale / EFT Ödeme Ayarları';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 2;

    protected static string $view = 'filament.pages.site-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'bank_transfer_enabled' => Setting::bool('bank_transfer_enabled', false),
            'bank_transfer_iban' => Setting::get('bank_transfer_iban'),
            'bank_transfer_name' => Setting::get('bank_transfer_name'),
            'bank_transfer_bank' => Setting::get('bank_transfer_bank'),
            'bank_transfer_note' => Setting::get('bank_transfer_note'),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Havale / EFT')
                    ->description('Açıkken sepet ödemesinde (coin paketi, üyelik, ürün) "Havale/EFT ile öde" seçeneği görünür. Müşteri IBAN’a gönderir; sipariş ödeme dekontu görülene kadar "Bekliyor" kalır. Ödemeyi ELLE onaylarsın (Ödeme Kayıtları / Siparişler ekranından durumu "Ödendi" yaparsın); coin/üyelik otomatik yüklenmez, elle verilir.')
                    ->schema([
                        Toggle::make('bank_transfer_enabled')->label('Havale/EFT açık')
                            ->helperText('Kapalıyken müşteriye havale seçeneği gösterilmez.'),
                        TextInput::make('bank_transfer_iban')->label('IBAN')
                            ->placeholder('TR00 0000 0000 0000 0000 0000 00')
                            ->maxLength(40)
                            ->helperText('Ödemenin geleceği IBAN.'),
                        TextInput::make('bank_transfer_name')->label('Hesap sahibi / Ünvan')
                            ->maxLength(160),
                        TextInput::make('bank_transfer_bank')->label('Banka')
                            ->maxLength(120)
                            ->helperText('Örn. Garanti BBVA, Ziraat Bankası.'),
                        Textarea::make('bank_transfer_note')->label('Müşteriye açıklama (isteğe bağlı)')
                            ->rows(3)
                            ->maxLength(500)
                            ->helperText('Ödeme talimatına eklenir. Örn. açıklamaya sipariş numarasını yazın, onay 1 iş günü sürer.'),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        Setting::put('bank_transfer_enabled', ! empty($data['bank_transfer_enabled']) ? 1 : 0);
        foreach (['bank_transfer_iban', 'bank_transfer_name', 'bank_transfer_bank', 'bank_transfer_note'] as $k) {
            Setting::put($k, trim((string) ($data[$k] ?? '')));
        }
        Notification::make()->title('Havale ayarları kaydedildi')->success()->send();
    }
}
