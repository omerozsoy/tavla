<?php

namespace App\Filament\Pages;

use App\Support\RankDivisions;
use Filament\Actions\Action;
use Filament\Forms\Components\Fieldset;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
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
        $this->form->fill($state);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                // Tek akan liste: 20 kademe TIERS sırasıyla (Rookie -> S1) alt alta.
                Section::make('Rütbe Kademeleri')
                    ->description('Her kademenin İKİ eşiği var: “Rating ≥” yukarı doğru ARTAR, “PR ≤” ise aşağı doğru AZALIR (PR düşük = iyi). Rookie ikisinde de tabandır (rating 0, PR sonsuz) ve düzenlenemez.')
                    ->schema($this->tierFields(array_keys(RankDivisions::TIERS)))
                    ->columns(1),
            ])
            ->statePath('data');
    }

    /** Her kademe için bir Fieldset: rating ALT eşiği + PR ÜST eşiği. */
    protected function tierFields(array $tierKeys): array
    {
        $fields = [];
        foreach ($tierKeys as $key) {
            [$label, $defaultMin, $defaultPr] = RankDivisions::TIERS[$key];
            $formKey = RankDivisions::formKey($key);

            $rating = TextInput::make($formKey)
                ->label('Rating ≥')
                ->numeric()
                ->suffix('puan');
            $pr = TextInput::make($formKey.'__pr')
                ->label('PR ≤')
                ->numeric();

            if ($key === 'div.rookie') {
                // Taban kademe: rating 0, PR sonsuz. İkisi de sabit -> düzenlenemez.
                $rating->disabled()->dehydrated(false)->helperText('Sabit 0');
                $pr->disabled()->dehydrated(false)->placeholder('∞')->helperText('Sonsuz — her PR buraya düşer');
            } else {
                $rating->required()->minValue(1)->maxValue(4000)->helperText('Varsayılan '.$defaultMin);
                $pr->required()->numeric()->step(0.05)->minValue(0.05)->maxValue(200)
                    ->helperText('Varsayılan '.$defaultPr);
            }

            $fields[] = Fieldset::make($label)->schema([$rating, $pr])->columns(2);
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

        // Rating KESİN ARTAN, PR KESİN AZALAN olmalı. Biri bile bozuksa HİÇBİRİ yazılmaz
        // (yarım kaydedip tutarsız bir rütbe tablosu bırakmayalım).
        foreach ([RankDivisions::validate($mins), RankDivisions::validatePr($prMax)] as $error) {
            if ($error !== null) {
                Notification::make()->title('Eşikler kaydedilmedi')->body($error)->danger()->send();

                return;
            }
        }

        RankDivisions::put($mins);
        RankDivisions::putPr($prMax);
        Notification::make()
            ->title('Rütbe eşikleri kaydedildi')
            ->body('Panel etiketleri anında güncellendi; sitede oyuncuların sonraki sayfa yüklemesinde geçerli olur.')
            ->success()
            ->send();
    }
}
