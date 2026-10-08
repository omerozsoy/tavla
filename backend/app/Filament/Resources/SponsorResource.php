<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SponsorResource\Pages;
use App\Models\Sponsor;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * SPONSORLAR — ana sayfa footer'ındaki karusel şeridi. Her sponsor LOGO + kısa AD (+opsiyonel
 * link) tutar. Satırları sürükle-bırak ile sırala; "Göster" ile aç/kapa. AdSlot ile aynı
 * upload deseni (disk 'uploads'). /api/footer-config ile frontend'e gider.
 */
class SponsorResource extends Resource
{
    protected static ?string $model = Sponsor::class;

    protected static ?string $navigationIcon = 'heroicon-o-building-storefront';

    protected static ?string $navigationLabel = 'Sponsorlar';

    protected static ?string $modelLabel = 'sponsor';

    protected static ?string $pluralModelLabel = 'Sponsorlar';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 5;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\TextInput::make('name')->label('Kısa ad')
                ->required()->maxLength(80)
                ->helperText('Logonun altında gösterilir.'),

            Forms\Components\FileUpload::make('logo')->label('Logo')
                ->image()->disk('uploads')->directory('sponsor')->visibility('public')
                ->optimizeOnUpload('sponsor')
                ->imageEditor()->maxSize(3072)
                ->required()
                ->helperText('Önerilen: şeffaf PNG/SVG. En fazla 3 MB.')
                ->columnSpanFull(),

            // AdSlot ile aynı: tam URL VEYA / ile başlayan site-içi yol; HTML5 url kuralından kaçın.
            Forms\Components\TextInput::make('link')->label('Hedef link (opsiyonel)')
                ->maxLength(500)
                ->placeholder('ör. https://sponsor.com')
                ->rule('regex:/^(https?:\/\/.+|\/.*)?$/')
                ->validationMessages(['regex' => 'Tam adres (https://…) VEYA site içi yol (/ ile başlar) girin.'])
                ->helperText('Boşsa logo tıklanamaz.')
                ->columnSpanFull(),

            Forms\Components\Toggle::make('visible')->label('Göster')->default(true)
                ->helperText('Kapalıysa sponsor footer karuselinde görünmez.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\ImageColumn::make('logo')->label('Logo')->disk('uploads'),
                Tables\Columns\TextColumn::make('name')->label('Ad')->searchable(),
                Tables\Columns\TextColumn::make('link')->label('Link')
                    ->placeholder('—')->limit(40)->url(fn ($state) => $state)->openUrlInNewTab(),
                Tables\Columns\ToggleColumn::make('visible')->label('Göster'),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSponsors::route('/'),
            'create' => Pages\CreateSponsor::route('/create'),
            'edit' => Pages\EditSponsor::route('/{record}/edit'),
        ];
    }
}
