<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Actions\Action;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Support\Facades\Artisan;

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

    /**
     * Sayfa başlığındaki eylemler. "Sitemap Güncelle": public/sitemap.xml'i yayındaki haberlerle
     * senkronlar (seo:sitemap komutu). Yeni haber yayınlayınca arama motorlarının güncel URL
     * listesini görmesi için elle tetiklenir (deploy'da da koşar ama aradaki yayınlar için pratik).
     */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('regenerateSitemap')
                ->label('Sitemap Güncelle')
                ->icon('heroicon-o-map')
                ->color('gray')
                ->requiresConfirmation()
                ->modalHeading('Sitemap güncellensin mi?')
                ->modalDescription('Yayındaki haberler public/sitemap.xml ile senkronlanır. Statik sayfa URL’leri zaten sitemap’te; bu işlem yalnız haber URL’lerini günceller.')
                ->modalSubmitActionLabel('Güncelle')
                ->action(function (): void {
                    try {
                        $code = Artisan::call('seo:sitemap');
                        $out = trim(Artisan::output());
                        if ($code === 0) {
                            Notification::make()
                                ->title('Sitemap güncellendi')
                                ->body($out !== '' ? $out : 'public/sitemap.xml yayındaki haberlerle senkronlandı.')
                                ->success()
                                ->send();
                        } else {
                            Notification::make()
                                ->title('Sitemap güncellenemedi')
                                ->body($out !== '' ? $out : 'seo:sitemap komutu hata döndürdü.')
                                ->danger()
                                ->send();
                        }
                    } catch (\Throwable $e) {
                        Notification::make()
                            ->title('Sitemap güncellenemedi')
                            ->body($e->getMessage())
                            ->danger()
                            ->send();
                    }
                }),
        ];
    }

    public function mount(): void
    {
        $this->form->fill([
            'starting_rating' => Setting::int('starting_rating', 1400),
            'welcome_coins' => Setting::int('welcome_coins', 100),
            'welcome_premium_months' => Setting::int('welcome_premium_months', 3),
            'reward_normal' => Setting::int('reward_normal', 25),
            'reward_premium' => Setting::int('reward_premium', 50),
            'commission_pct' => Setting::int('commission_pct', 5),
            'pr_min_matches' => Setting::int('pr_min_matches', 5),
            'pr_min_decisions' => Setting::int('pr_min_decisions', 100),
            'friendly_rating_daily_limit' => Setting::int('friendly_rating_daily_limit', \App\Support\RatingPolicy::DEFAULT_LIMIT),
            'gtag_enabled' => Setting::bool('gtag_enabled', false),
            'gtag_id' => Setting::get('gtag_id', ''),
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
                        TextInput::make('welcome_premium_months')->label('Hoşgeldin Premium (ay)')
                            ->numeric()->required()->minValue(0)->maxValue(24)->suffix('ay')
                            ->helperText('Yeni üye e-posta doğrulayınca / Google ile kaydolunca bu kadar ay ücretsiz Premium. Bir kez; 0 = kapalı.'),
                    ])->columns(2),
                Section::make('6 Saatlik Ödül')
                    ->schema([
                        TextInput::make('reward_normal')->label('Normal kullanıcı')
                            ->numeric()->required()->minValue(0)->suffix('GC'),
                        TextInput::make('reward_premium')->label('Premium üye (Star)')
                            ->numeric()->required()->minValue(0)->suffix('GC'),
                    ])->columns(2),
                Section::make('Bahis')
                    ->schema([
                        TextInput::make('commission_pct')->label('Komisyon')
                            ->numeric()->required()->minValue(0)->maxValue(90)->suffix('%')
                            ->helperText('Kazanan stake × (1 − oran) alır; fark platforma (Komisyonlar ledger). 0 = kapalı.'),
                    ]),
                Section::make('Arkadaş / Kılıç Maçı Puan Limiti')
                    ->description('Arkadaşınla oyna (özel oda) ve Kılıç meydan okuma maçları PUANLIDIR; ancak farm’ı önlemek için AYNI rakiple 24 saat içinde en fazla bu kadar kez rating/PR kazanılır. Sonraki maçlar puansız (casual) olur. Eşleşme ve turnuva bu limite tabi DEĞİLDİR. 0 = arkadaş/kılıç hiç puanlanmaz.')
                    ->schema([
                        TextInput::make('friendly_rating_daily_limit')->label('Aynı rakiple 24 saatte puanlı maç')
                            ->numeric()->required()->minValue(0)->maxValue(50)
                            ->helperText('Varsayılan 3.'),
                    ]),
                Section::make('PR Sıralaması (Career PR)')
                    ->description('Bir oyuncunun PR Sıralaması leaderboard’una girebilmesi için gereken asgari koşullar. İKİ şart da sağlanmalı.')
                    ->schema([
                        TextInput::make('pr_min_matches')->label('Minimum analiz edilmiş maç')
                            ->numeric()->required()->minValue(1)->maxValue(1000)
                            ->helperText('Varsayılan 10. Tek iyi maçla zirveye çıkmayı engeller.'),
                        TextInput::make('pr_min_decisions')->label('Minimum analiz edilmiş karar')
                            ->numeric()->required()->minValue(1)->maxValue(100000)
                            ->helperText('Varsayılan 200. Yeterli karar örneklemi olmadan sıralamaya girilmez.'),
                    ])->columns(2),
                Section::make('Google Etiketi (gtag.js / Reklam Dönüşümü)')
                    ->description('Google Ads / Analytics ölçüm etiketi. Açıkken tüm sayfalarda gtag.js yüklenir. Kapatınca hiçbir Google script’i yüklenmez.')
                    ->schema([
                        Toggle::make('gtag_enabled')->label('Etiket aktif')
                            ->helperText('Kapalıyken (veya ID boşken) site hiçbir Google ölçüm script’i yüklemez.'),
                        TextInput::make('gtag_id')->label('Etiket kimliği (ID)')
                            ->placeholder('AW-XXXXXXXXXX veya G-XXXXXXXXXX')
                            ->maxLength(120)
                            ->helperText('Google Ads için AW-…, GA4 için G-…. Birden fazla etiketi VİRGÜLLE ayır (örn. AW-123,G-XYZ).'),
                    ])->columns(2),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        foreach (['starting_rating', 'welcome_coins', 'welcome_premium_months', 'reward_normal', 'reward_premium', 'commission_pct', 'pr_min_matches', 'pr_min_decisions', 'friendly_rating_daily_limit'] as $k) {
            if (array_key_exists($k, $data)) {
                Setting::put($k, (int) $data[$k]);
            }
        }
        // Google Etiketi (string id + bool aktif) — int değil.
        if (array_key_exists('gtag_id', $data)) {
            Setting::put('gtag_id', trim((string) $data['gtag_id']));
        }
        if (array_key_exists('gtag_enabled', $data)) {
            Setting::put('gtag_enabled', $data['gtag_enabled'] ? '1' : '0');
        }
        Notification::make()->title('Site ayarları kaydedildi')->success()->send();
    }
}
