<?php

namespace App\Filament\Resources;

use App\Filament\Resources\InfoPageResource\Pages;
use App\Models\InfoPage;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Bilgi Sayfalari: yalnizca DUZENLENEBILIR sekmeler (Hakkinda + Hizmetler).
 *  Rutbeler/Puanlama/Basarilarim/Adil Zar canli bilesendir (frontend), panelde yok. */
class InfoPageResource extends Resource
{
    protected static ?string $model = InfoPage::class;

    // Duzenlenebilir metin sayfalari: Bilgi sekmeleri + HUKUKI + SEO + admin-eklemeli ozel
    // sayfalar. Yalnizca CANLI bilesen sekmeleri (rutbeler/puanlama/basarilarim/adil-zar)
    // gizli — boylece panelden eklenen yeni sayfalar listede otomatik gorunur.
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->whereNotIn('slug', InfoPage::LIVE_COMPONENT_SLUGS);
    }

    protected static ?string $slug = 'bilgi-sayfalari';

    protected static ?string $navigationIcon = 'heroicon-o-information-circle';

    protected static ?string $navigationLabel = 'Bilgi Sayfaları';

    protected static ?string $modelLabel = 'bilgi sayfası';

    protected static ?string $pluralModelLabel = 'Bilgi Sayfaları';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 1;

    // Ust baslik secenekleri, KAYNAGA gore (adim 2). Anahtarlar = bare key; secimde
    // "<kaynak>:<key>" olarak birlestirilir (or. footer:game). ANAHTARLAR frontend ile birebir
    // (App.tsx footerColumns + pages.ts MENU_GROUP_ORDER).
    public const SECTION_PICKS = [
        'footer' => [
            'game' => 'Oyun',
            'community' => 'Topluluk',
            'content' => 'İçerik',
            'guide' => 'Eğitim',
            'organization' => 'Organizasyon',
            'info' => 'Bilgi',
            'legal' => 'Yasal',
        ],
        'menu' => [
            'play' => 'Oyna',
            'compete' => 'Turnuvalar',
            'fun' => 'Eğlence',
            'content' => 'Keşfet',
            'tools' => 'Araçlar',
            'account' => 'Hesap',
            'info' => 'Bilgi',
        ],
    ];

    public static function form(Form $form): Form
    {
        return $form->schema([
            // --- Ust baslik: IKI ADIM. (1) Kaynak: Footer mu Sol menu mu? (2) O kaynaktan baslik.
            //     Secim "section" (gizli, gercek kolon) icinde "<kaynak>:<key>" olarak birlesir.
            //     section_source/section_pick DB kolonu DEGIL (dehydrated false); edit'te section'dan cozulur.
            Forms\Components\Select::make('section_source')
                ->label('1) Nerede görünsün?')
                ->options(['footer' => 'Footer (alt menü)', 'menu' => 'Sol menü'])
                ->live()
                ->dehydrated(false)
                ->placeholder('Hiçbir yerde listeleme (yalnız doğrudan adres)')
                ->helperText('Sayfa footer kolonunda mı yoksa sol menü grubunda mı listelensin? Boş = menüde/footer\'da çıkmaz.')
                ->afterStateHydrated(fn (Forms\Set $set, ?InfoPage $record) => $set(
                    'section_source',
                    $record?->section ? explode(':', $record->section, 2)[0] : null,
                ))
                ->afterStateUpdated(function (Forms\Set $set) {
                    $set('section_pick', null);
                    $set('section', null);
                })
                ->columnSpanFull(),
            Forms\Components\Select::make('section_pick')
                ->label('2) Üst başlık')
                ->options(fn (Forms\Get $get) => self::SECTION_PICKS[$get('section_source')] ?? [])
                ->visible(fn (Forms\Get $get) => (bool) $get('section_source'))
                ->live()
                ->dehydrated(false)
                ->searchable()
                ->placeholder('Başlık seç')
                ->helperText('Seçtiğin başlığın altında /bilgi/<adres> bağlantısı olarak görünür.')
                ->afterStateHydrated(fn (Forms\Set $set, ?InfoPage $record) => $set(
                    'section_pick',
                    ($record?->section && str_contains($record->section, ':')) ? explode(':', $record->section, 2)[1] : null,
                ))
                ->afterStateUpdated(fn (Forms\Set $set, $state, Forms\Get $get) => $set(
                    'section',
                    $state ? $get('section_source').':'.$state : null,
                ))
                ->columnSpanFull(),
            Forms\Components\Hidden::make('section'), // gercek DB kolonu; yukaridaki iki adimdan doldurulur
            Forms\Components\TextInput::make('slug')
                ->label('Adres (slug)')
                ->required()
                ->maxLength(120)
                ->helperText('Örn: "ekibimiz" → /bilgi/ekibimiz. Sadece küçük harf, rakam ve tire. Sonradan değiştirilemez.')
                ->visibleOn('create')
                ->columnSpanFull(),
            Forms\Components\TextInput::make('title')
                ->label('Başlık')
                ->helperText('Sayfa/sekme başlığı olarak kullanılır.')
                ->required()
                ->columnSpanFull(),
            Forms\Components\TextInput::make('seo_title')
                ->label('SEO Başlığı (opsiyonel)')
                ->maxLength(160)
                ->helperText('Arama sonuçlarında ve sekme başlığında görünür. Boşsa başlık kullanılır. (Özellikle hukuki sayfalar için.)')
                ->columnSpanFull(),
            Forms\Components\Textarea::make('seo_description')
                ->label('SEO Açıklaması (opsiyonel)')
                ->maxLength(320)->rows(2)
                ->helperText('Arama sonuçlarındaki kısa açıklama (meta description).')
                ->columnSpanFull(),
            \FilamentTiptapEditor\TiptapEditor::make('body')
                ->label('İçerik')
                ->profile('default') // gelişmiş: tablo, renk, hizalama, medya, kaynak kodu
                // Satır içi resimler public/uploads/bilgi altına -> <img src="/uploads/bilgi/..">
                ->disk('uploads')
                ->directory('bilgi')
                ->visibility('public')
                ->helperText('Biçimlendirilmiş metin — /bilgi/<sayfa> içeriği olarak gösterilir. Medya butonu ile metnin içine resim/tablo ekleyebilirsin.')
                ->columnSpanFull(),
            Forms\Components\FileUpload::make('gallery')->label('Resim galerisi (varsayılan)')
                ->image()->multiple()->reorderable()->appendFiles()
                ->disk('uploads')->directory('bilgi')->visibility('public')
                ->optimizeOnUpload('bilgi')
                ->maxSize(12288)->panelLayout('grid')
                ->helperText('Varsayılan galeri. İçeriğin altında gösterilir; tıklayınca büyür (lightbox). İpucu: metinde <resimgalerisi> yazarsan tam o noktada çıkar (yoksa en altta). Her resim en çok 12 MB — büyük resimler yüklenmez (sunucu PHP upload_max_filesize / post_max_size limitleri de en az bu kadar olmalı).')
                ->columnSpanFull(),
            Forms\Components\Repeater::make('galleries')
                ->label('İsimli galeriler')
                ->helperText('Birden fazla galeri oluşturabilirsin; her birine bir ad ver. İçerik metninde <ad> yazdığın yere o galeri gelir. Örn: ad "turnuvalar" → metinde <turnuvalar>.')
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->label('Galeri adı (etiket)')
                        ->required()
                        ->maxLength(40)
                        ->helperText('Sadece harf/rakam/tire kullan (örn: turnuvalar). Metinde <turnuvalar> ile çağır.'),
                    Forms\Components\FileUpload::make('images')
                        ->label('Resimler')
                        ->image()->multiple()->reorderable()->appendFiles()
                        ->disk('uploads')->directory('bilgi')->visibility('public')
                        ->optimizeOnUpload('bilgi')
                        ->maxSize(4096)->panelLayout('grid'),
                ])
                ->itemLabel(fn (array $state): ?string => ! empty($state['name']) ? ('<'.$state['name'].'>') : null)
                ->addActionLabel('Galeri ekle')
                ->reorderable()
                ->collapsible()
                ->defaultItems(0)
                ->columnSpanFull(),
            Forms\Components\TextInput::make('sort')->label('Sıra')->numeric()->default(0)
                ->helperText('Üst başlık seçtiysen: sayfanın o footer kolonu / sol menü grubu içindeki konumu. 0 = en üst, büyük sayı = aşağı.'),
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('sort')
            ->columns([
                Tables\Columns\TextColumn::make('title')->label('Başlık')->searchable(),
                Tables\Columns\TextColumn::make('slug')->label('Adres')
                    ->formatStateUsing(fn ($state) => (in_array($state, InfoPage::LEGAL_SLUGS, true)
                        || in_array($state, InfoPage::SEO_SLUGS, true))
                        ? '/'.$state // hukuki + SEO sayfalar kendi rotalarinda (/bilgi ONEKI YOK)
                        : '/bilgi/'.self::urlSlug($state))
                    ->badge(),
                Tables\Columns\TextColumn::make('sort')->label('Sıra')->sortable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                // Sil YALNIZ admin-eklemeli ozel sayfalar icin (sabit/tohumlu sayfalar korunur).
                Tables\Actions\DeleteAction::make()->label('Sil')
                    ->visible(fn (InfoPage $r) => ! in_array($r->slug, self::FIXED_SLUGS(), true)),
            ]);
    }

    // Tohumlu/sabit (silinemez) sayfa slug'lari. Bunlarin DISI = admin-eklemeli ozel sayfa.
    private static function FIXED_SLUGS(): array
    {
        return array_merge(InfoPage::INFO_TAB_SLUGS, InfoPage::LEGAL_SLUGS, InfoPage::SEO_SLUGS, InfoPage::LIVE_COMPONENT_SLUGS);
    }

    // Admin gosteriminde DB slug'ini Turkce URL slug'ina cevir (frontend ile ayni harita).
    private static function urlSlug(string $slug): string
    {
        return [
            'about' => 'hakkinda',
            'services' => 'hizmetler',
            'glossary' => 'sozluk',
            'ranks' => 'rutbeler',
            'scoring' => 'puanlama',
            'badges' => 'basarilarim',
            'fair' => 'adil-zar',
        ][$slug] ?? $slug;
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListInfoPages::route('/'),
            'create' => Pages\CreateInfoPage::route('/create'),
            'edit' => Pages\EditInfoPage::route('/{record}/edit'),
        ];
    }
}
