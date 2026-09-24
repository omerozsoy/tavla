<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MenuItemResource\Pages;
use App\Models\MenuGroup;
use App\Models\MenuItem;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * SOL MENU DUZENLEME. Satirlari SURUKLE-BIRAK ile sirala (sort), "Görünen ad" alanina
 * Turkce yaz (diger diller otomatik cevrilir), "Grup" ile bir bolume tasi ve "Menüde"
 * anahtariyla goster/gizle. Gruplarin ADI/SIRASI "Menü Grupları" sayfasindan yonetilir.
 * Katalog config/menu.php'den gelir; frontend /api/menu-config ile okur.
 *
 * ÖZEL ÖĞE: admin "Özel Menü Öğesi Ekle" ile ad + hedef (/rota veya https://...) girip
 * menüye kendi linkini koyabilir (custom=true). Katalog öğeleri (custom=false) yalnız
 * inline düzenlenir; syncCatalog özel öğelere DOKUNMAZ.
 */
class MenuItemResource extends Resource
{
    protected static ?string $model = MenuItem::class;

    protected static ?string $navigationIcon = 'heroicon-o-bars-3';

    protected static ?string $navigationLabel = 'Sol Menü';

    protected static ?string $modelLabel = 'menü öğesi';

    protected static ?string $pluralModelLabel = 'Sol Menü';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 1;

    // Form YALNIZ özel (admin-eklemeli) öğeler için: ad + hedef + grup + görünürlük.
    // Katalog öğeleri tabloda inline düzenlenir (form açılmaz).
    public static function form(Form $form): Form
    {
        $groupOptions = MenuGroup::orderBy('sort')->orderBy('id')->get()
            ->mapWithKeys(fn (MenuGroup $g) => [$g->key => ($g->label_tr ?: ($g->defaultLabel() ?: $g->key))])
            ->all();

        return $form->schema([
            Forms\Components\TextInput::make('label_tr')
                ->label('Menü adı (Türkçe)')
                ->required()
                ->maxLength(60)
                ->helperText('Diğer diller otomatik çevrilir.'),
            Forms\Components\TextInput::make('href')
                ->label('Hedef (URL veya rota)')
                ->required()
                ->maxLength(300)
                ->placeholder('/turnuvalar  veya  https://ornek.com')
                ->helperText('İç sayfa için "/" ile başlayan rota (ör. /turnuva-takvimi); dış site için https:// (yeni sekmede açılır).'),
            Forms\Components\Select::make('group')
                ->label('Grup')
                ->options($groupOptions)
                ->required()
                ->native(false),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(999)
                ->helperText('Küçük sayı üstte. Listeden sürükle-bırak ile de değiştirebilirsin.'),
            Forms\Components\Toggle::make('visible')->label('Menüde göster')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        // Grup secenekleri (Menü Grupları'ndan). Ad: admin label_tr -> config varsayilani -> key.
        $groupOptions = MenuGroup::orderBy('sort')->orderBy('id')->get()
            ->mapWithKeys(fn (MenuGroup $g) => [$g->key => ($g->label_tr ?: ($g->defaultLabel() ?: $g->key))])
            ->all();

        return $table
            ->reorderable('sort')   // surukle-birak -> sort gunceller (grup icinde sira)
            ->defaultSort('sort')
            ->paginated(false)      // tum menu tek sayfada, siralama net gorunur
            ->columns([
                Tables\Columns\TextColumn::make('default_name')
                    ->label('Sayfa')
                    ->getStateUsing(fn (MenuItem $r) => $r->defaultLabel())
                    ->description(fn (MenuItem $r) => $r->custom ? ('↳ '.$r->href) : null)
                    ->weight('bold'),
                Tables\Columns\IconColumn::make('custom')
                    ->label('Özel')
                    ->boolean()
                    ->trueIcon('heroicon-m-link')
                    ->falseIcon('heroicon-o-minus')
                    ->trueColor('warning')
                    ->falseColor('gray'),
                Tables\Columns\SelectColumn::make('group')
                    ->label('Grup')
                    ->options($groupOptions)
                    ->selectablePlaceholder(false)
                    ->rules(['required']),
                Tables\Columns\TextInputColumn::make('label_tr')
                    ->label('Görünen ad (boş = otomatik)')
                    ->placeholder(fn (MenuItem $r) => $r->defaultLabel()),
                Tables\Columns\TextColumn::make('label_en')
                    ->label('Çeviriler')
                    ->getStateUsing(fn (MenuItem $r) => collect([
                        'EN' => $r->label_en, 'ES' => $r->label_es, 'DE' => $r->label_de, 'FR' => $r->label_fr,
                    ])->filter()->map(fn ($v, $k) => "$k: $v")->implode('  ·  ') ?: '—')
                    ->color('gray')
                    ->wrap()
                    ->toggleable(),
                Tables\Columns\ToggleColumn::make('visible')
                    ->label('Menüde'),
            ])
            ->actions([
                // Düzenle/Sil YALNIZ özel öğeler için (katalog öğeleri inline yönetilir, silinmez).
                Tables\Actions\EditAction::make()->label('Düzenle')->visible(fn (MenuItem $r) => $r->custom),
                Tables\Actions\DeleteAction::make()->label('Sil')->visible(fn (MenuItem $r) => $r->custom),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMenuItems::route('/'),
            'create' => Pages\CreateMenuItem::route('/ozel-ekle'),
            'edit' => Pages\EditMenuItem::route('/{record}/duzenle'),
        ];
    }
}
