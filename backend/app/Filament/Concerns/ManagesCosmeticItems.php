<?php

namespace App\Filament\Concerns;

use App\Http\Controllers\ShopController;
use App\Models\CosmeticItem;
use App\Models\User;
use Filament\Forms;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * "Avatar Tasarımı" / "Pul Tasarımı" ortak tablo: tüm öğeleri gör; grubunu, fiyatını (boş = grup
 * fiyatı) ve satış durumunu satır içinde ya da toplu değiştir. Kullanan resource static $kind tanımlar.
 */
trait ManagesCosmeticItems
{
    /** @var array<string,int>|null unlock id -> sahip sayısı (istek başına tek tarama) */
    private static ?array $ownerCounts = null;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('kind', static::$kind);
    }

    public static function canCreate(): bool
    {
        return false; // öğeler koddan gelir (animasyon/materyal); admin yalnız fiyat/grup/satış yönetir
    }

    public static function ownerCount(CosmeticItem $r): int
    {
        if (self::$ownerCounts === null) {
            $counts = [];
            $prefix = CosmeticItem::KIND_PREFIX[static::$kind];
            User::query()->where('unlocks', 'like', '%"'.$prefix.'%')->select(['id', 'unlocks'])
                ->chunkById(1000, function ($users) use (&$counts, $prefix) {
                    foreach ($users as $u) {
                        foreach ((array) ($u->unlocks ?? []) as $x) {
                            if (is_string($x) && str_starts_with($x, $prefix)) {
                                $counts[$x] = ($counts[$x] ?? 0) + 1;
                            }
                        }
                    }
                });
            self::$ownerCounts = $counts;
        }

        return self::$ownerCounts[$r->unlockId()] ?? 0;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->paginated([25, 50, 100, 'all'])
            ->defaultPaginationPageOption(100)
            ->columns([
                Tables\Columns\ViewColumn::make('meta')
                    ->label('Önizleme')
                    ->view('filament.board-design.cosmetic-swatch'),
                Tables\Columns\TextColumn::make('name')
                    ->label('Ad')
                    ->searchable()
                    ->sortable()
                    ->description(fn (CosmeticItem $r) => $r->item_id),
                Tables\Columns\SelectColumn::make('group')
                    ->label('Grup')
                    ->options(CosmeticItem::GROUPS)
                    ->selectablePlaceholder(false)
                    ->rules(['required', 'in:'.implode(',', array_keys(CosmeticItem::GROUPS))])
                    ->sortable(),
                Tables\Columns\TextInputColumn::make('price')
                    ->label('Fiyat (boş = grup)')
                    ->type('number')
                    ->rules(['nullable', 'integer', 'min:1', 'max:1000000'])
                    ->placeholder(fn (CosmeticItem $r) => (string) (ShopController::rarityPrice($r->group) ?? ''))
                    ->extraAttributes(['style' => 'max-width:8rem']),
                Tables\Columns\ToggleColumn::make('active')->label('Satışta'),
                Tables\Columns\TextColumn::make('owners')
                    ->label('Sahip')
                    ->getStateUsing(fn (CosmeticItem $r) => static::ownerCount($r))
                    ->color('gray'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('group')->label('Grup')->options(CosmeticItem::GROUPS),
                Tables\Filters\TernaryFilter::make('active')->label('Satışta'),
            ])
            ->bulkActions([
                Tables\Actions\BulkAction::make('moveGroup')
                    ->label('Gruba taşı')
                    ->icon('heroicon-o-arrows-right-left')
                    ->form([Forms\Components\Select::make('group')->label('Grup')->options(CosmeticItem::GROUPS)->required()])
                    ->action(fn (Collection $records, array $data) => $records->each(fn (CosmeticItem $r) => $r->update(['group' => $data['group']])))
                    ->deselectRecordsAfterCompletion(),
                Tables\Actions\BulkAction::make('setPrice')
                    ->label('Fiyat ver')
                    ->icon('heroicon-o-currency-dollar')
                    ->form([Forms\Components\TextInput::make('price')->label('Fiyat (boş = grup fiyatı)')->numeric()->integer()->minValue(1)->maxValue(1000000)])
                    ->action(fn (Collection $records, array $data) => $records->each(fn (CosmeticItem $r) => $r->update(['price' => filled($data['price'] ?? null) ? (int) $data['price'] : null])))
                    ->deselectRecordsAfterCompletion(),
                Tables\Actions\BulkAction::make('activate')
                    ->label('Satışa aç')
                    ->icon('heroicon-o-check-circle')
                    ->action(fn (Collection $records) => $records->each(fn (CosmeticItem $r) => $r->update(['active' => true])))
                    ->deselectRecordsAfterCompletion(),
                Tables\Actions\BulkAction::make('deactivate')
                    ->label('Satıştan kaldır')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->action(fn (Collection $records) => $records->each(fn (CosmeticItem $r) => $r->update(['active' => false])))
                    ->deselectRecordsAfterCompletion(),
            ]);
    }
}
