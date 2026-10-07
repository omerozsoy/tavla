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
use Illuminate\Support\Str;

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

    // IconName (frontend src/ui/Icon.tsx) -> Tabler svg slug (önizleme CDN'inden çekilir).
    // Yeni ikon eklenince hem burayı hem Icon.tsx MAP'ini güncelle.
    private const ICON_MAP = [
        'play' => 'player-play', 'live' => 'broadcast', 'trophy' => 'trophy', 'medal' => 'medal',
        'ranking' => 'rosette', 'coins' => 'coins', 'shop' => 'building-store', 'chart' => 'chart-bar',
        'users' => 'users', 'user-plus' => 'user-plus', 'analyze' => 'trending-up', 'dice' => 'dice-5',
        'settings' => 'settings', 'install' => 'download', 'flag' => 'flag', 'sun' => 'sun', 'moon' => 'moon',
        'book' => 'book', 'books' => 'books', 'zoom-question' => 'zoom-question', 'question-mark' => 'question-mark',
        'logout' => 'logout', 'home' => 'home', 'star' => 'star', 'credit-card' => 'credit-card', 'money' => 'cash',
        'gift' => 'gift', 'spinner-ball' => 'rotate-clockwise-2', 'slot' => 'cherry', 'volume' => 'volume',
        'mute' => 'volume-off', 'graduation' => 'school', 'bulb' => 'bulb', 'search' => 'search',
        'chat' => 'message-circle', 'user' => 'user', 'coin' => 'coins', 'banknotes' => 'cash', 'crown' => 'crown',
        'crown-simple' => 'crown', 'ticket' => 'ticket', 'bell' => 'bell', 'eye' => 'eye', 'check' => 'check',
        'checks' => 'checks', 'x' => 'x', 'pencil' => 'pencil', 'chevron' => 'chevron-down',
        'caret-left' => 'chevron-left', 'caret-right' => 'chevron-right', 'arrow-right' => 'arrow-right',
        'arrow-up' => 'arrow-up', 'calendar' => 'calendar', 'pin' => 'map-pin', 'phone' => 'phone',
        'whatsapp' => 'brand-whatsapp', 'refresh' => 'refresh', 'target' => 'target', 'globe' => 'world',
        'robot' => 'robot', 'robot-face' => 'robot-face', 'trash' => 'trash', 'dots-vertical' => 'dots-vertical',
        'ban' => 'ban', 'lock' => 'lock', 'camera' => 'camera', 'menu' => 'menu-2', 'maximize' => 'maximize',
        'minimize' => 'minimize', 'alert' => 'alert-triangle', 'calendar-dots' => 'calendar-event',
        'building-office' => 'building', 'building-community' => 'building-community', 'newspaper' => 'news',
        'briefcase' => 'briefcase', 'monitor-play' => 'brand-youtube', 'article' => 'article', 'palette' => 'palette',
        'warning-circle' => 'alert-circle', 'wifi' => 'wifi', 'wifi-off' => 'wifi-off', 'chart-line' => 'chart-line',
        'info' => 'info-circle', 'smiley' => 'mood-smile', 'paper-plane-right' => 'send', 'shield-check' => 'shield-check',
        'clock' => 'clock', 'lock-key' => 'lock-access', 'lock-open' => 'lock-open', 'fingerprint' => 'fingerprint',
        'package' => 'package', 'cart' => 'shopping-cart', 'tag' => 'tag', 'code' => 'code', 'copy' => 'copy',
        'bank' => 'building-bank', 'file-magnifying-glass' => 'file-search', 'die-1' => 'dice-1', 'die-2' => 'dice-2',
        'die-3' => 'dice-3', 'die-4' => 'dice-4', 'die-5' => 'dice-5', 'die-6' => 'dice-6', 'flame' => 'flame',
        'instagram' => 'brand-instagram', 'youtube' => 'brand-youtube', 'mail' => 'mail', 'smiley-sad' => 'mood-sad',
        'megaphone' => 'speakerphone', 'sword' => 'sword', 'heart' => 'heart', 'chart-bar-popular' => 'chart-bar',
    ];

    private const ICON_CDN = 'https://cdn.jsdelivr.net/npm/@tabler/icons@3.48.0/icons/outline';

    /** Select seçeneği: Tabler svg önizleme + IconName (allowHtml). */
    private static function iconOptionHtml(string $name, string $slug): string
    {
        $src = self::ICON_CDN.'/'.$slug.'.svg';

        return '<span style="display:inline-flex;align-items:center;gap:.5rem">'
            .'<img src="'.e($src).'" alt="" width="18" height="18" style="flex:none" loading="lazy">'
            .'<span>'.e($name).'</span></span>';
    }

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
                ->live(onBlur: true) // ad girilince/blur -> hedefi otomatik türet
                ->afterStateUpdated(function (Forms\Set $set, Forms\Get $get, ?string $state): void {
                    // Hedefi addan OTOMATİK üret: "/türkçe-ad" -> "/turkce-ad". Yalnız hedef BOŞ ise
                    // ya da otomatik değerin AYNISIysa güncelle -> admin elle bir dış URL/rota
                    // yazdıysa (href otomatikten farklıysa) DOKUNMA (ezmeyelim).
                    $current = trim((string) $get('href'));
                    $auto = $state ? '/'.Str::slug($state) : '';
                    if ($current === '' || $current === $get('_href_auto')) {
                        $set('href', $auto);
                        $set('_href_auto', $auto); // en son otomatik değeri hatırla (elle değişikliği ayırt et)
                    }
                }),
            Forms\Components\Hidden::make('_href_auto')->dehydrated(false), // yalnız otomatik-üretim izleme (kaydedilmez)
            Forms\Components\TextInput::make('href')
                ->label('Hedef (URL veya rota)')
                ->required()
                ->maxLength(300)
                ->placeholder('/turnuvalar  veya  https://ornek.com')
                ->helperText('Menü adından otomatik üretilir; istersen değiştir. İç sayfa için "/" ile başlayan rota (ör. /turnuva-takvimi); dış site için https:// (yeni sekmede açılır).'),
            Forms\Components\Select::make('group')
                ->label('Grup')
                ->options($groupOptions)
                ->required()
                ->native(false),
            Forms\Components\Select::make('icon')
                ->label('İkon')
                ->options(collect(self::ICON_MAP)->map(fn ($slug, $name) => self::iconOptionHtml($name, $slug))->all())
                ->allowHtml() // seçenekte Tabler svg önizlemesi göster
                ->searchable()
                ->placeholder('Otomatik (hedeften türet)')
                ->helperText('Menüde görünecek ikon. Boş bırakılırsa hedef sayfanın ikonu (yoksa ok) kullanılır.'),
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
