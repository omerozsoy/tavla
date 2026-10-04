<?php

namespace App\Filament\Resources;

use App\Filament\Resources\BoardDesignResource\Pages;
use App\Models\BoardDesign;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Forms\Get;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\HtmlString;

/**
 * TAVLA TASARIMI — tüm tahtaları gör, grubunu/fiyatını/satış durumunu değiştir; zemin, etraf,
 * hane ve pul renklerini seçerek yeni (özel) tahta tasarla ve satışa koy. Ayarlar grubunun EN ALTI.
 */
class BoardDesignResource extends Resource
{
    protected static ?string $model = BoardDesign::class;

    protected static ?string $navigationIcon = 'heroicon-o-swatch';

    protected static ?string $navigationLabel = 'Tavla Tasarımı';

    protected static ?string $modelLabel = 'tavla tasarımı';

    protected static ?string $pluralModelLabel = 'Tavla Tasarımı';

    protected static ?string $slug = 'tavla-tasarimi';

    protected static ?string $navigationGroup = 'Ayarlar';

    protected static ?int $navigationSort = 99; // Ayarlar'ın en sonu

    private const HEX = 'regex:/^#[0-9a-fA-F]{6}$/';

    /** Grup varsayılan fiyatı (ShopController BOARD_PRICE). */
    public static function groupPrice(?string $group): ?int
    {
        return \App\Http\Controllers\ShopController::groupPrice($group);
    }

    private static function color(string $key, string $label, string $default, ?string $help = null): Forms\Components\ColorPicker
    {
        return Forms\Components\ColorPicker::make("colors.$key")
            ->label($label)
            ->default($default)
            ->required()
            ->rule(self::HEX)
            ->validationMessages(['regex' => 'Renk #RRGGBB biçiminde olmalı.'])
            ->live()
            ->helperText($help)
            ->disabled(fn (?BoardDesign $record) => $record && ! $record->is_custom);
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Grid::make(['default' => 1, 'lg' => 3])->schema([
                Forms\Components\Group::make([
                    Forms\Components\Section::make('Bilgiler')->schema([
                        Forms\Components\TextInput::make('name')
                            ->label('Tahta adı')
                            ->required()
                            ->maxLength(40)
                            ->disabled(fn (?BoardDesign $record) => $record && ! $record->is_custom),
                        Forms\Components\Select::make('group')
                            ->label('Grup')
                            ->options(BoardDesign::GROUPS)
                            ->default('common')
                            ->required()
                            ->live()
                            ->helperText('Mağazada hangi başlık altında listelenir.')
                            ->disabled(fn (?BoardDesign $record) => $record?->isFree()),
                        Forms\Components\TextInput::make('price')
                            ->label('Fiyat (coin)')
                            ->numeric()
                            ->integer()
                            ->minValue(1)
                            ->maxValue(1000000)
                            ->placeholder(fn (Get $get) => ($p = self::groupPrice($get('group'))) ? "$p (grup fiyatı)" : null)
                            ->helperText('Boş bırakırsan grubun fiyatı kullanılır.')
                            ->disabled(fn (?BoardDesign $record) => $record?->isFree()),
                        Forms\Components\Toggle::make('active')
                            ->label('Satışta')
                            ->default(true)
                            ->helperText('Kapalıysa mağazada satılmaz; daha önce alanlar kullanmaya devam eder.')
                            ->disabled(fn (?BoardDesign $record) => $record?->isFree()),
                    ])->columns(2),
                    Forms\Components\Section::make('Renkler')
                        ->description(fn (?BoardDesign $record) => $record && ! $record->is_custom
                            ? 'Yerleşik tahtanın renkleri koda aittir; değiştirmek için yeni özel tahta oluştur.'
                            : null)
                        ->schema([
                            self::color('panel', 'Zemin rengi', '#d8c6ac'),
                            self::color('frame', 'Tavla etrafı (çerçeve + orta bar)', '#3a2a1c'),
                            self::color('a', 'Hane rengi 1', '#a83a2b'),
                            self::color('b', 'Hane rengi 2', '#f2ead9'),
                            self::color('light', 'Açık pul rengi', '#f7f1e6', 'Beyaz oyuncunun pulları'),
                            self::color('checker', 'Koyu pul rengi', '#241a12', 'Siyah oyuncunun pulları'),
                            Forms\Components\Select::make('surface')
                                ->label('Zemin dokusu')
                                ->options(BoardDesign::SURFACES)
                                ->placeholder('Düz')
                                ->disabled(fn (?BoardDesign $record) => $record && ! $record->is_custom),
                            Forms\Components\Select::make('checker_style')
                                ->label('Pul stili')
                                ->options(BoardDesign::CHECKER_STYLES)
                                ->placeholder('Düz')
                                ->disabled(fn (?BoardDesign $record) => $record && ! $record->is_custom),
                        ])->columns(2),
                ])->columnSpan(['lg' => 2]),
                Forms\Components\Section::make('Önizleme')->schema([
                    Forms\Components\Placeholder::make('preview')
                        ->hiddenLabel()
                        ->content(fn (Get $get) => new HtmlString(view('filament.board-design.preview', [
                            'colors' => $get('colors'),
                            'width' => 320,
                        ])->render())),
                ])->columnSpan(1),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->paginated([25, 50, 100, 'all'])
            ->defaultPaginationPageOption(50)
            ->columns([
                Tables\Columns\ViewColumn::make('colors')
                    ->label('Önizleme')
                    ->view('filament.board-design.preview-column'),
                Tables\Columns\TextColumn::make('name')
                    ->label('Ad')
                    ->searchable()
                    ->sortable()
                    ->description(fn (BoardDesign $r) => $r->slug),
                Tables\Columns\TextColumn::make('is_custom')
                    ->label('Tür')
                    ->badge()
                    ->formatStateUsing(fn (BoardDesign $r) => $r->isFree() ? 'Ücretsiz' : ($r->is_custom ? 'Özel' : 'Yerleşik'))
                    ->color(fn (BoardDesign $r) => $r->is_custom ? 'success' : 'gray'),
                Tables\Columns\SelectColumn::make('group')
                    ->label('Grup')
                    ->options(BoardDesign::GROUPS)
                    ->selectablePlaceholder(false)
                    ->rules(['required', 'in:'.implode(',', array_keys(BoardDesign::GROUPS))])
                    ->disabled(fn (BoardDesign $r) => $r->isFree())
                    ->sortable(),
                Tables\Columns\TextInputColumn::make('price')
                    ->label('Fiyat (boş = grup)')
                    ->type('number')
                    ->rules(['nullable', 'integer', 'min:1', 'max:1000000'])
                    ->placeholder(fn (BoardDesign $r) => $r->isFree() ? 'Ücretsiz' : (string) (self::groupPrice($r->group) ?? ''))
                    ->disabled(fn (BoardDesign $r) => $r->isFree())
                    ->extraAttributes(['style' => 'max-width:8rem']),
                Tables\Columns\ToggleColumn::make('active')
                    ->label('Satışta')
                    ->disabled(fn (BoardDesign $r) => $r->isFree()),
                Tables\Columns\TextColumn::make('owners')
                    ->label('Sahip')
                    ->getStateUsing(fn (BoardDesign $r) => self::ownerCount($r))
                    ->color('gray'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('group')->label('Grup')->options(BoardDesign::GROUPS),
                Tables\Filters\TernaryFilter::make('is_custom')
                    ->label('Tür')
                    ->trueLabel('Özel tahtalar')
                    ->falseLabel('Yerleşik tahtalar'),
                Tables\Filters\TernaryFilter::make('active')->label('Satışta'),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('')->tooltip('Düzenle'),
                Tables\Actions\DeleteAction::make()
                    ->label('')
                    ->tooltip('Sil')
                    ->visible(fn (BoardDesign $r) => $r->is_custom)
                    ->before(function (BoardDesign $r, Tables\Actions\DeleteAction $action) {
                        if (self::ownerCount($r, true) > 0) {
                            Notification::make()->danger()
                                ->title('Bu tahtayı satın alan oyuncular var')
                                ->body('Silmek yerine "Satışta" anahtarını kapat; sahipleri kullanmaya devam eder.')
                                ->send();
                            $action->cancel();
                        }
                    }),
            ])
            ->bulkActions([
                Tables\Actions\BulkAction::make('moveGroup')
                    ->label('Gruba taşı')
                    ->icon('heroicon-o-arrows-right-left')
                    ->form([
                        Forms\Components\Select::make('group')->label('Grup')->options(BoardDesign::GROUPS)->required(),
                    ])
                    ->action(function (Collection $records, array $data) {
                        $records->reject(fn (BoardDesign $r) => $r->isFree())
                            ->each(fn (BoardDesign $r) => $r->update(['group' => $data['group']]));
                    })
                    ->deselectRecordsAfterCompletion(),
                Tables\Actions\BulkAction::make('activate')
                    ->label('Satışa aç')
                    ->icon('heroicon-o-check-circle')
                    ->action(fn (Collection $records) => $records->reject(fn (BoardDesign $r) => $r->isFree())
                        ->each(fn (BoardDesign $r) => $r->update(['active' => true])))
                    ->deselectRecordsAfterCompletion(),
                Tables\Actions\BulkAction::make('deactivate')
                    ->label('Satıştan kaldır')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->action(fn (Collection $records) => $records->reject(fn (BoardDesign $r) => $r->isFree())
                        ->each(fn (BoardDesign $r) => $r->update(['active' => false])))
                    ->deselectRecordsAfterCompletion(),
            ]);
    }

    /** @var array<string,int>|null slug -> sahip sayısı (istek başına tek sorgu) */
    private static ?array $owners = null;

    /** Tahtayı satın almış (unlocks'ta 'theme.<slug>') oyuncu sayısı. */
    public static function ownerCount(BoardDesign $r, bool $fresh = false): int
    {
        if (self::$owners === null || $fresh) {
            $counts = [];
            User::query()->where('unlocks', 'like', '%"theme.%')->select(['id', 'unlocks'])
                ->chunkById(1000, function ($users) use (&$counts) {
                    foreach ($users as $u) {
                        foreach ((array) ($u->unlocks ?? []) as $x) {
                            if (is_string($x) && str_starts_with($x, 'theme.')) {
                                $k = substr($x, 6);
                                $counts[$k] = ($counts[$k] ?? 0) + 1;
                            }
                        }
                    }
                });
            self::$owners = $counts;
        }

        return self::$owners[$r->slug] ?? 0;
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBoardDesigns::route('/'),
            'create' => Pages\CreateBoardDesign::route('/create'),
            'edit' => Pages\EditBoardDesign::route('/{record}/edit'),
        ];
    }
}
