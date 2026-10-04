<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TournamentResource\Pages;
use App\Filament\Resources\TournamentResource\RelationManagers;
use App\Models\Tournament;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

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

    /**
     * Moderasyon tablo aksiyonu (Diskalifiye / Çekilme). İkisi de aynı iş: oyuncuyu turnuvadan çıkar
     * (TournamentModeration::remove). Fark SADECE $mode (Swiss durumu 'dq' vs 'withdrawn') + etiket/metin.
     * GÖRÜNÜR: kayıt açık (her tip) VEYA sürüyor+Swiss; sürüyor+eleme ağacında GİZLİ (bracket walkover
     * ilerletmesi HTTP controller'a özel, remove() false döner).
     */
    private static function moderationAction(string $mode): Tables\Actions\Action
    {
        $isDq = $mode === 'dq';

        return Tables\Actions\Action::make($isDq ? 'disqualify' : 'withdrawPlayer')
            ->label($isDq ? 'Diskalifiye' : 'Çekilme (hükmen)')
            ->icon($isDq ? 'heroicon-o-no-symbol' : 'heroicon-o-arrow-right-start-on-rectangle')
            ->color($isDq ? 'danger' : 'warning')
            ->visible(fn (Tournament $record): bool => $record->status === 'open'
                || ($record->status === 'running' && ($record->type ?? 'bracket') === 'swiss_triple'))
            ->form([
                Forms\Components\Select::make('user_id')
                    ->label('Oyuncu')
                    ->options(fn (Tournament $record): array => collect($record->players ?? [])
                        ->filter()
                        ->mapWithKeys(fn ($p) => [(int) $p['id'] => ($p['name'] ?? ('#'.$p['id']))])
                        ->all())
                    ->searchable()
                    ->required(),
            ])
            ->requiresConfirmation()
            ->modalHeading($isDq ? 'Oyuncuyu diskalifiye et' : 'Oyuncuyu turnuvadan çek')
            ->modalDescription($isDq
                ? 'Kayıt açıksa oyuncu listeden çıkarılır + giriş ücreti iade edilir. Turnuva sürüyorsa hükmen uygulanır: sıradaki maçı rakibine verilir ve bir daha eşleşmeye alınmaz. Bu işlem geri alınamaz.'
                : 'Oyuncu adına çekilme kaydeder (örn. "devam edemeyeceğim" diyen oyuncu). Kayıt açıksa listeden çıkarılır + giriş ücreti iade; turnuva sürüyorsa sıradaki maçı rakibine verilir. Diskalifiyeden farkı: durum "çekildi" (ceza değil) olarak işaretlenir. Geri alınamaz.')
            ->action(function (Tournament $record, array $data) use ($mode, $isDq): void {
                $uid = (int) $data['user_id'];
                \Illuminate\Support\Facades\DB::transaction(function () use ($record, $uid, $mode): void {
                    $t = Tournament::lockForUpdate()->find($record->id);
                    if ($t) {
                        \App\Support\TournamentModeration::remove($t, $uid, $mode);
                    }
                });
                \Filament\Notifications\Notification::make()
                    ->title($isDq ? 'Oyuncu diskalifiye edildi' : 'Oyuncu turnuvadan çekildi')
                    ->success()
                    ->send();
            });
    }

    /**
     * Yönetici sonuç düzeltme (yalnız sürüyor + Swiss): bekleyen bir maçı hükmen çöz — galip ilan veya
     * çift mağlubiyet (iki taraf da gelmedi). Eleme ağacında bracket JSON elle düzenlenir (burada yok).
     */
    private static function resultCorrectionAction(): Tables\Actions\Action
    {
        return Tables\Actions\Action::make('correctResult')
            ->label('Sonuç düzelt')
            ->icon('heroicon-o-pencil-square')
            ->color('warning')
            ->visible(fn (Tournament $record): bool => $record->status === 'running'
                && ($record->type ?? 'bracket') === 'swiss_triple')
            ->form([
                Forms\Components\Select::make('match')
                    ->label('Maç (bekleyen)')
                    ->options(fn (Tournament $record): array => self::pendingSwissMatches($record))
                    ->required()
                    ->helperText('Yalnızca henüz sonuçlanmamış gerçek maçlar listelenir.'),
                Forms\Components\Radio::make('outcome')
                    ->label('Sonuç')
                    ->options([
                        'p1' => '1. oyuncu kazandı (hükmen)',
                        'p2' => '2. oyuncu kazandı (hükmen)',
                        'double_loss' => 'Çift mağlubiyet (ikisi de gelmedi)',
                    ])
                    ->required(),
            ])
            ->requiresConfirmation()
            ->modalHeading('Maç sonucunu düzelt')
            ->modalDescription('Bekleyen bir maçı hükmen çözer (galip ilan veya çift mağlubiyet). Çift mağlubiyet: iki oyuncuya da birer mağlubiyet yazılır, galip yok. Uygulanmış (sonraki tur üretilmiş) sonuçlar buradan düzeltilemez.')
            ->action(function (Tournament $record, array $data): void {
                $ok = false;
                \Illuminate\Support\Facades\DB::transaction(function () use ($record, $data, &$ok): void {
                    $t = Tournament::lockForUpdate()->find($record->id);
                    if (! $t) {
                        return;
                    }
                    $cell = self::findCell($t, $data['match']);
                    if (! $cell) {
                        return;
                    }
                    $outcome = $data['outcome'] === 'double_loss' ? 0
                        : (int) ($data['outcome'] === 'p1' ? ($cell['p1']['id'] ?? 0) : ($cell['p2']['id'] ?? 0));
                    $ok = \App\Support\Swiss\SwissRuntime::resolveMatch($t, $data['match'], $outcome);
                });
                \Filament\Notifications\Notification::make()
                    ->title($ok ? 'Maç sonucu düzeltildi' : 'Maç düzeltilemedi (zaten çözülmüş olabilir)')
                    ->{$ok ? 'success' : 'warning'}()
                    ->send();
            });
    }

    /** Bekleyen (çözülmemiş) gerçek Swiss maçları: ["r0m1" => "1) Ali — 2) Veli · Tur 2"]. */
    private static function pendingSwissMatches(Tournament $record): array
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
    private static function findCell(Tournament $t, string $key): ?array
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
                    ->nullable(),
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
                Forms\Components\Toggle::make('prize_paid')
                    ->label('Ödül ödendi')
                    ->helperText('Turnuva bitince otomatik işaretlenir. Açıkken ödül tekrar ödenmez.'),
                Forms\Components\Toggle::make('premium_only')
                    ->label('Sadece Premium üyeler katılabilir')
                    ->helperText('Kapalıysa tüm üyeler (normal + Premium) katılabilir. Misafirler hiçbir turnuvaya katılamaz.')
                    ->default(true),
                Forms\Components\TextInput::make('entry_fee')
                    ->label('Giriş ücreti (coin)')
                    ->helperText('0 = ücretsiz. Toplanan ücretler ödül havuzuna eklenir.')
                    ->required()
                    ->numeric()
                    ->minValue(0)
                    ->default(0),
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
            ])
            ->filters([
                Tables\Filters\TernaryFilter::make('active')
                    ->label('Yayın durumu')
                    ->placeholder('Tümü')
                    ->trueLabel('Aktif')
                    ->falseLabel('Pasif'),
            ])
            ->actions([
                Tables\Actions\Action::make('start')
                    ->label('Başlat')
                    ->icon('heroicon-o-play')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Turnuvayı başlat')
                    ->modalDescription('Eşleşme ağacı oluşturulup turnuva başlatılacak. Bu işlem geri alınamaz.')
                    // Yalnizca kayit acik ve en az 2 oyuncu varken gorunur
                    ->visible(fn (Tournament $record): bool => $record->status === 'open'
                        && count(array_filter($record->players ?? [], fn ($p) => $p !== null)) >= 2)
                    ->action(function (Tournament $record): void {
                        // Tipe göre başlat: 3 Haklı Swiss -> SwissRuntime (kura + eşleştirme + kilitli
                        // kural seti); eleme ağacı -> model startBracket. (Controller start() ile aynı dal.)
                        if (($record->type ?? 'bracket') === 'swiss_triple') {
                            \App\Support\Swiss\SwissRuntime::start($record);
                        } else {
                            $record->startBracket();
                        }
                        \Filament\Notifications\Notification::make()
                            ->title('Turnuva başlatıldı')
                            ->success()
                            ->send();
                    }),
                self::moderationAction('dq'),
                self::moderationAction('withdraw'),
                self::resultCorrectionAction(),
                // KATILIMCILARI TEMİZLE (sıfırla -> açık): test turnuvasını baştan oynamak için.
                // Katılımcılar + eşleşme ağacı + Swiss durumu + şampiyon silinir, durum 'açık'a döner
                // -> yeniden katılıma açılır. Başlatınca kura (shuffle) YENİDEN çekilir (yeni eşleşme).
                Tables\Actions\Action::make('resetTournament')
                    ->label('Katılımcıları Temizle')
                    ->icon('heroicon-o-arrow-path')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Turnuvayı sıfırla (açık)')
                    ->modalDescription('TÜM katılımcılar, eşleşme ağacı ve şampiyon silinir; turnuva "açık" durumuna döner (yeniden katılıma açılır). Yeniden başlatıldığında eşleşme KURA ile yeniden çekilir. Oynanmış maç sonuçları/ödüller GERİ ALINMAZ. Test turnuvaları için — geri alınamaz.')
                    ->action(function (Tournament $record): void {
                        // A-22: ödül ödenmediyse katılımcıların ödediği giriş ücretleri iade edilir
                        // (eskiden sıfırlamada ücretler kayboluyor, yeniden katılan iki kez ödüyordu).
                        \App\Support\TournamentModeration::cancelWithRefund($record, function (Tournament $t): void {
                            $t->players = [];
                            $t->bracket = [];
                            if (\Illuminate\Support\Facades\Schema::hasColumn('tournaments', 'swiss_state')) {
                                $t->swiss_state = null;
                            }
                            $t->champion_id = null;
                            $t->prize_paid = false;
                            $t->status = 'open';
                            $t->save();
                        });
                        \Filament\Notifications\Notification::make()
                            ->title('Turnuva sıfırlandı (açık)')
                            ->body('Katılımcılar temizlendi. Katılım açık; başlatınca kura yeniden çekilir.')
                            ->success()
                            ->send();
                    }),
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->before(fn (\Illuminate\Support\Collection $records) => $records->each(
                            fn (Tournament $r) => \App\Support\TournamentModeration::cancelWithRefund($r, fn () => null)
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
        ];
    }
}
