<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Http\Controllers\PanelController;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\Tabs as ITabs;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

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
                Forms\Components\TextInput::make('nickname')->label('Takma ad')->required()->maxLength(32),
                Forms\Components\TextInput::make('email')->label('E-posta')->email()->required(),
                Forms\Components\TextInput::make('phone')->label('Cep telefonu')->tel()->maxLength(20)
                    ->placeholder('05XXXXXXXXX'),
                // first_name/last_name DB'de NOT NULL. Boş TextInput Filament varsayılanında null'a
                // dönüşüp NOT NULL ihlali (500) verir -> boş = '' olarak yaz.
                Forms\Components\TextInput::make('first_name')->label('Ad')
                    ->dehydrateStateUsing(fn ($state) => (string) $state),
                Forms\Components\TextInput::make('last_name')->label('Soyad')
                    ->dehydrateStateUsing(fn ($state) => (string) $state),
                Forms\Components\Select::make('country')->label('Ülke')
                    ->options(\App\Support\Geo::countries())
                    ->searchable(),
                Forms\Components\Select::make('province')->label('İl')
                    ->options(array_combine(EventResource::PROVINCES, EventResource::PROVINCES))
                    ->searchable(),
                // Sifre: yalnizca doldurulursa degisir (model 'hashed' cast'i ile hash'lenir)
                Forms\Components\TextInput::make('password')->label('Yeni şifre')
                    ->password()->dehydrated(fn ($state) => filled($state))
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
                Forms\Components\TextInput::make('coins')->label('Coin')->numeric()->default(0),
                Forms\Components\TextInput::make('wins')->label('Galibiyet')->numeric()->default(0),
                Forms\Components\TextInput::make('losses')->label('Mağlubiyet')->numeric()->default(0),
                Forms\Components\TextInput::make('games_played')->label('Oynanan')->numeric()->default(0),
            ]),
            Forms\Components\Section::make('Üyelik & Yetki')->columns(2)->schema([
                // plan DB'de NOT NULL (default 'free'). Placeholder'a ("Bir seçenek seçin")
                // dönüp boş kaydedilirse plan=NULL -> 500. Boşaltmayı engelle + null gelirse 'free'e çevir.
                Forms\Components\Select::make('plan')->label('Plan')->options([
                    'free' => 'Ücretsiz',
                    'star' => 'Premium',
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
                Forms\Components\DateTimePicker::make('banned_at')->label('Yasak tarihi (boş = aktif)'),
                Forms\Components\DateTimePicker::make('email_verified_at')
                    ->label('E-posta doğrulama (boş = doğrulanmadı)')
                    ->helperText('Doldurulursa doğrulanmış sayılır; temizlenirse doğrulama kalkar'),
            ]),
        ]);
    }

    /**
     * "Süre Ekle" form-içi buton: bitiş tarihine $months ay ekler.
     * - Mevcut bitiş gelecekteyse onun üstüne, geçmiş/boşsa bugünden başlar.
     * - Plan 'free' ise 'star' (Premium) yapar; zaten premiumsa korur.
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
                $base = $current ? \Illuminate\Support\Carbon::parse($current) : now();
                if ($base->isPast()) {
                    $base = now();
                }
                $new = $base->copy()->addMonths($months);
                $plan = ($get('plan') ?? 'free') === 'free' ? 'star' : $get('plan');

                // Formda göster (kaydet'e basılmasa da alan güncel görünür)
                $set('plan_until', $new->format('Y-m-d H:i:s'));
                $set('plan', $plan);

                // Kayıtlı üyede diske ANINDA yaz
                if ($record) {
                    $record->forceFill(['plan_until' => $new, 'plan' => $plan]);
                    $record->stampPlanSource('admin', auth()->id()); // KAYNAK = admin + hangi admin
                    $record->save();
                    \Filament\Notifications\Notification::make()
                        ->title('Süre eklendi')
                        ->body('Yeni bitiş: '.$new->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i'))
                        ->success()
                        ->send();
                }
            });
    }

    /** Hesap kapatma modalı: kullanıcı+durum özeti, ZORUNLU gerekçe, admin-özel not, oturum uyarısı. */
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

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('nickname')->label('Takma ad')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('email')->label('E-posta')->searchable()->toggleable(),
                Tables\Columns\TextColumn::make('phone')->label('Cep telefonu')->searchable()->toggleable()->placeholder('—'),
                Tables\Columns\IconColumn::make('email_verified')->label('E-posta ✓')
                    ->boolean()->trueColor('success')->falseColor('danger')
                    ->getStateUsing(fn ($record) => $record->email_verified_at !== null)
                    ->tooltip(fn ($record) => $record->email_verified_at
                        ? 'Doğrulandı: '.$record->email_verified_at->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i')
                        : 'Doğrulanmadı'),
                Tables\Columns\TextColumn::make('rating')->label('Puan')->sortable(),
                Tables\Columns\TextColumn::make('rating')->label('Ünvan')
                    ->formatStateUsing(fn ($state) => PanelController::levelLabel((int) ($state ?: 1500)))
                    ->badge()->color('warning'),
                Tables\Columns\TextColumn::make('coins')->label('Coin')->sortable()
                    ->formatStateUsing(fn ($state) => number_format((int) $state, 0, ',', '.')),
                Tables\Columns\TextColumn::make('wins')->label('G/M')
                    ->formatStateUsing(fn ($state, $record) => ($record->wins ?? 0).'/'.($record->losses ?? 0)),
                Tables\Columns\TextColumn::make('plan_active')->label('Plan')->badge()
                    ->color(fn ($state) => $state === 'free' ? 'gray' : 'success')
                    ->formatStateUsing(fn ($state) => $state === 'free' ? 'Ücretsiz' : 'Premium'),
                Tables\Columns\IconColumn::make('is_admin')->label('Admin')->boolean(),
                Tables\Columns\IconColumn::make('banned_at')->label('Yasaklı')
                    ->boolean()->trueColor('danger')->falseColor('gray')
                    ->getStateUsing(fn ($record) => $record->banned_at !== null),
                Tables\Columns\TextColumn::make('created_at')->label('Kayıt')->dateTime('d.m.Y H:i')->sortable()->toggleable(),
                Tables\Columns\TextColumn::make('last_login_at')->label('Son giriş')->dateTime('d.m.Y H:i')
                    ->placeholder('—')->sortable()->toggleable(),
                Tables\Columns\TextColumn::make('banned_at')->label('Kapatılma')->dateTime('d.m.Y H:i')
                    ->placeholder('—')->sortable()->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('closed_by')->label('Kapatan')->placeholder('—')
                    ->state(fn ($record) => $record->banned_by ? (\App\Models\User::find($record->banned_by)?->nickname ?? '#'.$record->banned_by) : null)
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('plan')->label('Plan')->options([
                    'free' => 'Ücretsiz', 'star' => 'Premium',
                ]),
                Tables\Filters\TernaryFilter::make('is_admin')->label('Yönetici'),
                // KAPALI HESAPLAR listesi: durum + kapatan admin + tarih aralığı filtreleri.
                Tables\Filters\TernaryFilter::make('closed')->label('Hesap durumu')
                    ->placeholder('Hepsi')->trueLabel('Kapalı')->falseLabel('Aktif')
                    ->queries(
                        true: fn (Builder $q) => $q->whereNotNull('banned_at'),
                        false: fn (Builder $q) => $q->whereNull('banned_at'),
                        blank: fn (Builder $q) => $q,
                    ),
                Tables\Filters\SelectFilter::make('banned_by')->label('Kapatan admin')
                    ->options(fn () => \App\Models\User::whereNotNull('banned_at')->whereNotNull('banned_by')
                        ->get()->pluck('banned_by')->unique()
                        ->mapWithKeys(fn ($id) => [$id => \App\Models\User::find($id)?->nickname ?? '#'.$id])->all()),
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
            ])
            ->recordUrl(fn ($record) => Pages\ViewUser::getUrl([$record]))
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('verifyEmail')
                    ->label(fn ($record) => $record->email_verified_at ? 'Doğrulamayı Kaldır' : 'E-postayı Doğrula')
                    ->icon('heroicon-m-envelope')
                    ->color(fn ($record) => $record->email_verified_at ? 'gray' : 'success')
                    ->requiresConfirmation()
                    ->action(function ($record) {
                        $record->email_verified_at = $record->email_verified_at ? null : now();
                        $record->save();
                    }),
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
                    ->action(fn (User $record, array $data) => \App\Support\AccountClosure::close(
                        $record, (int) auth()->id(), $data['reason'], $data['note'] ?? null
                    )),
                Tables\Actions\Action::make('reopenAccount')
                    ->label('Hesabı Yeniden Aç')
                    ->icon('heroicon-m-lock-open')
                    ->color('success')
                    ->visible(fn (User $record) => $record->isBanned())
                    ->modalHeading('Hesabı Yeniden Aç')
                    ->modalSubmitActionLabel('Yeniden Aç')
                    ->form(self::reopenFormSchema())
                    ->action(fn (User $record, array $data) => \App\Support\AccountClosure::reopen(
                        $record, (int) auth()->id(), $data['reason']
                    )),
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
                    ->modalDescription('Seçilen üyeler ve maç/istatistik/coin kayıtları KALICI silinir '
                        .'(sahip oldukları kulüpler en eski üyeye devredilir). Yönetici hesaplar atlanır. '
                        .'Bu işlem GERİ ALINAMAZ.')
                    ->modalSubmitActionLabel('Evet, sil')
                    ->action(function (\Illuminate\Support\Collection $records) {
                        $deleted = 0;
                        $skipped = 0;
                        foreach ($records as $record) {
                            if ($record->is_admin) {
                                $skipped++;

                                continue; // yönetici asla silinmez
                            }
                            \App\Support\UserEraser::erase($record);
                            $deleted++;
                        }
                        \Filament\Notifications\Notification::make()
                            ->title('Silme tamamlandı')
                            ->body("{$deleted} üye silindi".($skipped > 0 ? ", {$skipped} yönetici atlandı." : '.'))
                            ->success()
                            ->send();
                    })
                    ->deselectRecordsAfterCompletion(),
            ]);
    }

    // Kullanıcı DETAY görünümü: her şey sekme sekme (Bilgiler / Üyelik / Boardlar / Avatarlar / Maçlar).
    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            ITabs::make('Detay')->columnSpanFull()->persistTabInQueryString()->tabs([
                ITabs\Tab::make('Bilgiler')->icon('heroicon-o-identification')->schema([
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

                ITabs\Tab::make('Üyelik')->icon('heroicon-o-star')->schema([
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
                                $admin = \App\Models\User::find($r->plan_source_by);
                                $label .= ' — '.($admin?->nickname ?? ('#'.$r->plan_source_by));
                            }
                            if ($r->plan_source_at) {
                                $label .= ' · '.$r->plan_source_at->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i');
                            }

                            return $label;
                        })->columnSpanFull(),
                ])->columns(3),

                ITabs\Tab::make('Hesap Durumu')->icon('heroicon-o-lock-closed')
                    ->badge(fn (User $r) => $r->isBanned() ? 'KAPALI' : null)->badgeColor('danger')
                    ->schema([
                        TextEntry::make('account_state')->label('Durum')->badge()
                            ->state(fn (User $r) => $r->isBanned() ? 'KAPALI' : 'Aktif')
                            ->color(fn ($state) => $state === 'KAPALI' ? 'danger' : 'success'),
                        TextEntry::make('banned_at')->label('Kapatılma')->dateTime('d.m.Y H:i')->placeholder('—'),
                        TextEntry::make('closed_by')->label('İşlemi yapan admin')->placeholder('—')
                            ->state(fn (User $r) => $r->banned_by
                                ? (\App\Models\User::find($r->banned_by)?->nickname ?? '#'.$r->banned_by) : null),
                        TextEntry::make('ban_reason')->label('Gerekçe')->placeholder('—')->columnSpanFull(),
                        // Admin-özel not: yalnız panelde görünür, kullanıcıya ASLA ($hidden ile serialize dışı).
                        TextEntry::make('ban_note')->label('Özel not (yalnız admin)')->placeholder('—')->columnSpanFull(),
                        TextEntry::make('ban_history')->label('Kapatma / yeniden açma geçmişi')
                            ->state(fn (User $r) => $r->banEvents->map(fn ($e) => trim(
                                ($e->created_at?->format('d.m.Y H:i') ?? '—').' · '
                                .($e->action === 'closed' ? 'KAPATILDI' : 'YENİDEN AÇILDI').' · '
                                .(\App\Models\User::find($e->actor_id)?->nickname ?? '#'.$e->actor_id).' · '
                                .$e->reason
                            ))->all())
                            ->listWithLineBreaks()->bulleted()->placeholder('Kayıt yok')->columnSpanFull(),
                    ])->columns(2),

                ITabs\Tab::make('Cüzdan')->icon('heroicon-o-banknotes')
                    ->badge(fn (User $r) => self::walletData($r)['recon']['clean'] ?? true ? null : '⚠')
                    ->badgeColor('danger')
                    ->schema([
                        ViewEntry::make('wallet')->hiddenLabel()
                            ->state(fn (User $r) => self::walletData($r))
                            ->view('filament.user.wallet'),
                    ]),

                ITabs\Tab::make('Boardlar')->icon('heroicon-o-squares-2x2')
                    ->badge(fn (User $r) => count(self::ownedBoards($r)) ?: null)
                    ->schema([
                        TextEntry::make('boards')->hiddenLabel()
                            ->state(fn (User $r) => self::ownedBoards($r))
                            ->badge()->color('info')
                            ->placeholder('Sahip olduğu board yok.'),
                    ]),

                ITabs\Tab::make('Avatarlar')->icon('heroicon-o-user-circle')->schema([
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

                ITabs\Tab::make('Maçlar')->icon('heroicon-o-trophy')
                    ->badge(fn (User $r) => $r->matchResults()->count() ?: null)
                    ->schema([
                        ViewEntry::make('matchResults')->hiddenLabel()
                            ->state(fn (User $r) => self::matchRowsWithNames($r))
                            ->view('filament.user.matches'),
                    ]),
            ]),
        ]);
    }

    /**
     * "Maçlar" sekmesi için son 100 maç + oyuncuların ad soyad'ı.
     * - Sahip (bu üye): first_name+last_name (self_full_name).
     * - Rakip: opponent_name (nickname) → User tablosundan tek sorguyla çözülür (opp_full_name).
     *   Bulunamazsa null (blade sadece nickname gösterir). Ad soyad = model üzerine dinamik nitelik.
     */
    public static function matchRowsWithNames(User $u): \Illuminate\Support\Collection
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
        return self::$walletCache[$u->id] ??= \App\Support\WalletBreakdown::for($u);
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
