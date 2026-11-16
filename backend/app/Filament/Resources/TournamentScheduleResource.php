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

    /** Saat seçenekleri 00:00..23:45 (15 dk adım). Aranabilir Select -> buggy TimePicker yerine. */
    private static function timeOptions(): array
    {
        $out = [];
        for ($h = 0; $h < 24; $h++) {
            foreach ([0, 15, 30, 45] as $m) {
                $v = sprintf('%02d:%02d', $h, $m);
                $out[$v] = $v;
            }
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
                Forms\Components\Radio::make('frequency')
                    ->label('Kurulma sıklığı')
                    ->helperText('Günlük: seçili her gün, o gün 00:00\'da kurulur. Haftalık: Pazartesi 00:00\'da o haftanın TÜM seçili günlerinin turnuvaları birden kurulur (hafta başı tüm hafta önceden görünür/kayıt açık).')
                    ->options([
                        'daily' => 'Günlük (her gün saat 00:00\'da o günün turnuvası kurulur)',
                        'weekly' => 'Haftalık (Pazartesi saat 00:00\'da o haftanın hepsi birden kurulur)',
                    ])
                    ->default('daily')
                    ->required(),
                Forms\Components\CheckboxList::make('weekdays')
                    ->label('Hangi günler kurulsun')
                    ->helperText('Turnuvanın oynanacağı günler. Günlük modda her gün o gün kurulur; Haftalık modda hepsi Pazartesi kurulur. "Tümünü seç" = her gün.')
                    ->options(self::WEEKDAYS)
                    ->columns(3)
                    ->bulkToggleable() // "Tümünü seç / Tümünü kaldır" = her gün seçeneği
                    ->required(),
                // Buggy TimePicker yerine aranabilir Select (00:00..23:45, 15 dk adım): 24 saatlik,
                // tarih/AM-PM yok, mobilde de sağlam. Değer "HH:MM" string -> kolona birebir yazılır.
                Forms\Components\Select::make('start_time')
                    ->label('Başlangıç saati (son katılım)')
                    ->helperText('Turnuva seçili günlerde bu saatte (Türkiye saati, 24 saatlik) otomatik başlar; o zamana kadar kayıt açık kalır. Yazarak ara (ör. "20").')
                    ->options(self::timeOptions())
                    ->searchable()
                    ->native(false)
                    ->default('20:00')
                    ->required(),
                Forms\Components\Select::make('type')
                    ->label('Turnuva tipi')
                    ->options(Tournament::TYPES)
                    ->required()
                    ->live()
                    ->default('bracket'),
                // 3 Haklı Swiss "hak sayısı" (1/2/3). Zorunlu; yalnız Swiss tipinde gösterilir
                // (bracket bu değeri yok sayar). Kurulan turnuvaya CreateScheduledTournaments aktarır.
                Forms\Components\Select::make('swiss_lives')
                    ->label('Hak sayısı')
                    ->helperText('3 Haklı Swiss: oyuncu kaç yenilgide elenir.')
                    ->options([1 => '1 hak', 2 => '2 hak', 3 => '3 hak'])
                    ->default(3)
                    ->required()
                    ->visible(fn (Forms\Get $get) => Tournament::isSwissType($get('type'))),
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
                // ---- Yüzdeli ödül havuzu (Evet/Hayır). Evet: toplanan giriş ücretlerinin %10'u komisyon,
                // kalanı 1./2./3.'ye yüzdeyle dağıtılır (bkz App\Support\TournamentPool). Hayır: ücret yakılır.
                Forms\Components\Radio::make('pool_enabled')
                    ->label('Ödül havuzu (coin)')
                    ->helperText('Evet: oyuncuların ödediği giriş ücretleri havuzda toplanır; %10 komisyon düşülür, kalanı aşağıdaki yüzdelerle 1./2./3.’ye dağıtılır. Hayır: giriş ücreti havuza girmez.')
                    ->boolean(trueLabel: 'Evet', falseLabel: 'Hayır')
                    ->inline()
                    ->default(false)
                    ->live(),
                Forms\Components\Fieldset::make('Havuz dağılımı (komisyon sonrası, toplam %100)')
                    ->statePath('pool_pcts')
                    ->visible(fn (Forms\Get $get) => (bool) $get('pool_enabled'))
                    ->columns(3)
                    ->schema([
                        Forms\Components\TextInput::make('p1')->label('1. Şampiyon (%)')
                            ->numeric()->integer()->minValue(0)->maxValue(100)->default(60)->suffix('%')->required()
                            ->afterStateHydrated(fn ($component, $state) => $state === null || $state === '' ? $component->state(60) : null),
                        Forms\Components\TextInput::make('p2')->label('2. Finalist (%)')
                            ->numeric()->integer()->minValue(0)->maxValue(100)->default(25)->suffix('%')->required()
                            ->afterStateHydrated(fn ($component, $state) => $state === null || $state === '' ? $component->state(25) : null),
                        Forms\Components\TextInput::make('p3')->label('3. Üçüncü (%)')
                            ->numeric()->integer()->minValue(0)->maxValue(100)->default(15)->suffix('%')->required()
                            ->afterStateHydrated(fn ($component, $state) => $state === null || $state === '' ? $component->state(15) : null)
                            ->rule(fn (Forms\Get $get) => function (string $attr, $value, \Closure $fail) use ($get) {
                                $sum = (int) $get('p1') + (int) $get('p2') + (int) $value;
                                if ($sum !== 100) {
                                    $fail('Yüzdelerin toplamı 100 olmalı (şu an '.$sum.').');
                                }
                            }),
                    ]),
                Forms\Components\TextInput::make('prize_coins')
                    ->label('Sabit şampiyon ödülü (coin, opsiyonel)')
                    ->helperText('Elle yazılan ek coin; turnuva bitince 1.’liğe eklenir. 0 = yok.')
                    ->required()->numeric()->minValue(0)->default(0),
                Forms\Components\Repeater::make('prizes')
                    ->label('Ödül tablosu (sıraya göre)')
                    ->helperText('Her satır bir sıralamadır: 1. satır = 1.’lik … Turnuva bitince coin otomatik dağıtılır.')
                    ->schema([
                        Forms\Components\TextInput::make('coins')
                            ->label('Coin')->numeric()->minValue(0)->default(0)->required(),
                        Forms\Components\TextInput::make('desc')
                            ->label('Açıklama (opsiyonel)')
                            ->placeholder('ör. Premium üyelik 1 ay')
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
                Forms\Components\Toggle::make('third_place_match')
                    ->label('Üçüncülük (3-4) maçı oynansın')
                    ->helperText('Açık: yarı final kaybedenleri 3.’lük maçı oynar. Kapalı (varsayılan): finale direkt geçilir; 3./4. rating’e göre belirlenir. Yalnızca Bracket tipinde geçerli.')
                    ->default(false),
                Forms\Components\TextInput::make('entry_fee')
                    ->label('Giriş ücreti (coin)')
                    ->helperText('0 = ücretsiz. Ödül havuzu “Evet” ise ücretler havuzda toplanır (−%10 komisyon), “Hayır” ise yakılır.')
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
                Tables\Columns\TextColumn::make('frequency')
                    ->label('Sıklık')
                    ->badge()
                    ->formatStateUsing(fn ($state) => $state === 'weekly' ? 'Haftalık' : 'Günlük'),
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
                // Şablonu çoğalt: tüm ayarları yeni bir periyodik turnuva şablonuna kopyalar; kopya
                // pasif başlar ve "son kurulum" damgası sıfırlanır (hemen kurmasın, admin düzenlesin).
                Tables\Actions\ReplicateAction::make()
                    ->label('Çoğalt')
                    ->icon('heroicon-o-document-duplicate')
                    ->color('gray')
                    ->beforeReplicaSaved(function (TournamentSchedule $replica, TournamentSchedule $record): void {
                        $replica->name = $record->name.' (kopya)';
                        $replica->active = false;
                        $replica->last_created_on = null;
                    })
                    ->successRedirectUrl(fn (TournamentSchedule $replica): string => Pages\EditTournamentSchedule::getUrl(['record' => $replica])),
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
