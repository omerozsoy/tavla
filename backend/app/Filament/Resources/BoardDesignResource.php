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

    private static function pointImage(string $field, string $label): Forms\Components\FileUpload
    {
        return Forms\Components\FileUpload::make($field)
            ->label($label)
            ->image()
            ->disk('uploads')->directory('tahta')->visibility('public')
            ->maxSize(4096)
            ->imageEditor()
            ->helperText('PNG / JPG / WEBP, en fazla 4 MB. Dikey (uzun) resimler hane şekline daha iyi oturur.')
            ->live();
    }

    /**
     * Bir hane resmi bloğu: yükleme + yerleşim kaydırıcıları (yatay/dikey konum, yakınlaştırma) +
     * tek haneyi büyük gösteren canlı önizleme.
     */
    private static function pointImageBlock(string $kind, string $label, string $tone): Forms\Components\Group
    {
        $slider = fn (string $key, string $lbl, int $min, int $max, int $def, string $help) => Forms\Components\TextInput::make("point_image_fit.$kind.$key")
            ->label(fn (Get $get) => $lbl.' · %'.(int) round((float) ($get("point_image_fit.$kind.$key") ?? $def)))
            ->type('range')
            ->extraInputAttributes(['min' => $min, 'max' => $max, 'step' => 1, 'style' => 'padding:0;accent-color:#a83a2b'])
            ->default($def)
            ->helperText($help)
            ->live(debounce: 120)
            ->visible(fn (Get $get) => filled($get("point_image_$kind")));

        return Forms\Components\Group::make([
            self::pointImage("point_image_$kind", $label),
            Forms\Components\Grid::make(['default' => 1])->schema([
                Forms\Components\Placeholder::make("point_preview_$kind")
                    ->label('Haneye yerleştir')
                    ->content(fn (Get $get) => new HtmlString(view('filament.board-design.point-cropper', [
                        'img' => self::previewImage($get("point_image_$kind")),
                        'fit' => self::fitState($get, $kind),
                        'color' => $get("colors.$tone"),
                        'kind' => $kind,
                    ])->render())),
                // İnce ayar (kırpıcıyla senkron)
                Forms\Components\Group::make([
                    $slider('x', 'Yatay konum', 0, 100, 50, 'Sola ← → sağa'),
                    $slider('y', 'Dikey konum', 0, 100, 50, 'Yukarı ↑ ↓ aşağı'),
                    $slider('zoom', 'Yakınlaştırma', 100, 400, 100, '%100 = haneyi tam kaplar'),
                ]),
            ]),
        ]);
    }

    /**
     * Tam resim modu: 24 hane, dört çeyrek bölüm (her biri 6 hane). Her hanede yükleme + kırpıcı.
     * @return array<Forms\Components\Section>
     */
    private static function eachPointSections(): array
    {
        $quarters = [
            'Alt sağ (1–6) — beyazın evi' => range(1, 6),
            'Alt sol (7–12)' => range(7, 12),
            'Üst sol (13–18)' => range(13, 18),
            'Üst sağ (19–24) — siyahın evi' => range(19, 24),
        ];
        $out = [];
        foreach ($quarters as $title => $nums) {
            $out[] = Forms\Components\Section::make($title)
                ->collapsible()
                ->compact()
                ->schema(array_map(fn (int $n) => Forms\Components\Group::make([
                    Forms\Components\FileUpload::make("point_images.$n")
                        ->label("Hane $n")
                        ->image()
                        ->disk('uploads')->directory('tahta')->visibility('public')
                        ->maxSize(4096)
                        ->imageEditor()
                        ->live(),
                    Forms\Components\Placeholder::make("point_each_preview_$n")
                        ->hiddenLabel()
                        ->content(fn (Get $get) => new HtmlString(view('filament.board-design.point-cropper', [
                            'img' => self::previewImage($get("point_images.$n")),
                            'fit' => self::fitStateEach($get, $n),
                            'color' => $get($n % 2 ? 'colors.a' : 'colors.b'),
                            'kind' => 'p'.$n,
                            'maxWidth' => 110,
                            'compact' => true,
                        ])->render()))
                        ->visible(fn (Get $get) => filled($get("point_images.$n"))),
                    // Kırpıcının yazdığı yerleşim (kaydedilsin diye formda gizli alan)
                    Forms\Components\Hidden::make("point_image_fit.p$n.x")->default(50),
                    Forms\Components\Hidden::make("point_image_fit.p$n.y")->default(50),
                    Forms\Components\Hidden::make("point_image_fit.p$n.zoom")->default(100),
                ]), $nums))
                ->columns(['default' => 2, 'md' => 3])
                ->visible(fn (Get $get) => $get('point_mode') === 'each');
        }

        return $out;
    }

    public static function fitStateEach(Get $get, int $n): array
    {
        $f = BoardDesign::clampFit((array) ($get("point_image_fit.p$n") ?? []));
        $aspect = self::imageAspect($get("point_images.$n"));
        if ($aspect) {
            $f['aspect'] = $aspect;
        }

        return $f;
    }

    /** @return array<int,string> hane no => önizleme URL'si */
    public static function eachPreviewImages(Get $get): array
    {
        $out = [];
        for ($n = 1; $n <= 24; $n++) {
            $u = self::previewImage($get("point_images.$n"));
            if ($u) {
                $out[$n] = $u;
            }
        }

        return $out;
    }

    /** @return array<int,array> hane no => yerleşim */
    public static function eachPreviewFits(Get $get): array
    {
        $out = [];
        for ($n = 1; $n <= 24; $n++) {
            if (filled($get("point_images.$n"))) {
                $out[$n] = self::fitStateEach($get, $n);
            }
        }

        return $out;
    }

    /** Formdaki yerleşim değerleri + resmin en-boy oranı (yeni yüklenen ya da kayıtlı dosyadan). */
    public static function fitState(Get $get, string $kind): array
    {
        $f = BoardDesign::clampFit((array) ($get("point_image_fit.$kind") ?? []));
        $aspect = self::imageAspect($get("point_image_$kind"));
        if ($aspect) {
            $f['aspect'] = $aspect;
        }

        return $f;
    }

    public static function imageAspect(mixed $state): ?float
    {
        if (is_array($state)) {
            $state = reset($state) ?: null;
        }
        try {
            $abs = $state instanceof \Livewire\Features\SupportFileUploads\TemporaryUploadedFile
                ? $state->getRealPath()
                : (is_string($state) && $state !== '' ? \Illuminate\Support\Facades\Storage::disk('uploads')->path($state) : null);
            $size = $abs ? @getimagesize($abs) : false;

            return $size && $size[1] > 0 ? round($size[0] / $size[1], 4) : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** Form durumundaki resmi önizleme için URL'ye çevir (yeni yüklenen geçici dosya -> data URI). */
    public static function previewImage(mixed $state): ?string
    {
        if (is_array($state)) {
            $state = reset($state) ?: null;
        }
        if ($state instanceof \Livewire\Features\SupportFileUploads\TemporaryUploadedFile) {
            try {
                $mime = $state->getMimeType();
                if (! in_array($mime, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], true) || $state->getSize() > 4 * 1024 * 1024) {
                    return null;
                }

                // Livewire'ın imzalı önizleme adresi: resim HTML'e GÖMÜLMEZ (base64 her hane/önizleme için
                // tekrarlanınca canlıda her kaydırıcı hareketinde yanıt onlarca MB oluyor, güncelleme
                // takılıyordu). Adres üretilemezse küçük dosyada base64'e düş.
                try {
                    return (string) $state->temporaryUrl();
                } catch (\Throwable) {
                    if ($state->getSize() > 150 * 1024) {
                        return null;
                    }
                }

                return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($state->getRealPath()));
            } catch (\Throwable) {
                return null;
            }
        }

        return is_string($state) && $state !== '' ? BoardDesign::imageUrl($state) : null;
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
            Forms\Components\Grid::make(['default' => 1, 'lg' => 5])->schema([
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
                                ->live()
                                ->label('Zemin dokusu')
                                ->options(BoardDesign::SURFACES)
                                ->placeholder('Düz')
                                ->disabled(fn (?BoardDesign $record) => $record && ! $record->is_custom),
                            Forms\Components\Select::make('checker_style')
                                ->live()
                                ->label('Pul stili')
                                ->options(BoardDesign::CHECKER_STYLES)
                                ->placeholder('Düz')
                                ->disabled(fn (?BoardDesign $record) => $record && ! $record->is_custom),
                        ])->columns(2),
                    Forms\Components\Section::make('Tahta Zemin Resmi')
                        ->description('İsteğe bağlı. Sol ve sağ yarı için AYRI resim; üçgenlerin ALTINDA zemin olur (renge alternatif). Şeffaflıkla zemin rengi görünür kalır.')
                        ->schema([
                            Forms\Components\Grid::make(['default' => 1, 'sm' => 2])->schema([
                                Forms\Components\FileUpload::make('surface_image_left')
                                    ->label('Sol yarı resmi')->image()
                                    ->disk('uploads')->directory('tahta')->visibility('public')
                                    ->maxSize(4096)->imageEditor()->live(),
                                Forms\Components\FileUpload::make('surface_image_right')
                                    ->label('Sağ yarı resmi')->image()
                                    ->disk('uploads')->directory('tahta')->visibility('public')
                                    ->maxSize(4096)->imageEditor()->live(),
                            ]),
                            Forms\Components\TextInput::make('surface_image_opacity')
                                ->label(fn (Get $get) => 'Şeffaflık · %'.(int) ($get('surface_image_opacity') ?? 100))
                                ->type('range')
                                ->extraInputAttributes(['min' => 0, 'max' => 100, 'step' => 1, 'style' => 'padding:0;accent-color:#a83a2b'])
                                ->default(100)
                                ->helperText('%100 = tam görünür; düşürdükçe altındaki zemin rengi görünür.')
                                ->live(debounce: 120)
                                ->visible(fn (Get $get) => filled($get('surface_image_left')) || filled($get('surface_image_right'))),
                        ])
                        ->visible(fn (?BoardDesign $record) => ! $record || $record->is_custom),
                    Forms\Components\Section::make('Hane Resimleri')
                        ->description('İsteğe bağlı. Resim hane üçgenine kırpılır; boş hanede hane rengi kullanılır.')
                        ->schema([
                            Forms\Components\ToggleButtons::make('point_mode')
                                ->label('Resim modu')
                                ->options(['pair' => 'Tek / çift haneler (2 resim)', 'each' => 'Tam resim — her haneye ayrı (24 resim)'])
                                ->icons(['pair' => 'heroicon-o-squares-2x2', 'each' => 'heroicon-o-photo'])
                                ->default('pair')
                                ->inline()
                                ->live()
                                ->columnSpanFull(),
                            Forms\Components\Grid::make(['default' => 1, 'xl' => 2])->schema([
                                self::pointImageBlock('odd', 'Tek haneler için resim', 'a'),
                                self::pointImageBlock('even', 'Çift haneler için resim', 'b'),
                            ])->visible(fn (Get $get) => $get('point_mode') !== 'each'),
                            ...self::eachPointSections(),
                        ])
                        ->visible(fn (?BoardDesign $record) => ! $record || $record->is_custom),
                    Forms\Components\Section::make('Hane Yazıları')
                        ->description('İsteğe bağlı. Her hanenin üçgenine basılan kısa metin (maks 24 karakter). Oto beyaz + dış hat, ortalı, boyut üçgene göre ölçeklenir.')
                        ->collapsible()
                        ->collapsed()
                        ->schema(array_map(fn (int $n) => Forms\Components\TextInput::make("point_texts.$n")
                            ->label("Hane $n")
                            ->maxLength(24), range(1, 24)))
                        ->columns(['default' => 2, 'md' => 4])
                        ->visible(fn (?BoardDesign $record) => ! $record || $record->is_custom),
                ])->columnSpan(['lg' => 3]),
                Forms\Components\Section::make('Önizleme')->schema([
                    Forms\Components\Placeholder::make('preview')
                        ->hiddenLabel()
                        ->content(fn (Get $get) => new HtmlString(view('filament.board-design.preview-zoom', [
                            'colors' => $get('colors'),
                            'surface' => $get('surface'),
                            'checkerStyle' => $get('checker_style'),
                            'surfLeft' => self::previewImage($get('surface_image_left')),
                            'surfRight' => self::previewImage($get('surface_image_right')),
                            'surfOpacity' => (int) ($get('surface_image_opacity') ?? 100),
                            'texts' => $get('point_texts'),
                            'imgOdd' => $get('point_mode') === 'each' ? null : self::previewImage($get('point_image_odd')),
                            'imgEven' => $get('point_mode') === 'each' ? null : self::previewImage($get('point_image_even')),
                            'fitOdd' => self::fitState($get, 'odd'),
                            'fitEven' => self::fitState($get, 'even'),
                            'pointImgs' => $get('point_mode') === 'each' ? self::eachPreviewImages($get) : null,
                            'pointFits' => $get('point_mode') === 'each' ? self::eachPreviewFits($get) : null,
                            'width' => 640,
                            'hint' => true,
                        ])->render())),
                ])->columnSpan(['lg' => 2])->extraAttributes(['style' => 'position:sticky;top:5rem;align-self:start']),
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
