<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentResource\Pages;
use App\Models\Tournament;
use App\Support\TournamentModeration;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class TournamentResource extends Resource
{
    protected static ?string $model = Tournament::class;

    protected static ?string $navigationIcon = 'heroicon-o-flag';

    protected static ?string $navigationLabel = 'Turnuvalar';

    protected static ?string $modelLabel = 'turnuva';

    protected static ?string $pluralModelLabel = 'Turnuvalar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 2;

    /** Maç uzunluğu seçenekleri: 1 => 'Tek oyun', 7 => '7 puan' ... */
    private static function lengthOptions(): array
    {
        $out = [];
        foreach (Tournament::LENGTHS as $n) {
            $out[$n] = $n === 1 ? 'Tek oyun (1 puan)' : $n.' puan';
        }

        return $out;
    }

    /** Bekleyen (çözülmemiş) gerçek Swiss maçları: ["r0m1" => "1) Ali — 2) Veli · Tur 2"]. */
    public static function pendingSwissMatches(Tournament $record): array
    {
        $out = [];
        foreach ((is_array($record->bracket) ? $record->bracket : []) as $cells) {
            foreach ($cells as $m) {
                if (! empty($m['winner']) || ! empty($m['double_loss'])) {
                    continue;
                }
                if (empty($m['p1']['id']) || empty($m['p2']['id'])) {
                    continue; // bay / eksik
                }
                $out[$m['key']] = '1) '.($m['p1']['name'] ?? '?').' — 2) '.($m['p2']['name'] ?? '?')
                    .' · Tur '.($m['round'] ?? '?');
            }
        }

        return $out;
    }

    /** Bracket hücresini key ile bul (p1/p2 id eşlemesi için). */
    public static function findCell(Tournament $t, string $key): ?array
    {
        foreach ((is_array($t->bracket) ? $t->bracket : []) as $cells) {
            foreach ($cells as $m) {
                if (($m['key'] ?? null) === $key) {
                    return $m;
                }
            }
        }

        return null;
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required(),
                Forms\Components\Select::make('type')
                    ->label('Turnuva tipi')
                    ->helperText('Bracket System: klasik eleme ağacı (bugünkü). Swiss Triple Elimination: kuralları ayrıca tanımlanacak.')
                    ->options(Tournament::TYPES)
                    ->required()
                    ->live()
                    ->default('bracket'),
                Forms\Components\TextInput::make('venue')
                    ->label('Düzenlenme yeri / Otel')
                    ->helperText('Turnuvanın fiziksel yeri. Örn: "Titanic Otel, Antalya". Boş bırakılabilir.')
                    ->maxLength(160),
                Forms\Components\Select::make('organizer_id')
                    ->label('Düzenleyen kurum')
                    ->helperText('Turnuvayı düzenleyen kurum. Kurumlar sayfasından yönetilir. Boş bırakılabilir.')
                    ->relationship('organizer', 'title', fn (Builder $query) => $query->where('type', 'kurum')->orderBy('title'))
                    ->searchable()
                    ->preload()
                    ->nullable(),
                Forms\Components\Select::make('size')
                    ->label('Kapasite (kişi)')
                    ->helperText('Sınırsız: kaç kişi katılırsa ağaç ona göre kurulur (ör. 6 kişi -> 8 kişilik ağaç, 2 Bye). Sayı seçilirse en fazla o kadar kişi katılabilir; ağaç yine katılan sayısına göre kurulur.')
                    ->options([0 => 'Sınırsız (katılana göre)', 4 => '4', 8 => '8', 16 => '16', 32 => '32', 64 => '64', 128 => '128', 256 => '256'])
                    ->required()
                    ->default(8),
                Forms\Components\Select::make('status')
                    ->label('Durum')
                    ->required()
                    ->options([
                        'open' => 'Kayıt açık',
                        'running' => 'Devam ediyor',
                        'finished' => 'Bitti',
                    ])
                    ->default('open'),
                Forms\Components\Toggle::make('active')
                    ->label('Aktif (yayında)')
                    ->helperText('Kapatınca turnuva silinmez, sadece sitede gösterilmez (pasif). Tekrar açınca görünür olur.')
                    ->default(true),
                Forms\Components\DateTimePicker::make('register_until')
                    ->label('Son katılım tarihi')
                    ->helperText('Turnuva bu tarih-saatte (Türkiye saati) otomatik başlar (en az 2 oyuncu varsa). Boş bırakırsan otomatik başlama olmaz.')
                    ->seconds(false)
                    ->native(false)
                    ->nullable(),
                // ---- Maç uzunlukları (puan) ----
                Forms\Components\Select::make('match_length')
                    ->label('Maçlar kaç puanlık')
                    ->helperText('Normal turların maç uzunluğu. Yarı final / final için ayrıca seçilmezse bu kullanılır.')
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
                // ---- Maç süreleri (dakika, oyuncu başına) ----
                Forms\Components\TextInput::make('round_minutes')
                    ->label('Maç süresi (dk)')
                    ->helperText('Her oyuncunun maç boyunca toplam süresi. Boş: seçilen saat modunun varsayılanı. Yarı final / final için ayrıca girilmezse bu kullanılır.')
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
                Forms\Components\Toggle::make('third_place_match')
                    ->label('Üçüncülük (3-4) maçı oynansın')
                    ->helperText('Açık: yarı final kaybedenleri 3.’lük maçı oynar. Kapalı (varsayılan): 3.’lük maçı hiç kurulmaz, finale direkt geçilir; 3./4. sıra yarı final kaybedenlerinden rating’e göre belirlenir (3-4 aynı ödülü alıyorsa maça gerek yok). Yalnızca Bracket tipinde geçerli.')
                    ->default(false),
                Forms\Components\Select::make('swiss_lives')
                    ->label('Hak sayısı (Swiss)')
                    ->helperText('Her oyuncu kaç hakla başlar: 1 = tek-eleme gibi (ilk yenilgide elenir), 2, veya 3 (varsayılan). Bu kadar yenilgide oyuncu elenir. Başlangıçta kilitlenir. Yalnızca Swiss tipinde geçerli.')
                    ->options([1 => '1 haklı', 2 => '2 haklı', 3 => '3 haklı'])
                    ->required()
                    ->default(3),
                Forms\Components\Select::make('swiss_auto_draw')
                    ->label('Bye çekme şekli (Swiss)')
                    ->helperText('Otomatik: sistem bay alacak oyuncuyu kurallara göre (en az bay almış) seçer. Elle: her tur kura çekmeden önce bay çekebilecek uygun oyuncular gösterilir; salonda kura çekip bay olanı sen seçersin, sistem öyle devam eder. Yalnızca Swiss tipinde geçerli.')
                    ->options([1 => 'Sistem otomatik çeksin', 0 => 'Elle çekilecek (salonda kura)'])
                    ->required()
                    ->default(1)
                    ->visible(fn (Forms\Get $get) => $get('type') === 'swiss_triple'),
                Forms\Components\Select::make('creator_id')
                    ->label('Oluşturan')
                    ->relationship('creator', 'nickname')
                    ->searchable()
                    ->preload()
                    ->default(fn () => auth()->id()),
                // SALT GÖRÜNÜM: players/bracket JSON (array) kolonlarıdır. Düz Textarea olarak
                // KAYDEDİLİRSE string -> array-cast ile BOZULUR; "saat/uzunluk değiştirip kaydedince
                // katılımcılar atılıyor" bug'ının kökü buydu. dehydrated(false) => forma yazılır ama
                // ASLA kaydedilmez (kolona dokunulmaz) + disabled + okunur JSON. Katılımcı yönetimi
                // ayrı aksiyonlardan (Diskalifiye/Çekilme) yapılır; buradan elle düzenlenmez.
                Forms\Components\Textarea::make('players')
                    ->label('Katılımcılar (otomatik)')
                    ->helperText('Otomatik yönetilir; buradan düzenlenmez (salt görünüm).')
                    ->formatStateUsing(fn ($state) => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : (string) ($state ?? ''))
                    ->disabled()
                    ->dehydrated(false)
                    ->rows(6)
                    ->columnSpanFull(),
                Forms\Components\Textarea::make('bracket')
                    ->label('Eşleşme ağacı (otomatik)')
                    ->helperText('Otomatik yönetilir; buradan düzenlenmez (salt görünüm).')
                    ->formatStateUsing(fn ($state) => is_array($state) ? json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : (string) ($state ?? ''))
                    ->disabled()
                    ->dehydrated(false)
                    ->rows(6)
                    ->columnSpanFull(),
                Forms\Components\Select::make('champion_id')
                    ->label('Şampiyon')
                    ->relationship('champion', 'nickname')
                    ->searchable()
                    ->preload()
                    ->nullable()
                    // Turnuva BİTTİKTEN sonra şampiyon elle değiştirilemez: sıralama/ödüller bracket/
                    // swiss_state'ten HESAPLANIR (standingsFromBracket/finalStandings), champion_id'yi
                    // ayrıca düzenlemek gösterilen şampiyonu hesaplanan sıralamayla ÇELİŞTİRİR (denetim
                    // R1). disabled -> UI'da kilitli; dehydrated(false, finished iken) -> kurcalansa bile
                    // kaydedilmez. Bitmeden önce (kurulum/düzeltme) serbest.
                    ->disabled(fn ($record) => $record && $record->status === 'finished')
                    ->dehydrated(fn ($record) => ! ($record && $record->status === 'finished'))
                    ->helperText('Otomatik belirlenir; turnuva bitince buradan DEĞİŞTİRİLEMEZ (sıralama/ödülle tutarlı kalır).'),
                Forms\Components\TextInput::make('prize_coins')
                    ->label('Ödül havuzu (coin)')
                    ->helperText('Giriş ücretleri burada birikir; turnuva bitince 1.’liğe eklenir. Elle de ekleyebilirsin.')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->default(0),

                // ---- Sıralamaya göre ödül tablosu (kaç kişiye + her sıraya ayrı ödül) ----
                Forms\Components\Repeater::make('prizes')
                    ->label('Ödül tablosu (sıraya göre)')
                    ->helperText('Her satır bir sıralamadır: 1. satır = 1.’lik, 2. satır = 2.’lik … Kaç kişiye ödül vereceğini satır sayısıyla belirlersin; sürükleyerek sırayı değiştirebilirsin. Turnuva bitince coin otomatik dağıtılır (1.=şampiyon, 2.=finalist, aynı turda elenenler rating’e göre).')
                    ->schema([
                        Forms\Components\TextInput::make('coins')
                            ->label('Coin')
                            ->numeric()
                            ->minValue(0)
                            ->default(0)
                            ->required(),
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
                Forms\Components\Toggle::make('prize_paid')
                    ->label('Ödül ödendi')
                    ->helperText('Turnuva bitince otomatik işaretlenir. Açıkken ödül tekrar ödenmez.'),
                Forms\Components\Toggle::make('premium_only')
                    ->label('Sadece Premium üyeler katılabilir')
                    ->helperText('Kapalıysa tüm üyeler (normal + Premium) katılabilir. Misafirler hiçbir turnuvaya katılamaz.')
                    ->default(true),
                Forms\Components\TextInput::make('entry_fee')
                    ->label('Giriş ücreti (coin)')
                    ->helperText('0 = ücretsiz. Toplanan ücretler ödül havuzuna eklenir. NOT: Aşağıya TL ücreti girersen bu coin ücreti YOK SAYILIR (turnuva TL’li olur).')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->default(0),
                Forms\Components\TextInput::make('entry_fee_try')
                    ->label('Giriş ücreti (TL)')
                    ->helperText('Boş/0 = TL ile katılım YOK. Bir tutar girersen (ör. 250) turnuva TL’li olur: üyeler kredi kartıyla (3D) öder, coin ücreti yok sayılır. TL iadesi otomatik DEĞİL (DQ/iptalde yönetici elle iade eder; oyuncu kendiliğinden ayrılamaz).')
                    ->numeric()
                    ->minValue(0)
                    ->maxValue(1000000)
                    ->step(1)
                    ->suffix('₺')
                    ->nullable()
                    // Kolon KURUŞ saklar; admin TL görür/girer (×100 kaydet, ÷100 göster).
                    ->formatStateUsing(fn ($state) => $state !== null && $state !== '' ? $state / 100 : null)
                    ->dehydrateStateUsing(fn ($state) => $state !== null && $state !== '' && (float) $state > 0 ? (int) round((float) $state * 100) : null),
                Forms\Components\TextInput::make('join_password')
                    ->label('Katılım şifresi')
                    ->helperText('Boş bırak = turnuva HALKA AÇIK (şifresiz). Doldurursan turnuva ŞİFRELİ olur: katılmak için üyeler bu şifreyi girmek zorunda. Şifreyi katılacaklara sen paylaşırsın.')
                    ->maxLength(60)
                    ->autocomplete(false)
                    ->placeholder('Boş = halka açık'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')
                    ->label('ID')
                    ->sortable()
                    ->searchable(),
                Tables\Columns\TextColumn::make('name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('type')
                    ->label('Tip')
                    ->formatStateUsing(fn (?string $state): string => Tournament::TYPES[$state] ?? ($state ?? 'Bracket System'))
                    ->badge()
                    ->toggleable(),
                Tables\Columns\TextColumn::make('venue')
                    ->label('Yer / Otel')
                    ->placeholder('—')
                    ->searchable()
                    ->toggleable(),
                Tables\Columns\TextColumn::make('organizer.title')
                    ->label('Düzenleyen kurum')
                    ->placeholder('—')
                    ->searchable()
                    ->toggleable(),
                Tables\Columns\TextColumn::make('size')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->searchable(),
                Tables\Columns\IconColumn::make('premium_only')
                    ->label('Premium')
                    ->boolean()
                    ->tooltip('Açık: yalnız Premium katılır. Kapalı: tüm üyeler.'),
                Tables\Columns\ToggleColumn::make('active')
                    ->label('Aktif')
                    ->tooltip('Kapatınca sitede gösterilmez (pasif); silmez.'),
                Tables\Columns\TextColumn::make('register_until')
                    ->label('Son katılım')
                    ->dateTime('d.m.Y H:i')
                    ->placeholder('—')
                    ->sortable(),
                Tables\Columns\TextColumn::make('creator.nickname')
                    ->label('Oluşturan')
                    ->placeholder('—')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('champion.nickname')
                    ->label('Şampiyon')
                    ->placeholder('—')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('prize_coins')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('prize_desc')
                    ->searchable(),
                Tables\Columns\IconColumn::make('prize_paid')
                    ->boolean(),
                Tables\Columns\TextColumn::make('entry_fee')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('entry_fee_try')
                    ->label('Giriş (TL)')
                    ->placeholder('—')
                    ->formatStateUsing(fn ($state) => $state ? number_format($state / 100, 2, ',', '.').' ₺' : null)
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('active')
                    ->label('Yayın durumu')
                    ->placeholder('Tümü')
                    ->trueLabel('Aktif')
                    ->falseLabel('Pasif'),
            ])
            ->actions([
                // Tüm yönetici işlemleri (başlat / diskalifiye / çekilme / sonuç düzelt / tur tarih-saati /
                // kura çek / sıfırla / düzenle) + canlı istatistikler TEK "Yönetim Paneli" sayfasında toplandı.
                Tables\Actions\Action::make('manage')
                    ->label('Yönetim Paneli')
                    ->icon('heroicon-o-adjustments-horizontal')
                    ->color('primary')
                    ->url(fn (Tournament $record): string => Pages\ManageTournament::getUrl(['record' => $record])),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->before(fn (Collection $records) => $records->each(
                            fn (Tournament $r) => TournamentModeration::cancelWithRefund($r, fn () => null)
                        )), // A-22: silmeden önce ücret iadesi
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTournaments::route('/'),
            'create' => Pages\CreateTournament::route('/create'),
            'edit' => Pages\EditTournament::route('/{record}/edit'),
            'manage' => Pages\ManageTournament::route('/{record}/manage'),
        ];
    }
}
