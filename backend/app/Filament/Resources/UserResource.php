<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Http\Controllers\PanelController;
use App\Jobs\SendVerificationEmailJob;
use App\Models\User;
use App\Support\AccountClosure;
use App\Support\ChatModeration;
use App\Support\CheatScan;
use App\Support\Geo;
use App\Support\OfficialMessenger;
use App\Support\UserEraser;
use App\Support\WalletBreakdown;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\Section as ISection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Infolists\Infolist;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationLabel = 'Üyeler';

    protected static ?string $modelLabel = 'üye';

    protected static ?string $pluralModelLabel = 'Üyeler';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 0;

    protected static ?string $recordTitleAttribute = 'nickname';

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Kimlik')->columns(2)->schema([
                // Admin GÜVENİLİR bağlam: 15-karakter takma ad kuralı kullanıcı formları/API içindir.
                // Sistem/marka hesabı ("Tavla TV Yönetim" = 16) panelde düzenlenebilsin diye burada 32.
                Forms\Components\TextInput::make('nickname')->label('Takma ad')->required()->maxLength(32)
                    ->unique(ignoreRecord: true)->validationMessages(['unique' => 'Bu takma ad zaten kullanımda.']),
                Forms\Components\TextInput::make('email')->label('E-posta')->email()->required()
                    ->unique(ignoreRecord: true)->validationMessages(['unique' => 'Bu e-posta zaten kullanımda.']),
                Forms\Components\TextInput::make('phone')->label('Cep telefonu')->tel()->maxLength(20)
                    ->placeholder('05XXXXXXXXX'),
                // first_name/last_name DB'de NOT NULL. Boş TextInput Filament varsayılanında null'a
                // dönüşüp NOT NULL ihlali (500) verir -> boş = '' olarak yaz.
                Forms\Components\TextInput::make('first_name')->label('Ad')
                    ->dehydrateStateUsing(fn ($state) => (string) $state),
                Forms\Components\TextInput::make('last_name')->label('Soyad')
                    ->dehydrateStateUsing(fn ($state) => (string) $state),
                Forms\Components\Select::make('country')->label('Ülke')
                    ->options(Geo::countries())
                    ->searchable(),
                Forms\Components\Select::make('province')->label('İl')
                    ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES))
                    ->searchable(),
                // Sifre: yalnizca doldurulursa degisir (model 'hashed' cast'i ile hash'lenir).
                // autocomplete='new-password' + data-lpignore: TARAYICI PAROLA YONETICISININ bu alana
                // kayitli giris parolasini OTO-DOLDURMASINI engeller. Aksi halde Enter/Kaydet'te
                // filled() true olup parola RE-HASH edilir -> (kendi hesabinizi duzenlerken)
                // AuthenticateSession oturumu kapatir + (baska uyeyi duzenlerken) o uyenin parolasini
                // sessizce ezer (hesap ele gecirme). Bos birakinca degismez, dolu olani autofill degil
                // yalniz ELLE yazilan deger olur.
                Forms\Components\TextInput::make('password')->label('Yeni şifre')
                    ->password()->revealable()->dehydrated(fn ($state) => filled($state))
                    ->autocomplete('new-password')
                    ->extraInputAttributes(['data-lpignore' => 'true', 'data-1p-ignore' => 'true'])
                    ->required(fn (string $operation) => $operation === 'create')
                    ->helperText('Boş bırakılırsa değişmez'),
            ]),
            Forms\Components\Section::make('Oyun / Puan')->columns(3)->schema([
                Forms\Components\TextInput::make('rating')->label('Rating (puan)')->numeric()
                    ->minValue(100)->maxValue(4000)->default(1500)
                    ->helperText(fn ($state) => 'Seviye: '.PanelController::levelLabel((int) ($state ?: 1500))),
                Forms\Components\Select::make('level_min')->label('Ünvan Ata (kısayol)')
                    ->options(array_flip(PanelController::levels()))
                    ->dehydrated(false)
                    ->helperText('Seçince rating o kademenin alt eşiğine ayarlanır')
                    ->live()
                    ->afterStateUpdated(fn ($state, Forms\Set $set) => $state !== null ? $set('rating', max(100, (int) $state)) : null),
                Forms\Components\TextInput::make('coins')->label('Coin')->numeric()->integer()->minValue(0)->default(0),
                Forms\Components\TextInput::make('wins')->label('Galibiyet')->numeric()->default(0),
                Forms\Components\TextInput::make('losses')->label('Mağlubiyet')->numeric()->default(0),
                Forms\Components\TextInput::make('games_played')->label('Oynanan')->numeric()->default(0),
            ]),
            // CÜZDAN: View sayfasıyla AYNI kaynak dökümü + reconciliation (salt-okunur). Üstteki
            // "Coin" alanı WalletService::setBalance ile ledger'a (admin_adjustment) yazar; bu panel
            // o değişikliğin tutarlılığını (izahı olmayan para) gösterir. create'te record yok -> gizli.
            Forms\Components\Section::make('Cüzdan')
                ->icon('heroicon-o-banknotes')
                ->hiddenOn('create')
                ->collapsible()
                ->schema([
                    Forms\Components\ViewField::make('wallet_breakdown')
                        ->hiddenLabel()
                        ->dehydrated(false)
                        ->view('filament.user.wallet')
                        ->afterStateHydrated(fn (Forms\Components\ViewField $component, ?User $record) => $component->state($record ? self::walletData($record) : [])),
                ]),
            Forms\Components\Section::make('Üyelik & Yetki')->columns(2)->schema([
                // plan DB'de NOT NULL (default 'free'). Placeholder'a ("Bir seçenek seçin")
                // dönüp boş kaydedilirse plan=NULL -> 500. Boşaltmayı engelle + null gelirse 'free'e çevir.
                Forms\Components\Select::make('plan')->label('Plan')->options([
                    'free' => 'Ücretsiz',
                    'premium' => 'Premium',
                ])->default('free')->required()->selectablePlaceholder(false)
                    ->dehydrateStateUsing(fn ($state) => $state ?: 'free'),
                Forms\Components\DateTimePicker::make('plan_until')->label('Plan bitişi'),
                // Hizli sure ekleme: basilinca bitis tarihine ekler (gelecekteyse ustune,
                // gecmis/bossa bugunden baslar), plan'i Premium yapar ve ANINDA kaydeder.
                Forms\Components\Actions::make([
                    self::extendPlanAction('add1m', '1 Ay Ekle', 1),
                    self::extendPlanAction('add3m', '3 Ay Ekle', 3),
                    self::extendPlanAction('add6m', '6 Ay Ekle', 6),
                    self::extendPlanAction('add12m', '1 Yıl Ekle', 12),
                ])->columnSpanFull(),
                Forms\Components\Toggle::make('is_admin')->label('Yönetici'),
                Forms\Components\Toggle::make('is_support')->label('Destek')
                    ->helperText('Açık = Destek personeli: isim yanında krem kalkan + profilde "Hata Bildir" + herkes DM atabilir'),
                Forms\Components\DateTimePicker::make('banned_at')->label('Yasak tarihi (boş = aktif)'),
                // Switch: açık = doğrulanmış. Mevcut zaman damgasını korur (tekrar now()'a ezmez).
                Forms\Components\Toggle::make('email_verified_at')
                    ->label('E-posta aktivasyonu')
                    ->helperText('Açık = doğrulanmış sayılır; kapalı = doğrulama kalkar')
                    ->formatStateUsing(fn ($state) => filled($state))
                    ->dehydrateStateUsing(fn ($state, ?User $record) => $state ? ($record?->email_verified_at ?? now()) : null),
            ]),
            Forms\Components\Section::make('Admin Notu')->schema([
                // Yalnız yöneticiler görür/yazar. Sitede admin bu kullanıcının profiline bakınca okunur.
                // NOT: admin_note model'de $hidden -> form attributesToArray'den gelmez; EditUser
                // ::mutateFormDataBeforeFill record'dan doğrudan enjekte eder (yoksa kutu BOŞ gelir).
                Forms\Components\Textarea::make('admin_note')->label('Not')->rows(4)->maxLength(5000)
                    ->placeholder('Bu kullanıcı hakkında yöneticilere özel not (ör. uyarı geçmişi, şüpheli davranış)...')
                    ->helperText('Yalnız yöneticiler görür. Sitede bu kullanıcının profilinde admin görür.'),
                // Notu son yazan yönetici + zaman (kaydedince otomatik damgalanır).
                Forms\Components\Placeholder::make('admin_note_meta')->label('Son düzenleyen')
                    ->visible(fn (?User $record) => (bool) ($record?->admin_note_by))
                    ->content(fn (?User $record) => $record?->admin_note_by
                        ? ((User::find($record->admin_note_by)?->nickname ?? '#'.$record->admin_note_by)
                            .($record->admin_note_at ? ' · '.$record->admin_note_at->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i') : ''))
                        : '—'),
            ])->collapsible(),
        ]);
    }

    /**
     * "Süre Ekle" form-içi buton: bitiş tarihine $months ay ekler.
     * - Mevcut bitiş gelecekteyse onun üstüne, geçmiş/boşsa bugünden başlar.
     * - Plan 'free' ise 'premium' yapar; zaten premiumsa korur.
     * - Kayıtlı üyede forceFill ile ANINDA kaydeder ($fillable kısıtlı — asla fillable'a ekleme).
     */
    protected static function extendPlanAction(string $key, string $label, int $months): Forms\Components\Actions\Action
    {
        return Forms\Components\Actions\Action::make($key)
            ->label($label)
            ->icon('heroicon-m-plus')
            ->color('gray')
            ->action(function (?User $record, Forms\Set $set, Forms\Get $get) use ($months) {
                $current = $get('plan_until');
                $base = $current ? Carbon::parse($current) : now();
                if ($base->isPast()) {
                    $base = now();
                }
                $new = $base->copy()->addMonths($months);
                $plan = ($get('plan') ?? 'free') === 'free' ? 'premium' : $get('plan');

                // Formda göster (kaydet'e basılmasa da alan güncel görünür)
                $set('plan_until', $new->format('Y-m-d H:i:s'));
                $set('plan', $plan);

                // Kayıtlı üyede diske ANINDA yaz
                if ($record) {
                    $record->forceFill(['plan_until' => $new, 'plan' => $plan]);
                    $record->stampPlanSource('admin', auth()->id()); // KAYNAK = admin + hangi admin
                    $record->save();
                    Notification::make()
                        ->title('Süre eklendi')
                        ->body('Yeni bitiş: '.$new->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i'))
                        ->success()
                        ->send();
                }
            });
    }

    /** Hesap kapatma modalı: kullanıcı+durum özeti, ZORUNLU gerekçe, admin-özel not, oturum uyarısı. */
    /** A-18: kök hesap / kendi hesabı kapatma reddi -> 500 yerine panel bildirimi. */
    public static function closeAccountSafely(User $record, array $data): void
    {
        try {
            AccountClosure::close($record, (int) auth()->id(), $data['reason'], $data['note'] ?? null);
        } catch (\RuntimeException $e) {
            Notification::make()->danger()->title($e->getMessage())->send();
        }
    }

    public static function closeFormSchema(): array
    {
        return [
            Forms\Components\Placeholder::make('who')->label('Kullanıcı')
                ->content(fn (User $record) => $record->nickname.' (#'.$record->id.') — '
                    .($record->isBanned() ? 'KAPALI' : 'Aktif')),
            Forms\Components\Textarea::make('reason')->label('Kapatma gerekçesi')
                ->required()->rows(3)->maxLength(2000),
            Forms\Components\Textarea::make('note')->label('Özel not (yalnız adminler görür)')
                ->rows(2)->maxLength(2000),
            Forms\Components\Placeholder::make('warn')->hiddenLabel()
                ->content('Bu kullanıcının mevcut oturumları da kapatılacak (tüm cihazlardan çıkış).'),
        ];
    }

    /** Yeniden açma modalı: ZORUNLU gerekçe + yan-etki uyarısı. */
    public static function reopenFormSchema(): array
    {
        return [
            Forms\Components\Placeholder::make('who')->label('Kullanıcı')
                ->content(fn (User $record) => $record->nickname.' (#'.$record->id.')'),
            Forms\Components\Textarea::make('reason')->label('Yeniden açma gerekçesi')
                ->required()->rows(3)->maxLength(2000),
            Forms\Components\Placeholder::make('info')->hiddenLabel()
                ->content('Eski oturumlar geri gelmez; kullanıcı yeniden giriş yapmalı. '
                    .'Ayrı konuşma yasağı ve turnuva diskalifiyesi otomatik kalkmaz.'),
        ];
    }

    /** Konuşma yasağı (sohbet susturma) modal formu — hem tablo hem profil (ViewUser) kullanır. */
    public static function chatMuteFormSchema(): array
    {
        return [
            Forms\Components\Placeholder::make('cur')->label('Mevcut durum')
                ->content(fn (User $record) => $record->chat_muted_until && $record->chat_muted_until->isFuture()
                    ? 'Yasaklı: '.$record->chat_muted_until->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i').'\'e kadar'
                    : 'Yasaksız'),
            Forms\Components\Select::make('minutes')->label('Süre')->required()
                ->options([
                    '1440' => '24 saat',
                    '10080' => '1 hafta',
                    '43200' => '1 ay',
                    '525600' => '1 yıl',
                    '0' => 'Yasağı kaldır',
                ])->default('1440'),
        ];
    }

    /**
     * Konuşma yasağını uygular/kaldırır: chat_muted_until yazar, resmi DM gönderir,
     * kişi maçtaysa maç sohbetine kırmızı satır düşürür (AdminController::chatMute ile aynı yol).
     */
    public static function applyChatMute(User $record, array $data): void
    {
        $min = (int) $data['minutes'];
        $record->chat_muted_until = $min > 0 ? now()->addMinutes($min) : null;
        if (Schema::hasColumn('users', 'chat_muted_by')) {
            $record->chat_muted_by = $min > 0 ? (int) auth()->id() : null;
        }
        $record->save();
        if ($min > 0) {
            $until = $record->chat_muted_until->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i');
            OfficialMessenger::sendTo(
                $record,
                "⚠️ Konuşma yasağı aldın. Sohbete yazamazsın. Ceza bitişi: {$until}."
            );
        } else {
            OfficialMessenger::sendTo(
                $record,
                '✓ Konuşma yasağın kaldırıldı. Tekrar sohbet edebilirsin.'
            );
        }
        // Kişi o an bir maçtaysa maç sohbetine satır düş (yasak=kırmızı, kalkma=yeşil).
        ChatModeration::announceMuteInActiveMatch($record, $min === 0);
        Notification::make()
            ->title($min > 0 ? 'Konuşma yasağı uygulandı' : 'Konuşma yasağı kaldırıldı')
            ->success()->send();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('nickname')->label('Takma ad')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('email')->label('E-posta')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('phone')->label('Cep telefonu')->searchable()
                    ->toggleable(isToggledHiddenByDefault: true)->placeholder('—'),
                Tables\Columns\IconColumn::make('email_verified')->label('E-posta ✓')
                    ->boolean()->trueColor('success')->falseColor('danger')
                    ->getStateUsing(fn ($record) => $record->email_verified_at !== null)
                    ->tooltip(fn ($record) => $record->email_verified_at
                        ? 'Doğrulandı: '.$record->email_verified_at->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i')
                        : 'Doğrulanmadı'),
                Tables\Columns\TextColumn::make('rating')->label('Puan')->sortable(),
                Tables\Columns\TextColumn::make('coins')->label('Coin')->sortable()
                    ->formatStateUsing(fn ($state) => number_format((int) $state, 0, ',', '.')),
                Tables\Columns\TextColumn::make('wins')->label('G/M')
                    ->formatStateUsing(fn ($state, $record) => ($record->wins ?? 0).'/'.($record->losses ?? 0))
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('plan_active')->label('Plan')->badge()
                    ->color(fn ($state) => $state === 'free' ? 'gray' : 'success')
                    ->formatStateUsing(fn ($state) => $state === 'free' ? 'Ücretsiz' : 'Premium'),
                Tables\Columns\IconColumn::make('banned_at')->label('Yasaklı')
                    ->boolean()->trueColor('danger')->falseColor('gray')
                    ->getStateUsing(fn ($record) => $record->banned_at !== null),
                // Aktif konuşma yasağı (sohbet susturma) — hesap yasağından bağımsız.
                Tables\Columns\IconColumn::make('chat_muted')->label('Susturulmuş')
                    ->boolean()->trueColor('warning')->falseColor('gray')
                    ->trueIcon('heroicon-s-chat-bubble-left-ellipsis')
                    ->falseIcon('heroicon-o-chat-bubble-left-ellipsis')
                    ->getStateUsing(fn ($record) => $record->chat_muted_until !== null && $record->chat_muted_until->isFuture())
                    ->tooltip(fn ($record) => $record->chat_muted_until && $record->chat_muted_until->isFuture()
                        ? 'Susturuldu: '.$record->chat_muted_until->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i').'\'e kadar'
                        : 'Susturulmamış')
                    ->toggleable(),
                // ŞÜPHELİ (motor-yardımı): maç PR geçmişinde engine-assist imzası taşıyan hesaplar
                // (bkz App\Support\CheatScan + "Şüpheli Maçlar" sayfası). Cache'li (suspectIds) — satır
                // başına tablo taranmaz. SİNYAL'dir; detay/ban için rozetin tooltip'i + Şüpheli Maçlar.
                Tables\Columns\TextColumn::make('cheat_suspect')->label('Şüpheli')->badge()->color('danger')
                    ->getStateUsing(function ($record) {
                        $s = CheatScan::suspectIds()[$record->id] ?? null;

                        return $s ? '⚠ '.$s['flags'] : null;
                    })
                    ->tooltip(function ($record) {
                        $s = CheatScan::suspectIds()[$record->id] ?? null;

                        return $s ? "Motor-yardımı şüphesi: {$s['flags']} uzun-düşük PR maç, en kötü PR {$s['worst_pr']}" : null;
                    })
                    ->placeholder('—')->toggleable(),
                // Admin notu: listede görünür (kimde not var bir bakışta belli) + içerikte arama.
                Tables\Columns\TextColumn::make('admin_note')->label('Admin Notu')
                    ->limit(40)->tooltip(fn ($record) => $record->admin_note)
                    ->placeholder('—')->searchable()->wrap()->toggleable(),
                Tables\Columns\TextColumn::make('created_at')->label('Kayıt')->dateTime('d.m.Y H:i')->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('last_login_at')->label('Son giriş')->dateTime('d.m.Y H:i')
                    ->placeholder('—')->sortable()->toggleable(),
                Tables\Columns\TextColumn::make('banned_at')->label('Kapatılma')->dateTime('d.m.Y H:i')
                    ->placeholder('—')->sortable()->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('closed_by')->label('Kapatan')->placeholder('—')
                    ->state(fn ($record) => $record->banned_by ? (User::find($record->banned_by)?->nickname ?? '#'.$record->banned_by) : null)
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                // SİLİNMİŞ (anonimleştirilmiş) hesaplar: mali geçmişi (coin defteri/ödeme/sipariş) olan
                // hesaplar yasal saklama için fiziksel silinemez -> UserEraser anonimleştirir
                // (ban_reason='account_deleted', nickname='silinmisN', deleted-N@deleted.invalid). Satır DURUR.
                // Varsayılan (blank) GİZLER (liste kalabalıklaşmasın) ama admin artık toggle ile BULABİLİR.
                Tables\Filters\TernaryFilter::make('deleted')->label('Silinmiş hesaplar')
                    ->placeholder('Gizli (varsayılan)')->trueLabel('Yalnız silinmişler')
                    ->falseLabel('Silinmişler dahil hepsi')
                    ->queries(
                        true: fn (Builder $q) => $q->where('ban_reason', 'account_deleted'),
                        false: fn (Builder $q) => $q,
                        blank: fn (Builder $q) => $q->where(fn (Builder $w) => $w
                            ->whereNull('ban_reason')->orWhere('ban_reason', '!=', 'account_deleted')),
                    ),
                Tables\Filters\SelectFilter::make('plan')->label('Plan')->options([
                    'free' => 'Ücretsiz', 'premium' => 'Premium',
                ]),
                Tables\Filters\TernaryFilter::make('is_admin')->label('Yönetici'),
                Tables\Filters\TernaryFilter::make('is_support')->label('Destek'),
                // Admin notu olan üyeleri süz (kimde not var kolayca bulunur).
                Tables\Filters\TernaryFilter::make('admin_note')->label('Admin notu')
                    ->placeholder('Hepsi')->trueLabel('Notu olanlar')->falseLabel('Notu olmayanlar')
                    ->queries(
                        true: fn (Builder $q) => $q->whereNotNull('admin_note')->where('admin_note', '!=', ''),
                        false: fn (Builder $q) => $q->where(fn (Builder $w) => $w->whereNull('admin_note')->orWhere('admin_note', '')),
                        blank: fn (Builder $q) => $q,
                    ),
                // KAPALI HESAPLAR listesi: durum + kapatan admin + tarih aralığı filtreleri.
                Tables\Filters\TernaryFilter::make('closed')->label('Hesap durumu')
                    ->placeholder('Hepsi')->trueLabel('Kapalı')->falseLabel('Aktif')
                    ->queries(
                        true: fn (Builder $q) => $q->whereNotNull('banned_at'),
                        false: fn (Builder $q) => $q->whereNull('banned_at'),
                        blank: fn (Builder $q) => $q,
                    ),
                Tables\Filters\SelectFilter::make('banned_by')->label('Kapatan admin')
                    ->options(fn () => User::whereNotNull('banned_at')->whereNotNull('banned_by')
                        ->get()->pluck('banned_by')->unique()
                        ->mapWithKeys(fn ($id) => [$id => User::find($id)?->nickname ?? '#'.$id])->all()),
                Tables\Filters\Filter::make('closed_between')
                    ->form([
                        Forms\Components\DatePicker::make('from')->label('Kapatılma ≥'),
                        Forms\Components\DatePicker::make('until')->label('Kapatılma ≤'),
                    ])
                    ->query(fn (Builder $q, array $data) => $q
                        ->when($data['from'] ?? null, fn (Builder $q, $d) => $q->whereDate('banned_at', '>=', $d))
                        ->when($data['until'] ?? null, fn (Builder $q, $d) => $q->whereDate('banned_at', '<=', $d))),
                Tables\Filters\TernaryFilter::make('email_verified')->label('E-posta doğrulama')
                    ->placeholder('Hepsi')->trueLabel('Doğrulanmış')->falseLabel('Doğrulanmamış')
                    ->queries(
                        true: fn (Builder $q) => $q->whereNotNull('email_verified_at'),
                        false: fn (Builder $q) => $q->whereNull('email_verified_at'),
                        blank: fn (Builder $q) => $q,
                    ),
                // Ülke/şehir süzgeci: yalnız üyelerde var olan değerler (çok üyeli önce).
                Tables\Filters\SelectFilter::make('country')->label('Ülke')
                    ->searchable()
                    ->options(fn () => User::query()
                        ->whereNotNull('country')->where('country', '!=', '')
                        ->selectRaw('country, COUNT(*) as c')->groupBy('country')->orderByDesc('c')
                        ->pluck('c', 'country')
                        ->mapWithKeys(fn ($count, $code) => [$code => (Geo::countries()[$code] ?? $code)." ({$count})"])
                        ->all()),
                Tables\Filters\SelectFilter::make('province')->label('Şehir (il)')
                    ->searchable()
                    ->options(fn () => User::query()
                        ->whereNotNull('province')->where('province', '!=', '')
                        ->selectRaw('province, COUNT(*) as c')->groupBy('province')->orderByDesc('c')
                        ->pluck('c', 'province')
                        ->mapWithKeys(fn ($count, $prov) => [$prov => "{$prov} ({$count})"])
                        ->all()),
            ])
            ->recordUrl(fn ($record) => Pages\ViewUser::getUrl([$record]))
            // Satır işlemleri kebab menüsünde toplanır: 5 etiketli buton satırı yatayda taşırıp
            // tabloyu ekran dışına itiyordu (actions "hiç gözükmüyor"). ActionGroup tek "⋮" ikonuna indirir.
            ->actions([
                // E-posta aktivasyonu: kebab'a GÖMÜLMEDEN doğrudan ikon-buton (hızlı aç/kapa).
                // Yeşil zarf = doğrula; gri = doğrulamayı kaldır. Etiket tooltip'te.
                Tables\Actions\Action::make('verifyEmail')
                    ->label(fn ($record) => $record->email_verified_at ? 'Doğrulamayı Kaldır' : 'E-postayı Doğrula')
                    ->tooltip(fn ($record) => $record->email_verified_at ? 'Doğrulamayı Kaldır' : 'E-postayı Doğrula')
                    ->iconButton()
                    ->icon('heroicon-m-envelope')
                    ->color(fn ($record) => $record->email_verified_at ? 'gray' : 'success')
                    ->requiresConfirmation()
                    ->action(function ($record) {
                        $record->email_verified_at = $record->email_verified_at ? null : now();
                        $record->save();
                    }),
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    // HESAP KAPATMA (siteden yasaklama) — gerekçe+not+onay modalı. Konuşma yasağından
                    // BAĞIMSIZ: yalnız giriş/site erişimini engeller; kayıt/maç/turnuva sonuçlarını SİLMEZ.
                    Tables\Actions\Action::make('closeAccount')
                        ->label('Hesabı Kapat')
                        ->icon('heroicon-m-lock-closed')
                        ->color('danger')
                        ->visible(fn (User $record) => ! $record->isBanned())
                        ->modalHeading('Hesabı Kapat / Siteden Yasakla')
                        ->modalSubmitActionLabel('Hesabı Kapat')
                        ->form(self::closeFormSchema())
                        ->action(fn (User $record, array $data) => self::closeAccountSafely($record, $data)),
                    Tables\Actions\Action::make('reopenAccount')
                        ->label('Hesabı Yeniden Aç')
                        ->icon('heroicon-m-lock-open')
                        ->color('success')
                        ->visible(fn (User $record) => $record->isBanned())
                        ->modalHeading('Hesabı Yeniden Aç')
                        ->modalSubmitActionLabel('Yeniden Aç')
                        ->form(self::reopenFormSchema())
                        ->action(fn (User $record, array $data) => AccountClosure::reopen(
                            $record, (int) auth()->id(), $data['reason']
                        )),
                    // KONUŞMA YASAĞI (sohbet susturma) — hesap yasağından BAĞIMSIZ: kullanıcı oynar ama
                    // oyun-içi + DM mesaj atamaz (ChatModeration::mutedSeconds chat_muted_until'e bakar).
                    // Otomatik küfür yasağıyla aynı kolonu yazar; admin daima muaf (mutedSeconds null döner).
                    Tables\Actions\Action::make('chatMute')
                        ->label(fn (User $record) => $record->chat_muted_until && $record->chat_muted_until->isFuture()
                            ? 'Konuşma Yasağı (aktif)' : 'Konuşma Yasağı')
                        ->icon('heroicon-m-chat-bubble-left-ellipsis')
                        ->color('warning')
                        ->modalHeading('Konuşma Yasağı (sohbet susturma)')
                        ->modalSubmitActionLabel('Uygula')
                        ->form(self::chatMuteFormSchema())
                        ->action(fn (User $record, array $data) => self::applyChatMute($record, $data)),
                ]),
            ])
            ->bulkActions([
                // ÇOKLU-SEÇİM SİLME: satır seçip toplu sil. Filament'in hazır DeleteBulkAction'ı
                // düz $user->delete() çağırır -> kulüp SAHİBİ bir üye silinince clubs cascadeOnDelete
                // TÜM kulübü (+ masum üyeleri) uçururdu. Bu yüzden UserEraser (deleteAccount/CLI ile
                // AYNI nazik sözleşme: kulüp devri + notifications/tokens + cascade) kullanılır.
                // GÜVENLİK: yönetici (is_admin) hesaplar ATLANIR (kazara/kötü-niyetli admin silme yok).
                Tables\Actions\BulkAction::make('deleteUsers')
                    ->label('Seçilenleri Sil')
                    ->icon('heroicon-m-trash')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Seçili üyeleri sil')
                    ->modalDescription('Seçilen üyeler KALICI silinir (kulüpleri en eski üyeye devredilir). '
                        .'Coin/ödeme/sipariş geçmişi olan üyeler silinmez, ANONİMLEŞTİRİLİR: kişisel bilgiler '
                        .'ve mesajlar silinir, mali kayıtlar yasal saklama için kalır. Yönetici hesaplar atlanır. '
                        .'Bu işlem GERİ ALINAMAZ.')
                    ->modalSubmitActionLabel('Evet, sil')
                    ->action(function (Collection $records) {
                        $deleted = 0;      // fiziksel silinen
                        $anonymized = 0;   // mali geçmişi yüzünden anonimleştirilen (satır kalır, gizlenir)
                        $skipped = 0;      // yönetici
                        foreach ($records as $record) {
                            if ($record->is_admin) {
                                $skipped++;

                                continue; // yönetici asla silinmez
                            }
                            // UserEraser mali geçmiş varsa anonimleştirir (fiziksel silmez) -> doğru say.
                            $financial = $record->hasFinancialHistory();
                            UserEraser::erase($record);
                            $financial ? $anonymized++ : $deleted++;
                        }
                        Notification::make()
                            ->title('Silme tamamlandı')
                            ->body(trim(
                                ($deleted > 0 ? "{$deleted} üye silindi. " : '')
                                .($anonymized > 0 ? "{$anonymized} üye anonimleştirildi (mali kayıt — yasal saklama; listeden gizlendi). " : '')
                                .($skipped > 0 ? "{$skipped} yönetici atlandı." : '')
                            ) ?: 'İşlem tamamlandı.')
                            ->success()
                            ->send();
                    })
                    ->deselectRecordsAfterCompletion(),
                // TOPLU DOĞRULAMA MAİLİ: seçili üyelerden e-postası DOĞRULANMAMIŞ olanlara
                // 6 haneli kod + imzalı link maili gönderir (register/resend ile AYNI içerik).
                // Zaten doğrulanmış + sistem hesapları atlanır. Hatalı gönderim diğerlerini bloklamaz.
                Tables\Actions\BulkAction::make('sendVerifyMail')
                    ->label('Doğrulama Maili Gönder')
                    ->icon('heroicon-m-envelope')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Doğrulama maili gönder')
                    ->modalDescription('Seçili üyelerden e-postası DOĞRULANMAMIŞ olanlara doğrulama maili '
                        .'gönderilir. Zaten doğrulanmış üyeler atlanır.')
                    ->modalSubmitActionLabel('Gönder')
                    ->action(function (Collection $records) {
                        // KUYRUK: her mail ayrı job (DB kuyruğu) -> admin isteği beklemez/timeout olmaz,
                        // mailler worker tarafından arka planda gönderilir. Doğrulanmış/sistem atlanır.
                        $queued = 0;
                        $skipped = 0;
                        foreach ($records as $record) {
                            if ($record->email_verified_at !== null || empty($record->email)
                                || (Schema::hasColumn('users', 'is_system') && $record->is_system)) {
                                $skipped++;

                                continue;
                            }
                            SendVerificationEmailJob::dispatch((int) $record->id);
                            $queued++;
                        }
                        Notification::make()
                            ->title('Doğrulama maili')
                            ->body("{$queued} mail kuyruğa alındı (arka planda gönderilecek)"
                                .($skipped > 0 ? ", {$skipped} atlandı (doğrulanmış/sistem)" : '').'.')
                            ->success()
                            ->send();
                    })
                    ->deselectRecordsAfterCompletion(),
            ]);
    }

    // Kullanıcı DETAY görünümü: her bölüm açık/katlanabilir SECTION (sekme değil). Sekmeler
    // panelin Alpine/JS'i bayatlayınca "hep aynı sayfaya gidiyor"du; bölümler açık render olur,
    // JS'e bağlı değildir -> tüm bilgi daima görünür.
    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            ISection::make('Bilgiler')->icon('heroicon-o-identification')->collapsible()->schema([
                TextEntry::make('id')->label('#'),
                TextEntry::make('nickname')->label('Takma ad'),
                TextEntry::make('email')->label('E-posta')->copyable(),
                TextEntry::make('phone')->label('Cep telefonu')->copyable()->placeholder('—'),
                TextEntry::make('full_name')->label('Ad Soyad')
                    ->state(fn (User $r) => trim(($r->first_name ?? '').' '.($r->last_name ?? '')) ?: '—'),
                TextEntry::make('country')->label('Ülke')->placeholder('—'),
                TextEntry::make('province')->label('İl')->placeholder('—'),
                TextEntry::make('rating')->label('Puan')->badge()->color('warning')
                    ->formatStateUsing(fn ($state) => (int) $state.'  ·  '.PanelController::levelLabel((int) ($state ?: 1500))),
                TextEntry::make('coins')->label('Coin')
                    ->formatStateUsing(fn ($state) => number_format((int) $state, 0, ',', '.')),
                TextEntry::make('record')->label('Galibiyet / Mağlubiyet / Oynanan')
                    ->state(fn (User $r) => ($r->wins ?? 0).' / '.($r->losses ?? 0).' / '.($r->games_played ?? 0)),
                TextEntry::make('total_wxp')->label('Toplam WXP')->placeholder('—')
                    ->formatStateUsing(fn ($state) => $state !== null ? number_format((int) $state, 0, ',', '.') : '—'),
                TextEntry::make('email_verified_at')->label('E-posta doğrulama')->dateTime('d.m.Y H:i')
                    ->placeholder('Doğrulanmadı')->badge()
                    ->color(fn ($state) => $state ? 'success' : 'danger'),
                TextEntry::make('is_admin')->label('Yönetici')->badge()
                    ->formatStateUsing(fn ($state) => $state ? 'Evet' : 'Hayır')
                    ->color(fn ($state) => $state ? 'success' : 'gray'),
                TextEntry::make('banned_at')->label('Yasak')->dateTime('d.m.Y H:i')
                    ->placeholder('Aktif (yasaksız)')->badge()
                    ->color(fn ($state) => $state ? 'danger' : 'success'),
                TextEntry::make('presence_status')->label('Durum')->placeholder('—'),
                TextEntry::make('created_at')->label('Kayıt')->dateTime('d.m.Y H:i'),
                TextEntry::make('last_login_at')->label('Son giriş')->dateTime('d.m.Y H:i')->placeholder('—'),
            ])->columns(3),

            ISection::make('Üyelik')->icon('heroicon-o-star')->collapsible()->schema([
                TextEntry::make('plan_active')->label('Aktif plan')->badge()
                    ->formatStateUsing(fn ($state) => $state === 'free' ? 'Ücretsiz' : 'Premium')
                    ->color(fn ($state) => $state === 'free' ? 'gray' : 'success'),
                TextEntry::make('plan')->label('Plan (kayıtlı)')->placeholder('free'),
                TextEntry::make('plan_since')->label('Başlangıç')->dateTime('d.m.Y H:i')->placeholder('—'),
                TextEntry::make('plan_until')->label('Bitiş')->dateTime('d.m.Y H:i')->placeholder('—')
                    ->badge()->color(fn (User $r) => $r->plan_active === 'free' ? 'gray' : 'success'),
                TextEntry::make('coins')->label('Coin bakiyesi')
                    ->formatStateUsing(fn ($state) => number_format((int) $state, 0, ',', '.')),
                // Premium NEREDEN geldi (admin ise HANGİ admin + ne zaman). Eski kayıtlarda null -> "—".
                TextEntry::make('plan_source')->label('Premium kaynağı')->placeholder('—')
                    ->badge()
                    ->color(fn ($state) => match ($state) {
                        'payment' => 'success', 'admin' => 'warning', 'wheel' => 'info', default => 'gray',
                    })
                    ->formatStateUsing(function ($state, User $r) {
                        $label = match ($state) {
                            'payment' => 'Ödeme',
                            'wheel' => 'Şans Çarkı',
                            'welcome' => 'Hoşgeldin (e-posta doğrulama)',
                            'admin' => 'Admin',
                            default => 'Bilinmiyor',
                        };
                        if ($state === 'admin' && $r->plan_source_by) {
                            $admin = User::find($r->plan_source_by);
                            $label .= ' — '.($admin?->nickname ?? ('#'.$r->plan_source_by));
                        }
                        if ($r->plan_source_at) {
                            $label .= ' · '.$r->plan_source_at->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i');
                        }

                        return $label;
                    })->columnSpanFull(),
            ])->columns(3),

            ISection::make('Hesap Durumu')->icon('heroicon-o-lock-closed')->collapsible()
                ->description(fn (User $r) => $r->isBanned() ? 'KAPALI (hesap yasaklı)' : null)
                ->schema([
                    TextEntry::make('account_state')->label('Durum')->badge()
                        ->state(fn (User $r) => $r->isBanned() ? 'KAPALI' : 'Aktif')
                        ->color(fn ($state) => $state === 'KAPALI' ? 'danger' : 'success'),
                    TextEntry::make('banned_at')->label('Kapatılma')->dateTime('d.m.Y H:i')->placeholder('—'),
                    TextEntry::make('closed_by')->label('İşlemi yapan admin')->placeholder('—')
                        ->state(fn (User $r) => $r->banned_by
                            ? (User::find($r->banned_by)?->nickname ?? '#'.$r->banned_by) : null),
                    // KONUŞMA YASAĞI (sohbet susturma) — hesap kapatmadan BAĞIMSIZ. Üstteki "Konuşma Yasağı"
                    // başlık aksiyonuyla uygulanır; durumu burada görünür.
                    TextEntry::make('chat_mute_state')->label('Konuşma yasağı')->badge()
                        ->state(fn (User $r) => $r->chat_muted_until && $r->chat_muted_until->isFuture()
                            ? 'Susturulmuş' : 'Yok')
                        ->color(fn ($state) => $state === 'Susturulmuş' ? 'warning' : 'success'),
                    TextEntry::make('chat_muted_until')->label('Yasak bitişi')->dateTime('d.m.Y H:i')
                        ->placeholder('—'),
                    TextEntry::make('chat_muted_by')->label('Yasağı koyan admin')->placeholder('—')
                        ->state(fn (User $r) => $r->chat_muted_by
                            ? (User::find($r->chat_muted_by)?->nickname ?? '#'.$r->chat_muted_by) : null),
                    TextEntry::make('ban_reason')->label('Gerekçe')->placeholder('—')->columnSpanFull(),
                    // Admin-özel not: yalnız panelde görünür, kullanıcıya ASLA ($hidden ile serialize dışı).
                    TextEntry::make('ban_note')->label('Özel not (yalnız admin)')->placeholder('—')->columnSpanFull(),
                    TextEntry::make('ban_history')->label('Kapatma / yeniden açma geçmişi')
                        ->state(fn (User $r) => $r->banEvents->map(fn ($e) => trim(
                            ($e->created_at?->format('d.m.Y H:i') ?? '—').' · '
                            .($e->action === 'closed' ? 'KAPATILDI' : 'YENİDEN AÇILDI').' · '
                            .(User::find($e->actor_id)?->nickname ?? '#'.$e->actor_id).' · '
                            .$e->reason
                        ))->all())
                        ->listWithLineBreaks()->bulleted()->placeholder('Kayıt yok')->columnSpanFull(),
                ])->columns(2),

            ISection::make('Cüzdan')->icon('heroicon-o-banknotes')->collapsible()
                ->description(fn (User $r) => (self::walletData($r)['recon']['clean'] ?? true) ? null : '⚠ İzahı olmayan para / defter tutarsızlığı')
                ->schema([
                    ViewEntry::make('wallet')->hiddenLabel()
                        ->state(fn (User $r) => self::walletData($r))
                        ->view('filament.user.wallet'),
                ]),

            ISection::make('Boardlar')->icon('heroicon-o-squares-2x2')->collapsible()->collapsed()
                ->description(fn (User $r) => count(self::ownedBoards($r)).' board')
                ->schema([
                    TextEntry::make('boards')->hiddenLabel()
                        ->state(fn (User $r) => self::ownedBoards($r))
                        ->badge()->color('info')
                        ->placeholder('Sahip olduğu board yok.'),
                ]),

            ISection::make('Avatarlar')->icon('heroicon-o-user-circle')->collapsible()->collapsed()->schema([
                ImageEntry::make('avatar')->label('Avatar')->circular()
                    ->height(96)->placeholder('Avatar yok'),
                TextEntry::make('avatar_frame')->label('Seçili çerçeve')->placeholder('Yok')->badge()->color('warning'),
                TextEntry::make('checker')->label('Seçili pul')->placeholder('Varsayılan')->badge()->color('warning'),
                TextEntry::make('frames')->label('Sahip olunan çerçeveler')
                    ->state(fn (User $r) => self::ownedFrames($r))
                    ->badge()->color('info')->placeholder('Çerçeve yok.'),
                TextEntry::make('checkers')->label('Sahip olunan pullar')
                    ->state(fn (User $r) => self::ownedCheckers($r))
                    ->badge()->color('info')->placeholder('Ek pul yok.'),
            ])->columns(2),

            ISection::make('Maçlar')->icon('heroicon-o-trophy')->collapsible()->collapsed()
                ->description(fn (User $r) => $r->matchResults()->count().' maç (son 100 gösterilir)')
                ->schema([
                    ViewEntry::make('matchResults')->hiddenLabel()
                        ->state(fn (User $r) => self::matchRowsWithNames($r))
                        ->view('filament.user.matches'),
                ]),
        ]);
    }

    /**
     * "Maçlar" sekmesi için son 100 maç + oyuncuların ad soyad'ı.
     * - Sahip (bu üye): first_name+last_name (self_full_name).
     * - Rakip: opponent_name (nickname) → User tablosundan tek sorguyla çözülür (opp_full_name).
     *   Bulunamazsa null (blade sadece nickname gösterir). Ad soyad = model üzerine dinamik nitelik.
     */
    public static function matchRowsWithNames(User $u): Collection
    {
        $rows = $u->matchResults()->latest('id')->limit(100)->get();
        $selfFull = trim(($u->first_name ?? '').' '.($u->last_name ?? '')) ?: null;

        $nicks = $rows->pluck('opponent_name')->filter()->unique()->values();
        $map = $nicks->isEmpty()
            ? collect()
            : User::whereIn('nickname', $nicks->all())
                ->get(['nickname', 'first_name', 'last_name'])
                ->mapWithKeys(fn (User $o) => [
                    $o->nickname => trim(($o->first_name ?? '').' '.($o->last_name ?? '')) ?: null,
                ]);

        foreach ($rows as $row) {
            $row->self_nickname = $u->nickname;
            $row->self_full_name = $selfFull;
            $row->opp_full_name = $row->opponent_name ? ($map[$row->opponent_name] ?? null) : null;
        }

        return $rows;
    }

    /** "Cüzdan" sekmesi: coin kaynak dökümü + reconciliation. İstek başına tek hesaplanır (badge+state). */
    protected static array $walletCache = [];

    public static function walletData(User $u): array
    {
        return self::$walletCache[$u->id] ??= WalletBreakdown::for($u);
    }

    /** unlocks'tan sahip olunan board id'leri (önek soyulmuş). */
    public static function ownedBoards(User $u): array
    {
        return collect($u->unlocks ?? [])
            ->filter(fn ($x) => is_string($x) && str_starts_with($x, 'theme.'))
            ->map(fn ($x) => substr($x, 6))->values()->all();
    }

    /** unlocks'tan sahip olunan çerçeve (frame) motion id'leri. */
    public static function ownedFrames(User $u): array
    {
        return collect($u->unlocks ?? [])
            ->filter(fn ($x) => is_string($x) && str_starts_with($x, 'frame.'))
            ->map(fn ($x) => substr($x, 6))->values()->all();
    }

    /** unlocks'tan sahip olunan pul (checker) id'leri. */
    public static function ownedCheckers(User $u): array
    {
        return collect($u->unlocks ?? [])
            ->filter(fn ($x) => is_string($x) && str_starts_with($x, 'checker.'))
            ->map(fn ($x) => substr($x, 8))->values()->all();
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'view' => Pages\ViewUser::route('/{record}'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}
