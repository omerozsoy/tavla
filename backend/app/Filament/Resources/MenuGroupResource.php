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
            Forms\Components\Toggle::make('visible')
                ->label('Menüde göster')
                ->helperText('Kapalıysa grup (başlık + tüm öğeleri) sol menüde HİÇ görünmez.')
                ->default(true),
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
                    ->label('İçindeki sayfalar')
                    ->badge()
                    ->color('gray')
                    ->getStateUsing(fn (MenuGroup $r) => MenuItem::where('group', $r->key)->count().' sayfa')
                    // Grubun altinda: iceren sayfa adlari (label_tr override yoksa config varsayilani), minik gri.
                    ->description(fn (MenuGroup $r) => MenuItem::where('group', $r->key)
                        ->orderBy('sort')->get()
                        ->map(fn (MenuItem $m) => $m->label_tr ?: $m->defaultLabel())
                        ->implode(' · ') ?: '— (boş grup)')
                    ->wrap(),
                Tables\Columns\TextColumn::make('label_en')
                    ->label('Çeviriler')
                    ->getStateUsing(fn (MenuGroup $r) => collect([
                        'EN' => $r->label_en, 'ES' => $r->label_es, 'DE' => $r->label_de, 'FR' => $r->label_fr,
                    ])->filter()->map(fn ($v, $k) => "$k: $v")->implode('  ·  ') ?: '—')
                    ->color('gray')
                    ->wrap()
                    ->toggleable(),
                Tables\Columns\ToggleColumn::make('collapsed')
                    ->label('Kapalı başlasın')
                    ->tooltip('Açıkken grup menüde katlı (kapalı) başlar; kullanıcı tıklayınca açılır.'),
                Tables\Columns\ToggleColumn::make('visible')
                    ->label('Menüde göster')
                    ->tooltip('Kapalıysa grup (başlık + tüm öğeleri) sol menüde hiç görünmez.'),
            ])
            ->filters([
                // Varsayilan: aktif gruplar. "Kaldirilanlar"a gecince tombstone'lananlari gorup geri getir.
                Tables\Filters\TernaryFilter::make('removed')
                    ->label('Görünüm')
                    ->placeholder('Aktif gruplar')
                    ->trueLabel('Kaldırılanlar (geri getir)')
                    ->falseLabel('Aktif gruplar')
                    ->default(false)
                    ->queries(
                        true: fn ($q) => $q->where('removed', true),
                        false: fn ($q) => $q->where('removed', false),
                        blank: fn ($q) => $q->where('removed', false),
                    ),
            ])
            ->actions([
                // YAPISAL (katalog) grup: hard-delete syncCatalog() yuzunden geri gelir ("silemedim").
                // Bu yuzden "sil" = SOFT tombstone (removed=true): satir kalir ama admin+menude gizli,
                // syncCatalog geri EKLEMEZ. Icindeki sayfalar da (grup gorunmez oldugu icin) menuden kalkar.
                Tables\Actions\Action::make('softRemove')
                    ->label('')
                    ->icon('heroicon-o-trash')
                    ->color('danger')
                    ->tooltip('Grubu sil (kaldır)')
                    ->visible(fn (MenuGroup $r) => $r->isCatalog() && ! $r->removed)
                    ->requiresConfirmation()
                    ->modalHeading('Yapısal grubu kaldır')
                    ->modalDescription('Bu grup ve içindeki sayfalar menüden kaldırılır. İstediğinde "Görünüm → Kaldırılanlar" filtresinden geri getirebilirsin.')
                    ->action(fn (MenuGroup $r) => $r->update(['removed' => true, 'visible' => false])),

                // ADMIN-olusturdugu (katalog-disi) grup: gercek silme (syncCatalog geri eklemez).
                Tables\Actions\DeleteAction::make()
                    ->label('')
                    ->tooltip('Grubu sil')
                    ->visible(fn (MenuGroup $r) => ! $r->isCatalog() && ! $r->removed)
                    ->modalHeading('Grubu sil')
                    ->modalDescription('Bu gruptaki öğeler varsayılan grubuna döner. Emin misin?'),

                // Kaldirilmis (tombstone) grubu geri getir.
                Tables\Actions\Action::make('restore')
                    ->label('')
                    ->icon('heroicon-o-arrow-uturn-left')
                    ->color('gray')
                    ->tooltip('Geri getir')
                    ->visible(fn (MenuGroup $r) => (bool) $r->removed)
                    ->action(fn (MenuGroup $r) => $r->update(['removed' => false, 'visible' => true])),
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
