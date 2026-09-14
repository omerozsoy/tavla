<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MenuGroupResource\Pages;
use App\Models\MenuGroup;
use App\Models\MenuItem;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * SOL MENU GRUPLARI — bolum basliklarini yonet. Satirlari SURUKLE-BIRAK ile sirala (menude
 * bolumlerin sirasi), "Başlık" alanina Turkce yaz (diger diller otomatik cevrilir; boş =
 * varsayilan/başlıksız) ve "Göster" ile basligi ac/kapa. Yeni grup ekleyip Sol Menü'den
 * ogeleri bu gruba tasiyabilirsin.
 */
class MenuGroupResource extends Resource
{
    protected static ?string $model = MenuGroup::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-group';

    protected static ?string $navigationLabel = 'Menü Grupları';

    protected static ?string $modelLabel = 'menü grubu';

    protected static ?string $pluralModelLabel = 'Menü Grupları';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        // Yalnizca YENI grup olustururken kullanilir (mevcutlar tabloda satir-ici duzenlenir).
        return $form->schema([
            Forms\Components\TextInput::make('label_tr')
                ->label('Grup başlığı')
                ->required()
                ->maxLength(80)
                ->helperText('Türkçe yaz; diğer diller otomatik çevrilir. Sonra Sol Menü’den öğeleri bu gruba taşı.'),
            Forms\Components\Toggle::make('visible')->label('Başlığı göster')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')   // surukle-birak -> bolum sirasi
            ->defaultSort('sort')
            ->paginated(false)
            ->columns([
                Tables\Columns\TextInputColumn::make('label_tr')
                    ->label('Başlık (boş = varsayılan)')
                    ->placeholder(fn (MenuGroup $r) => $r->defaultLabel() ?: '— başlıksız —'),
                Tables\Columns\TextColumn::make('items_count')
                    ->label('Öğe')
                    ->badge()
                    ->getStateUsing(fn (MenuGroup $r) => MenuItem::where('group', $r->key)->count()),
                Tables\Columns\TextColumn::make('label_en')
                    ->label('Çeviriler')
                    ->getStateUsing(fn (MenuGroup $r) => collect([
                        'EN' => $r->label_en, 'ES' => $r->label_es, 'DE' => $r->label_de, 'FR' => $r->label_fr,
                    ])->filter()->map(fn ($v, $k) => "$k: $v")->implode('  ·  ') ?: '—')
                    ->color('gray')
                    ->wrap()
                    ->toggleable(),
                Tables\Columns\ToggleColumn::make('visible')->label('Göster'),
            ])
            ->actions([
                Tables\Actions\DeleteAction::make()
                    ->label('')
                    ->tooltip('Grubu sil')
                    ->modalHeading('Grubu sil')
                    ->modalDescription('Bu gruptaki öğeler varsayılan grubuna döner. Emin misin?'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListMenuGroups::route('/'),
            'create' => Pages\CreateMenuGroup::route('/create'),
        ];
    }
}
