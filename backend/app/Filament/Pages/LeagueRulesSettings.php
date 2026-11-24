<?php

namespace App\Filament\Pages;

use App\Models\LeagueSeason;
use App\Models\Setting;
use Filament\Forms\Components\RichEditor;
use Filament\Forms\Components\Section;
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

    protected static ?string $navigationGroup = 'TavlaTV Süper Lig';

    protected static ?int $navigationSort = 2;

    protected static string $view = 'filament.pages.site-settings';

    public ?array $data = [];

    public function mount(): void
    {
        // Boşsa varsayılan metinle ön-doldur (admin sıfırdan yazmasın, baz metin üstünden düzenlesin).
        // Eski düz-metin ("## başlık") kayıtları RichEditor için HTML'e çevrilir (ilk kayıtta HTML kalıcı olur).
        $this->form->fill(['league_rules' => self::toHtml(Setting::get('league_rules', LeagueSeason::DEFAULT_RULES))]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Kurallar metni')
                    ->description('Lig ekranındaki "Kurallar" sekmesinde gösterilir — TEK metin, tüm sezonlara uygulanır. Başlık/kalın/liste için araç çubuğunu kullan. Ödüller aktif sezonun ödüllerinden otomatik eklenir; buraya yazma.')
                    ->schema([
                        RichEditor::make('league_rules')->label('Kurallar')
                            ->required()->maxLength(60000)
                            ->toolbarButtons(['bold', 'italic', 'h2', 'h3', 'bulletList', 'orderedList', 'link', 'blockquote', 'undo', 'redo']),
                    ])->columns(1),
            ])
            ->statePath('data');
    }

    /** Eski düz-metin kural formatını ("## başlık" + satır-paragraf) RichEditor HTML'ine çevirir; zaten HTML ise dokunmaz. */
    private static function toHtml(string $text): string
    {
        if (str_contains($text, '<')) {
            return $text; // zaten HTML (RichEditor çıktısı)
        }
        $html = '';
        foreach (preg_split('/\r?\n/', $text) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $html .= str_starts_with($line, '## ')
                ? '<h2>'.e(substr($line, 3)).'</h2>'
                : '<p>'.e($line).'</p>';
        }

        return $html;
    }

    public function save(): void
    {
        $data = $this->form->getState();
        Setting::put('league_rules', trim((string) ($data['league_rules'] ?? '')));
        Notification::make()->title('Lig kuralları kaydedildi')
            ->body('Sitedeki Kurallar sekmesinde anında geçerli (yeni build gerekmez).')->success()->send();
    }
}
