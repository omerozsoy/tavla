<?php

namespace App\Filament\Pages;

use App\Support\RankDivisions;
use Filament\Actions\Action;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Rating Ayar — rütbe (division) rating eşikleri. 20 kademenin alt eşiği buradan düzenlenir.
 * Değerler `settings.rank_divisions` JSON'unda tutulur (bkz App\Support\RankDivisions).
 *
 * NEREYE YANSIR: kaydedince (1) eski panel + Filament "Seviye" etiketleri ANINDA,
 * (2) site (SPA) `/api/rank-divisions` ucundan okuduğu için kullanıcının SONRAKİ sayfa
 * yüklemesinde — yeni frontend build GEREKMEZ.
 *
 * KURAL: eşikler kesin artan olmalı; aksi halde bir kademe erişilemez olur (rating "ulaştığı
 * en yüksek kademe"yi alır). Kaydetmeden önce RankDivisions::validate() bunu reddeder.
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
                ->modalDescription('Tüm rütbe eşikleri koddaki varsayılan tabloya (Rookie 0 … S1 2500) geri alınır. Oyuncu rating’leri DEĞİŞMEZ, yalnız rütbe sınırları sıfırlanır.')
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
        $this->form->fill($state);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Başlangıç Kademeleri')
                    ->description('Rookie tabanı 0’dır ve değiştirilemez: rating’i hiçbir eşiğe ulaşmayan oyuncu daima Rookie’dir.')
                    ->schema($this->tierFields(['div.rookie', 'div.novice', 'div.beginner', 'div.developing']))
                    ->columns(4),
                Section::make('Intermediate')
                    ->schema($this->tierFields(['div.i3', 'div.i2', 'div.i1']))
                    ->columns(3),
                Section::make('Advanced')
                    ->schema($this->tierFields(['div.a3', 'div.a2', 'div.a1']))
                    ->columns(3),
                Section::make('Master')
                    ->schema($this->tierFields(['div.m3', 'div.m2', 'div.m1']))
                    ->columns(3),
                Section::make('Grandmaster')
                    ->schema($this->tierFields(['div.g3', 'div.g2', 'div.g1', 'div.g0']))
                    ->columns(4),
                Section::make('Super Grandmaster')
                    ->schema($this->tierFields(['div.sgm3', 'div.sgm2', 'div.sgm1']))
                    ->columns(3),
            ])
            ->statePath('data');
    }

    /** Verilen kademeler için sayısal alanlar (etiket + varsayılan ipucu RankDivisions'tan). */
    protected function tierFields(array $tierKeys): array
    {
        $fields = [];
        foreach ($tierKeys as $key) {
            [$label, $default] = RankDivisions::TIERS[$key];
            $field = TextInput::make(RankDivisions::formKey($key))
                ->label($label)
                ->numeric()
                ->suffix('puan');
            if ($key === 'div.rookie') {
                // Taban kademe: daima 0 (save() sabitler) -> alan kilitli, doğrulamaya girmez.
                $field->disabled()->dehydrated(false)->helperText('Taban kademe — sabit 0.');
            } else {
                $field->required()->minValue(1)->maxValue(4000)->helperText('Varsayılan '.$default);
            }
            $fields[] = $field;
        }

        return $fields;
    }

    public function save(): void
    {
        $data = $this->form->getState();
        $mins = ['div.rookie' => 0]; // taban daima 0 (alan devre dışı)
        foreach (RankDivisions::TIERS as $key => [, $default]) {
            if ($key === 'div.rookie') {
                continue;
            }
            $formKey = RankDivisions::formKey($key);
            $mins[$key] = array_key_exists($formKey, $data) ? (int) $data[$formKey] : (int) $default;
        }

        // KESİN ARTAN kontrolü: bozuk sıra bir kademeyi erişilemez yapar -> kaydetme.
        if (($error = RankDivisions::validate($mins)) !== null) {
            Notification::make()->title('Eşikler kaydedilmedi')->body($error)->danger()->send();

            return;
        }

        RankDivisions::put($mins);
        Notification::make()
            ->title('Rütbe eşikleri kaydedildi')
            ->body('Panel etiketleri anında güncellendi; sitede oyuncuların sonraki sayfa yüklemesinde geçerli olur.')
            ->success()
            ->send();
    }
}
