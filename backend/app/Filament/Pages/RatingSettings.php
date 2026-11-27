<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use App\Support\RankDivisions;
use App\Support\RankProgress;
use Filament\Actions\Action;
use Filament\Forms\Components\Fieldset;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Rating Ayar — rütbe (division) eşikleri. 20 kademenin İKİ eşiği buradan düzenlenir:
 *   - Rating alt eşiği -> `settings.rank_divisions`
 *   - PR üst eşiği     -> `settings.rank_pr_max`
 * (bkz App\Support\RankDivisions)
 *
 * NEREYE YANSIR: kaydedince (1) eski panel + Filament "Seviye" etiketleri ANINDA,
 * (2) site (SPA) `/api/rank-divisions` ucundan okuduğu için kullanıcının SONRAKİ sayfa
 * yüklemesinde — yeni frontend build GEREKMEZ.
 *
 * KURAL — iki eşik TERS yönde çalışır:
 *   - Rating KESİN ARTAN olmalı (rating "ulaşılan en yüksek kademe"yi alır).
 *   - PR KESİN AZALAN olmalı (PR düşük = iyi; PR "girilen en iyi bandı" alır).
 * Bozuk sıra kademeyi erişilemez yapar -> validate()/validatePr() kaydı reddeder.
 */
class RatingSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-trophy';

    protected static ?string $navigationLabel = 'Rating Ayar';

    protected static ?string $title = 'Rating Ayar (Rütbe Eşikleri)';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 2;

    protected static string $view = 'filament.pages.rating-settings';

    public ?array $data = [];

    protected function getHeaderActions(): array
    {
        return [
            Action::make('resetRankDivisions')
                ->label('Varsayılanlara Dön')
                ->icon('heroicon-o-arrow-path')
                ->color('gray')
                ->requiresConfirmation()
                ->modalHeading('Eşikler varsayılana dönsün mü?')
                ->modalDescription('Hem rating hem PR eşikleri koddaki varsayılan tabloya (Rookie 0 / ∞ … S1 2500 / 2.0) geri alınır. Oyuncu rating’leri ve PR’ları DEĞİŞMEZ, yalnız rütbe sınırları sıfırlanır.')
                ->modalSubmitActionLabel('Varsayılana dön')
                ->action(function (): void {
                    RankDivisions::resetToDefaults();
                    $this->mount();
                    Notification::make()->title('Rütbe eşikleri varsayılana döndü')->success()->send();
                }),
        ];
    }

    public function mount(): void
    {
        $state = [];
        foreach (RankDivisions::thresholds() as $key => $min) {
            $state[RankDivisions::formKey($key)] = $min;
        }
        foreach (RankDivisions::prThresholds() as $key => $prMax) {
            $state[RankDivisions::formKey($key).'__pr'] = $prMax;
        }
        foreach (RankDivisions::epThresholds() as $key => $epMin) {
            $state[RankDivisions::formKey($key).'__ep'] = $epMin;
        }
        // Yeni rütbe sistemi (rating + PR + EP) genel ayarları.
        $state['rank_pr_window_ep'] = RankProgress::windowEp();
        $state['rank_system_active'] = Setting::get('rank_system_active', '0') === '1';
        $state['rank_demote_grace_days'] = Setting::int('rank_demote_grace_days', 14);
        $this->form->fill($state);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                // Yeni rütbe sistemi (rating + PR + EP) genel ayarları.
                Section::make('Yeni Rütbe Sistemi (PR + EP)')
                    ->description('Rütbe = Rating ≥ eşiği VE PR ≤ eşiği VE EP ≥ eşiği (üçü birden). PR “son N EP” penceresinden ölçülür. “Aktif” kapalıyken site rütbeyi hâlâ yalnız rating’e göre gösterir (bilgi sayfası şartları yine görünür).')
                    ->schema([
                        Toggle::make('rank_system_active')
                            ->label('Yeni sistem aktif (site geneli zorlama)')
                            ->helperText('Kapalı: rütbe yalnız rating. Açık: rating+PR+EP üçü birden.'),
                        TextInput::make('rank_pr_window_ep')
                            ->label('PR penceresi')
                            ->numeric()->required()->minValue(50)->maxValue(5000)->step(50)
                            ->suffix('EP')
                            ->helperText('PR, son bu kadar EP’lik maçtan ölçülür. Varsayılan 400.'),
                        TextInput::make('rank_demote_grace_days')
                            ->label('Düşüş toleransı')
                            ->numeric()->required()->minValue(0)->maxValue(90)
                            ->suffix('gün')
                            ->helperText('Rütbe düşerken bu kadar gün beklenir (tek kötü maç anında düşürmesin). Varsayılan 14.'),
                    ])
                    ->columns(3),
                // Tek akan liste: 20 kademe TIERS sırasıyla (Rookie -> S1) alt alta.
                Section::make('Rütbe Kademeleri')
                    ->description('Her kademenin ÜÇ eşiği var: “Rating ≥” ve “EP ≥” yukarı doğru ARTAR, “PR ≤” ise aşağı doğru AZALIR (PR düşük = iyi). Rookie tabandır (rating 0, PR sonsuz, EP 0) ve düzenlenemez.')
                    ->schema($this->tierFields(array_keys(RankDivisions::TIERS)))
                    ->columns(1),
            ])
            ->statePath('data');
    }

    /** Her kademe için bir Fieldset: rating ALT eşiği + PR ÜST eşiği + EP ALT eşiği. */
    protected function tierFields(array $tierKeys): array
    {
        $fields = [];
        foreach ($tierKeys as $key) {
            [$label, $defaultMin, $defaultPr, $defaultEp] = RankDivisions::TIERS[$key];
            $formKey = RankDivisions::formKey($key);

            $rating = TextInput::make($formKey)
                ->label('Rating ≥')
                ->numeric()
                ->suffix('puan');
            $pr = TextInput::make($formKey.'__pr')
                ->label('PR ≤')
                ->numeric();
            $ep = TextInput::make($formKey.'__ep')
                ->label('EP ≥')
                ->numeric()
                ->suffix('EP');

            if ($key === 'div.rookie') {
                // Taban kademe: rating 0, PR sonsuz, EP 0. Üçü de sabit -> düzenlenemez.
                $rating->disabled()->dehydrated(false)->helperText('Sabit 0');
                $pr->disabled()->dehydrated(false)->placeholder('∞')->helperText('Sonsuz — her PR buraya düşer');
                $ep->disabled()->dehydrated(false)->helperText('Sabit 0');
            } else {
                $rating->required()->minValue(1)->maxValue(4000)->helperText('Varsayılan '.$defaultMin);
                $pr->required()->numeric()->step(0.05)->minValue(0.05)->maxValue(200)
                    ->helperText('Varsayılan '.$defaultPr);
                $ep->required()->minValue(0)->maxValue(100000)->helperText('Varsayılan '.$defaultEp);
            }

            $fields[] = Fieldset::make($label)->schema([$rating, $pr, $ep])->columns(3);
        }

        return $fields;
    }

    public function save(): void
    {
        $data = $this->form->getState();

        $mins = ['div.rookie' => 0]; // taban daima 0 (alan devre dışı)
        foreach (RankDivisions::TIERS as $key => [, $defaultMin]) {
            if ($key === 'div.rookie') {
                continue;
            }
            $formKey = RankDivisions::formKey($key);
            $mins[$key] = array_key_exists($formKey, $data) ? (int) $data[$formKey] : (int) $defaultMin;
        }

        $prMax = [];
        foreach (RankDivisions::defaultPrThresholds() as $key => $defaultPr) {
            $formKey = RankDivisions::formKey($key).'__pr';
            $prMax[$key] = array_key_exists($formKey, $data) ? (float) $data[$formKey] : (float) $defaultPr;
        }

        $epMin = ['div.rookie' => 0]; // taban daima 0 (alan devre dışı)
        foreach (RankDivisions::defaultEpThresholds() as $key => $defaultEp) {
            if ($key === 'div.rookie') {
                continue;
            }
            $formKey = RankDivisions::formKey($key).'__ep';
            $epMin[$key] = array_key_exists($formKey, $data) ? (int) $data[$formKey] : (int) $defaultEp;
        }

        // Rating KESİN ARTAN, PR KESİN AZALAN, EP AZALMAYAN olmalı. Biri bile bozuksa HİÇBİRİ
        // yazılmaz (yarım kaydedip tutarsız bir rütbe tablosu bırakmayalım).
        foreach (
            [
                RankDivisions::validate($mins),
                RankDivisions::validatePr($prMax),
                RankDivisions::validateEp($epMin),
            ] as $error
        ) {
            if ($error !== null) {
                Notification::make()->title('Eşikler kaydedilmedi')->body($error)->danger()->send();

                return;
            }
        }

        RankDivisions::put($mins);
        RankDivisions::putPr($prMax);
        RankDivisions::putEp($epMin);

        // Genel ayarlar.
        Setting::put('rank_pr_window_ep', (string) max(50, (int) ($data['rank_pr_window_ep'] ?? RankProgress::WINDOW_EP)));
        Setting::put('rank_system_active', ! empty($data['rank_system_active']) ? '1' : '0');
        Setting::put('rank_demote_grace_days', (string) max(0, (int) ($data['rank_demote_grace_days'] ?? 14)));

        // Eşikler/toggle değişti -> tüm oyuncuların efektif rütbe önbelleğini arka planda yenile
        // (worker yoksa: php artisan rank:refresh). KAPALIyken refreshAll rank_key'leri null yapar.
        \App\Jobs\RefreshAllRanksJob::dispatch();

        Notification::make()
            ->title('Rütbe eşikleri kaydedildi')
            ->body('Panel etiketleri anında güncellendi; oyuncu rütbe önbellekleri arka planda yenileniyor (gerekirse: php artisan rank:refresh).')
            ->success()
            ->send();
    }
}
