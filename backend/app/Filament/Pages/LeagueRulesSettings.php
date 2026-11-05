<?php

namespace App\Filament\Pages;

use App\Models\LeagueSeason;
use App\Models\Setting;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;

/**
 * Türkiye Online Tavla Ligi — Kurallar (§16). TEK global metin; tüm sezonlara uygulanır.
 * Setting 'league_rules' deposunda tutulur (cache'li), kayıt yoksa LeagueSeason::DEFAULT_RULES
 * gösterilir. Lig ekranındaki "Kurallar" sekmesi /api/league yanıtından okur — yeni build gerekmez.
 */
class LeagueRulesSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-document-text';

    protected static ?string $navigationLabel = 'Kurallar';

    protected static ?string $title = 'Lig Kuralları';

    protected static ?string $navigationGroup = 'Türkiye Online Tavla Ligi';

    protected static ?int $navigationSort = 2;

    protected static string $view = 'filament.pages.site-settings';

    public ?array $data = [];

    public function mount(): void
    {
        // Boşsa varsayılan metinle ön-doldur (admin sıfırdan yazmasın, baz metin üstünden düzenlesin).
        $this->form->fill(['league_rules' => Setting::get('league_rules', LeagueSeason::DEFAULT_RULES)]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Kurallar metni')
                    ->description('Lig ekranındaki "Kurallar" sekmesinde gösterilir — TEK metin, tüm sezonlara uygulanır. "## " ile başlayan satır başlık, diğer satırlar paragraf olur. Ödüller aktif sezonun ödüllerinden otomatik eklenir; buraya yazma.')
                    ->schema([
                        Textarea::make('league_rules')->label('Kurallar')
                            ->rows(20)->required()->maxLength(20000),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        Setting::put('league_rules', trim((string) ($data['league_rules'] ?? '')));
        Notification::make()->title('Lig kuralları kaydedildi')
            ->body('Sitedeki Kurallar sekmesinde anında geçerli (yeni build gerekmez).')->success()->send();
    }
}
