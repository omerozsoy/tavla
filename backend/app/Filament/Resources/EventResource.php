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

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'event');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Hidden::make('type')->default('event'),
            Forms\Components\TextInput::make('title')->label('Etkinlik adı')->required()->columnSpanFull(),
            Forms\Components\DateTimePicker::make('event_at')->label('Tarih & saat')->required(),
            Forms\Components\Select::make('province')->label('İl')
                ->options(array_combine(self::PROVINCES, self::PROVINCES))
                ->searchable(),
            Forms\Components\TextInput::make('organizer')->label('Düzenleyen'),
            Forms\Components\TextInput::make('place')->label('Yer / adres')->columnSpanFull(),
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
            // Görsel: bilgisayardan resim seç (public/uploads/takvim altina yuklenir)
            Forms\Components\FileUpload::make('image')->label('Görsel')
                ->image()->disk('uploads')->directory('takvim')->visibility('public')
                ->imageEditor()->maxSize(5120)
                ->columnSpanFull(),
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
                Tables\Columns\TextColumn::make('province')->label('İl')->searchable()->toggleable(),
                Tables\Columns\IconColumn::make('published')->label('Yayında')->boolean(),
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
