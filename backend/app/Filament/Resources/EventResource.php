<?php

namespace App\Filament\Resources;

use App\Filament\Resources\EventResource\Pages;
use App\Models\Content;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Tavla Takvimi: Content modelinin type='event' kayitlari icin ayri yonetim sayfasi.
 */
class EventResource extends Resource
{
    protected static ?string $model = Content::class;

    protected static ?string $slug = 'takvim';

    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationLabel = 'Tavla Takvimi';

    protected static ?string $modelLabel = 'etkinlik';

    protected static ?string $pluralModelLabel = 'Tavla Takvimi';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 1;

    // Turkiye'nin 81 ili (plaka sirasi).
    public const PROVINCES = [
        'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
        'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
        'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
        'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
        'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
        'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
        'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
        'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak',
        'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan',
        'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
    ];

    // KKTC (Kuzey Kibris) illeri.
    public const KKTC_PROVINCES = [
        'Lefkoşa', 'Gazimağusa', 'Girne', 'Güzelyurt', 'İskele', 'Lefke',
    ];

    public const COUNTRIES = [
        'Türkiye' => 'Türkiye',
        'KKTC' => 'KKTC (Kuzey Kıbrıs)',
    ];

    /** Secili ulkeye gore il secenekleri (KKTC -> 6 il, aksi halde Turkiye 81 il). */
    public static function provinceOptions(?string $country): array
    {
        $list = $country === 'KKTC' ? self::KKTC_PROVINCES : self::PROVINCES;
        return array_combine($list, $list);
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'event');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('event'),
            Forms\Components\TextInput::make('title')->label('Etkinlik adı')->required()->columnSpanFull(),
            Forms\Components\DateTimePicker::make('event_at')->label('Başlangıç tarihi & saat')
                ->required()
                ->live(onBlur: true)
                // Baslangic secilince/degisince Bitis bossa onunla doldur (baslangic secili gelir).
                ->afterStateUpdated(fn ($state, Forms\Set $set, Forms\Get $get) => filled($state) && blank($get('event_end'))
                    ? $set('event_end', $state)
                    : null),
            Forms\Components\DateTimePicker::make('event_end')
                ->label('Bitiş tarihi (çok günlü ise)')
                ->helperText('Başlangıçla aynı gelir; çok günlü turnuvada bitiş gününü ileri al. Takvimde başlangıç–bitiş arası tüm günler işaretlenir.')
                ->afterOrEqual('event_at')
                // Kayit acilirken Bitis bossa baslangicla doldur -> alan acildiginda baslangic secili gelir.
                ->afterStateHydrated(fn ($state, Forms\Set $set, Forms\Get $get) => blank($state) && filled($get('event_at'))
                    ? $set('event_end', $get('event_at'))
                    : null),
            // Ulke once secilir; il listesi ulkeye gore degisir (Turkiye 81 / KKTC 6).
            Forms\Components\Select::make('country')->label('Ülke')
                ->options(self::COUNTRIES)->default('Türkiye')->required()->live()
                // Ulke degisince onceki ulkenin ili gecersiz kalmasin.
                ->afterStateUpdated(fn (Forms\Set $set) => $set('province', null)),
            Forms\Components\Select::make('province')->label('İl')
                ->options(fn (Forms\Get $get) => self::provinceOptions($get('country')))
                ->searchable(),
            // Duzenleyen: Kurumlar (Content type='kurum') arasindan secilir; deger kurum ADI
            // olarak saklanir (frontend organizer string'ini gosterir). Mevcut kayitlar isim
            // birebir tuttugu icin otomatik eslesir. Yeni kurumu Kurumlar sayfasindan eklersin.
            Forms\Components\Select::make('organizer')->label('Düzenleyen')
                ->options(fn () => Content::query()->where('type', 'kurum')
                    ->orderBy('title')->pluck('title', 'title')->all())
                ->searchable()
                ->helperText('Kurumlar sayfasındaki listeden seçilir. Boş bırakılabilir.'),
            // Otel: Oteller (Content type='otel') listesinden secilir; deger otel ADI olarak
            // saklanir. Etkinlik takviminde bu ada gore otelin gorseli + adi gosterilir.
            // Resimler otel kaydina yuklenir; burada sadece secim yapilir.
            Forms\Components\Select::make('hotel')->label('Otel')
                ->options(fn () => Content::query()->where('type', 'otel')
                    ->orderBy('title')->pluck('title', 'title')->all())
                ->searchable()
                ->helperText('Oteller sayfasındaki listeden seçilir. Resimler otel kaydına yüklenir. Boş bırakılabilir.'),
            // Cok kisili iletisim: her satir kisi adi + cep telefonu
            Forms\Components\Repeater::make('contacts')->label('İletişim (kişiler)')
                ->schema([
                    Forms\Components\TextInput::make('name')->label('Kişi adı')->required(),
                    Forms\Components\TextInput::make('phone')->label('Cep telefonu')
                        ->tel()->mask('999 9999999')->placeholder('532 1111111')->required(),
                ])
                ->columns(2)
                ->addActionLabel('Kişi ekle')
                ->reorderable(false)
                ->columnSpanFull(),
            Forms\Components\Textarea::make('body')->label('Açıklama')->rows(4)->columnSpanFull(),
            // Görsel etkinlikte yok: takvimde seçilen OTELİN görseli gösterilir (Oteller sayfasına yüklenir).
            Forms\Components\Toggle::make('published')->label('Yayında')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('event_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('event_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
                Tables\Columns\TextColumn::make('title')->label('Etkinlik')->searchable()->limit(50),
                Tables\Columns\TextColumn::make('organizer')->label('Düzenleyen')->toggleable(),
                Tables\Columns\TextColumn::make('place')->label('Yer')->toggleable(),
                Tables\Columns\TextColumn::make('country')->label('Ülke')->toggleable(),
                Tables\Columns\TextColumn::make('province')->label('İl')->searchable()->toggleable(),
                // Otel: secili ise yesil rozet (otel adi), degilse kirmizi "Otel yok".
                Tables\Columns\TextColumn::make('hotel')->label('Otel')->badge()
                    ->getStateUsing(fn ($record) => filled($record->hotel) ? $record->hotel : 'Otel yok')
                    ->color(fn ($state) => $state === 'Otel yok' ? 'danger' : 'success')
                    ->searchable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
            ])
            ->filters([
                // Otel secili olan / olmayan etkinlikleri ayikla.
                Tables\Filters\TernaryFilter::make('hotel')
                    ->label('Otel durumu')
                    ->placeholder('Hepsi')
                    ->trueLabel('Otel seçili')
                    ->falseLabel('Otel seçili değil')
                    ->queries(
                        true: fn ($query) => $query->whereNotNull('hotel')->where('hotel', '!=', ''),
                        false: fn ($query) => $query->where(fn ($q) => $q->whereNull('hotel')->orWhere('hotel', '')),
                        blank: fn ($query) => $query,
                    ),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListEvents::route('/'),
            'create' => Pages\CreateEvent::route('/create'),
            'edit' => Pages\EditEvent::route('/{record}/edit'),
        ];
    }
}
