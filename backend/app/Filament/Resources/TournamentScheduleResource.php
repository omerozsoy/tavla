<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentScheduleResource\Pages;
use App\Models\Tournament;
use App\Models\TournamentSchedule;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * PERİYODİK TURNUVA: haftanın seçilen günlerinde gece 00:00'da otomatik turnuva kuran şablon.
 * Form alanları TournamentResource ile birebir (katılımcı/ağaç/şampiyon/durum hariç) + haftanın
 * günleri (weekdays) ve başlangıç saati (start_time = register_until saati). Kuran komut:
 * tournaments:create-scheduled (routes/console.php -> dailyAt('00:00')).
 */
class TournamentScheduleResource extends Resource
{
    protected static ?string $model = TournamentSchedule::class;

    protected static ?string $navigationIcon = 'heroicon-o-calendar-days';

    protected static ?string $navigationLabel = 'Periyodik Turnuva';

    protected static ?string $modelLabel = 'periyodik turnuva';

    protected static ?string $pluralModelLabel = 'Periyodik Turnuvalar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 3;

    public const WEEKDAYS = [
        1 => 'Pazartesi', 2 => 'Salı', 3 => 'Çarşamba', 4 => 'Perşembe',
        5 => 'Cuma', 6 => 'Cumartesi', 7 => 'Pazar',
    ];

    private static function lengthOptions(): array
    {
        $out = [];
        foreach (Tournament::LENGTHS as $n) {
            $out[$n] = $n === 1 ? 'Tek oyun (1 puan)' : $n.' puan';
        }

        return $out;
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->label('Turnuva adı')
                    ->helperText('Kurulan turnuvanın adı. Sonuna otomatik tarih eklenir (ör. "Cuma Akşamı — 24.10.2026").')
                    ->required(),
                Forms\Components\Toggle::make('active')
                    ->label('Aktif (çalışsın)')
                    ->helperText('Kapatınca bu şablondan otomatik turnuva KURULMAZ (silinmez, duraklatılır).')
                    ->default(true),
                Forms\Components\CheckboxList::make('weekdays')
                    ->label('Hangi günler kurulsun')
                    ->helperText('Seçilen her gün gece 00:00\'da bu şablondan bir turnuva kurulur. Farklı günlere farklı saat istersen ayrı şablon oluştur.')
                    ->options(self::WEEKDAYS)
                    ->columns(3)
                    ->required(),
                Forms\Components\TimePicker::make('start_time')
                    ->label('Başlangıç saati (son katılım)')
                    ->helperText('Turnuva o gün bu saatte (Türkiye saati) otomatik başlar. Gün boyu kayıt açık kalır.')
                    ->seconds(false)
                    ->native(false)
                    ->required(),
                Forms\Components\Select::make('type')
                    ->label('Turnuva tipi')
                    ->options(Tournament::TYPES)
                    ->required()
                    ->default('bracket'),
                Forms\Components\TextInput::make('venue')
                    ->label('Düzenlenme yeri / Otel')
                    ->maxLength(160),
                Forms\Components\Select::make('organizer_id')
                    ->label('Düzenleyen kurum')
                    ->relationship('organizer', 'title', fn (Builder $query) => $query->where('type', 'kurum')->orderBy('title'))
                    ->searchable()
                    ->preload()
                    ->nullable(),
                Forms\Components\Select::make('size')
                    ->label('Kapasite (kişi)')
                    ->options([0 => 'Sınırsız (katılana göre)', 4 => '4', 8 => '8', 16 => '16', 32 => '32', 64 => '64', 128 => '128', 256 => '256'])
                    ->required()
                    ->default(8),
                Forms\Components\Select::make('match_length')
                    ->label('Maçlar kaç puanlık')
                    ->options(self::lengthOptions())
                    ->required()
                    ->default(1),
                Forms\Components\Select::make('semi_length')
                    ->label('Yarı final kaç puanlık')
                    ->options(self::lengthOptions())
                    ->placeholder('Normal turlarla aynı')
                    ->nullable(),
                Forms\Components\Select::make('final_length')
                    ->label('Final kaç puanlık')
                    ->options(self::lengthOptions())
                    ->placeholder('Normal turlarla aynı')
                    ->nullable(),
                Forms\Components\TextInput::make('round_minutes')
                    ->label('Maç süresi (dk)')
                    ->numeric()->integer()->minValue(1)->maxValue(180)
                    ->suffix('dk')
                    ->nullable(),
                Forms\Components\TextInput::make('semi_minutes')
                    ->label('Yarı final süresi (dk)')
                    ->placeholder('Normal turlarla aynı')
                    ->numeric()->integer()->minValue(1)->maxValue(180)
                    ->suffix('dk')
                    ->nullable(),
                Forms\Components\TextInput::make('final_minutes')
                    ->label('Final süresi (dk)')
                    ->placeholder('Normal turlarla aynı')
                    ->numeric()->integer()->minValue(1)->maxValue(180)
                    ->suffix('dk')
                    ->nullable(),
                Forms\Components\TextInput::make('prize_coins')
                    ->label('Ödül havuzu (coin)')
                    ->helperText('Başlangıç havuzu. Giriş ücretleri turnuva süresince buna eklenir.')
                    ->required()->numeric()->minValue(0)->default(0),
                Forms\Components\Repeater::make('prizes')
                    ->label('Ödül tablosu (sıraya göre)')
                    ->helperText('Her satır bir sıralamadır: 1. satır = 1.’lik … Turnuva bitince coin otomatik dağıtılır.')
                    ->schema([
                        Forms\Components\TextInput::make('coins')
                            ->label('Coin')->numeric()->minValue(0)->default(0)->required(),
                        Forms\Components\TextInput::make('desc')
                            ->label('Açıklama (opsiyonel)')
                            ->placeholder('ör. Star üyelik 1 ay')
                            ->maxLength(120),
                    ])
                    ->columns(2)
                    ->reorderable()
                    ->cloneable()
                    ->defaultItems(0)
                    ->addActionLabel('Sıra ekle')
                    ->itemLabel(fn (array $state): ?string => isset($state['coins']) ? ($state['coins'].' coin') : null)
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('prize_desc')
                    ->label('Genel ödül notu (opsiyonel)')
                    ->maxLength(120)
                    ->columnSpanFull(),
                Forms\Components\Toggle::make('premium_only')
                    ->label('Sadece Premium üyeler katılabilir')
                    ->default(true),
                Forms\Components\TextInput::make('entry_fee')
                    ->label('Giriş ücreti (coin)')
                    ->helperText('0 = ücretsiz. Toplanan ücretler ödül havuzuna eklenir.')
                    ->required()->numeric()->minValue(0)->default(0),
                Forms\Components\Select::make('creator_id')
                    ->label('Oluşturan')
                    ->relationship('creator', 'nickname')
                    ->searchable()
                    ->preload()
                    ->default(fn () => auth()->id()),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\IconColumn::make('active')
                    ->label('Aktif')
                    ->boolean(),
                Tables\Columns\TextColumn::make('name')
                    ->label('Ad')
                    ->searchable(),
                Tables\Columns\TextColumn::make('weekdays')
                    ->label('Günler')
                    ->formatStateUsing(fn ($state) => collect(is_array($state) ? $state : [])
                        ->map(fn ($d) => self::WEEKDAYS[(int) $d] ?? $d)
                        ->implode(', ')),
                Tables\Columns\TextColumn::make('start_time')
                    ->label('Saat'),
                Tables\Columns\TextColumn::make('type')
                    ->label('Tip')
                    ->formatStateUsing(fn ($state) => Tournament::TYPES[$state] ?? $state),
                Tables\Columns\TextColumn::make('entry_fee')
                    ->label('Giriş')
                    ->suffix(' coin'),
                Tables\Columns\TextColumn::make('last_created_on')
                    ->label('Son kurulum')
                    ->date('d.m.Y')
                    ->placeholder('—'),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTournamentSchedules::route('/'),
            'create' => Pages\CreateTournamentSchedule::route('/create'),
            'edit' => Pages\EditTournamentSchedule::route('/{record}/edit'),
        ];
    }
}
