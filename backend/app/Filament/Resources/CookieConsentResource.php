<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CookieConsentResource\Pages;
use App\Models\CookieConsentSetting;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;

/**
 * Çerez Onay Banner'ı (tekil ayar): siteye ilk girişte gösterilen banner + tercih modalı
 * metinleri buradan düzenlenir. Ayrıca (varsa) Google Analytics / GTM / Meta Pixel ID'leri:
 * dolu olduklarında ilgili onay kategorisi verilmişse frontend script'i yükler.
 * Navigasyon doğrudan tek kaydın düzenleme ekranını açar (liste yok).
 */
class CookieConsentResource extends Resource
{
    protected static ?string $model = CookieConsentSetting::class;

    protected static ?string $slug = 'cerez-banner';

    protected static ?string $navigationIcon = 'heroicon-o-shield-check';

    protected static ?string $navigationLabel = 'Çerez Banner';

    protected static ?string $modelLabel = 'çerez banner ayarı';

    protected static ?string $pluralModelLabel = 'Çerez Banner';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 4;

    // Navigasyona tıklanınca tekil kaydın (id=1) düzenleme ekranına git.
    public static function getNavigationUrl(): string
    {
        return static::getUrl('edit', ['record' => CookieConsentSetting::current()->getKey()]);
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Banner (alt şerit)')->schema([
                Forms\Components\TextInput::make('banner_title')->label('Banner başlığı')
                    ->maxLength(160)->placeholder('Çerez Tercihleriniz')->columnSpanFull(),
                Forms\Components\Textarea::make('banner_body')->label('Banner metni')
                    ->rows(4)->columnSpanFull(),
            ])->columns(1),

            Forms\Components\Section::make('Tercih modalı')->schema([
                Forms\Components\TextInput::make('modal_title')->label('Modal başlığı')
                    ->maxLength(160)->placeholder('Çerez Tercihleri')->columnSpanFull(),
                Forms\Components\Textarea::make('modal_desc')->label('Modal açıklaması')
                    ->rows(3)->columnSpanFull(),
                Forms\Components\Textarea::make('desc_necessary')->label('Zorunlu çerezler açıklaması')->rows(2),
                Forms\Components\Textarea::make('desc_functional')->label('İşlevsel çerezler açıklaması')->rows(2),
                Forms\Components\Textarea::make('desc_analytics')->label('Analitik çerezler açıklaması')->rows(2),
                Forms\Components\Textarea::make('desc_marketing')->label('Pazarlama çerezleri açıklaması')->rows(2),
            ])->columns(2),

            Forms\Components\Section::make('Yeniden onay')->schema([
                Forms\Components\TextInput::make('consent_version')->label('Onay sürümü')
                    ->numeric()->default(1)->required()
                    ->helperText('Bu sayıyı ARTIRIRSANIZ tüm kullanıcılardan çerez onayı yeniden istenir (politika önemli ölçüde değişince kullanın).'),
            ])->columns(1),

            Forms\Components\Section::make('Ölçümleme / Reklam script ID’leri (opsiyonel)')
                ->description('Doldurulursa ilgili script YALNIZCA kullanıcı o kategoriye onay verdiğinde yüklenir. Boş bırakılırsa hiçbir izleme scripti çalışmaz.')
                ->schema([
                    Forms\Components\TextInput::make('ga_id')->label('Google Analytics ID (G-…) — Analitik')
                        ->maxLength(40)->placeholder('G-XXXXXXX'),
                    Forms\Components\TextInput::make('gtm_id')->label('Google Tag Manager ID (GTM-…) — Analitik/Pazarlama')
                        ->maxLength(40)->placeholder('GTM-XXXXXXX'),
                    Forms\Components\TextInput::make('meta_pixel_id')->label('Meta Pixel ID — Pazarlama')
                        ->maxLength(40)->placeholder('1234567890'),
                ])->columns(1),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'edit' => Pages\EditCookieConsent::route('/{record}/edit'),
        ];
    }
}
