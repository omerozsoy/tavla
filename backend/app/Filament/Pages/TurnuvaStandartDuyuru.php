<?php

namespace App\Filament\Pages;

use App\Models\Setting;
use Filament\Forms\Components\Section;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use FilamentTiptapEditor\TiptapEditor;

/**
 * Duyuru Standart Metinleri — turnuva tipine göre (Bracket / Swiss) standart duyuru metni.
 *
 * Turnuva BAŞLAYINCA tipine göre bu metin otomatik yayınlanır (TournamentAnnouncement::publishStandard,
 * startBracket → tournament_std_bracket, SwissRuntime::start → tournament_std_swiss). Boşsa veya
 * turnuvada zaten duyuru varsa yayınlanmaz. Buradan düzenlenir, settings'te kalıcıdır.
 */
class TurnuvaStandartDuyuru extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-megaphone';

    protected static ?string $navigationLabel = 'Duyuru Standart Metinleri';

    protected static ?string $title = 'Duyuru Standart Metinleri';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 6;

    protected static string $view = 'filament.pages.turnuva-standart-duyuru';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'std_bracket' => Setting::get('tournament_std_bracket'),
            'std_swiss' => Setting::get('tournament_std_swiss'),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Standart duyuru metinleri')
                    ->description('Turnuva başlayınca tipine göre bu metin otomatik duyuru olarak yayınlanır. '
                        .'Boş bırakılırsa o tip için otomatik duyuru çıkmaz. Kalın/italik ve RENK için araç çubuğunu kullan.')
                    ->schema([
                        TiptapEditor::make('std_bracket')
                            ->label('Bracket (Eleme Ağacı) standart metni')
                            ->profile('default')
                            ->disk('uploads')->directory('tournament-announce')->visibility('public')
                            ->columnSpanFull(),
                        TiptapEditor::make('std_swiss')
                            ->label('Swiss (Hak Sayılı) standart metni')
                            ->profile('default')
                            ->disk('uploads')->directory('tournament-announce')->visibility('public')
                            ->columnSpanFull(),
                    ])
                    ->columns(1),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();
        Setting::put('tournament_std_bracket', $data['std_bracket'] ?? '');
        Setting::put('tournament_std_swiss', $data['std_swiss'] ?? '');

        Notification::make()
            ->title('Standart duyuru metinleri kaydedildi')
            ->body('Bundan sonra başlayan turnuvalarda tipine göre otomatik yayınlanır.')
            ->success()
            ->send();
    }
}
