<?php

namespace App\Filament\Resources;

use App\Filament\Resources\FooterColumnResource\Pages;
use App\Models\FooterColumn;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * FOOTER KOLONLARI — alt bilgideki 7 bağlantı grubunu yönet. Satırları SÜRÜKLE-BIRAK ile
 * sırala (footer'da soldan sağa kolon sırası), "Başlık" alanına Türkçe yaz (diğer diller
 * otomatik çevrilir; boş = varsayılan) ve "Göster" ile kolonu aç/kapa. Kolonların İÇİNDEKİ
 * bağlantılar sabittir (Sol Menü/sayfa kaydından gelir); burada yalnız kolon başlığı/sıra/
 * görünürlüğü değişir. Yeni kolon eklenmez/silinmez (7 sabit kolon).
 */
class FooterColumnResource extends Resource
{
    protected static ?string $model = FooterColumn::class;

    protected static ?string $navigationIcon = 'heroicon-o-bars-3-bottom-left';

    protected static ?string $navigationLabel = 'Footer Kolonları';

    protected static ?string $modelLabel = 'footer kolonu';

    protected static ?string $pluralModelLabel = 'Footer Kolonları';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 3;

    // 7 sabit kolon: panelden yeni eklenmez/silinmez.
    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // inline (tablo içi) düzenlenir; ayrı form yok
    }

    public static function table(Table $table): Table
    {
        return $table
            ->reorderable('sort')   // sürükle-bırak -> footer kolon sırası
            ->defaultSort('sort')
            ->paginated(false)
            ->columns([
                Tables\Columns\TextColumn::make('key')
                    ->label('Kolon')
                    ->badge()
                    ->color('gray')
                    ->formatStateUsing(fn (FooterColumn $r) => $r->defaultLabel()),
                Tables\Columns\TextInputColumn::make('label_tr')
                    ->label('Başlık (boş = varsayılan)')
                    ->placeholder(fn (FooterColumn $r) => $r->defaultLabel()),
                Tables\Columns\TextColumn::make('label_en')
                    ->label('Çeviriler')
                    ->getStateUsing(fn (FooterColumn $r) => collect([
                        'EN' => $r->label_en, 'ES' => $r->label_es, 'DE' => $r->label_de, 'FR' => $r->label_fr,
                    ])->filter()->map(fn ($v, $k) => "$k: $v")->implode('  ·  ') ?: '—')
                    ->color('gray')
                    ->wrap()
                    ->toggleable(),
                Tables\Columns\ToggleColumn::make('visible')
                    ->label('Footer’da göster')
                    ->tooltip('Kapalıysa bu kolon (başlık + bağlantıları) footer’da hiç görünmez.'),
            ])
            ->actions([]);   // reorder + inline düzenleme yeterli (yeni/sil yok)
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListFooterColumns::route('/'),
        ];
    }
}
