<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentResource\Pages;
use App\Models\Payment;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;

    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static ?string $navigationLabel = 'Ödeme Kayıtları';

    protected static ?string $modelLabel = 'ödeme';

    protected static ?string $pluralModelLabel = 'Ödeme Kayıtları';

    protected static ?string $navigationGroup = 'Finans';

    protected static ?int $navigationSort = 1;

    // Kayitlar elle olusturulmaz (banka callback'i / checkout olusturur).
    public static function canCreate(): bool
    {
        return false;
    }

    // Yalniz HAVALE ödemeleri elle düzenlenebilir (kart ödemeleri banka-otoriter, salt-okunur).
    public static function canEdit($record): bool
    {
        return $record->payment_method === 'bank_transfer';
    }

    // Kind -> okunur ürün açıklaması + elle verilecek (havale onayında admin manuel yükler).
    protected static function grantInfo(Payment $r): string
    {
        return match ($r->kind) {
            'coins'        => number_format((int) $r->coins, 0, ',', '.').' coin',
            'cart'         => ((int) $r->coins > 0 ? number_format((int) $r->coins, 0, ',', '.').' coin + ' : '').'sipariş(ler)',
            'subscription' => 'Premium ('.($r->plan ?: 'star').') — '.($r->period === 'monthly' ? '1 ay' : '1 yıl'),
            'renew'        => 'Premium uzatma — '.($r->period === 'monthly' ? '1 ay' : '1 yıl'),
            'product'      => 'Fiziksel ürün siparişi',
            default        => '—',
        };
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Havale Ödemesi')
                ->description('Dekont geldiğinde durumu "Ödendi" yap. DİKKAT: coin/üyelik OTOMATİK yüklenmez — aşağıdaki "Elle verilecek" bilgisine göre kullanıcıya elle ver (Üyeler ekranından). Fiziksel ürünlerde ayrıca Siparişler ekranından durumu güncelle.')
                ->schema([
                    Forms\Components\Placeholder::make('user')->label('Üye')
                        ->content(fn (?Payment $r) => $r?->user?->nickname ?? ('#'.($r?->user_id ?? '—'))),
                    Forms\Components\Placeholder::make('order_id')->label('Referans (açıklama)')
                        ->content(fn (?Payment $r) => $r?->order_id ?? '—'),
                    Forms\Components\Placeholder::make('amount')->label('Tutar')
                        ->content(fn (?Payment $r) => $r ? number_format(((int) $r->amount) / 100, 2, ',', '.').' ₺' : '—'),
                    Forms\Components\Placeholder::make('grant')->label('Elle verilecek')
                        ->content(fn (?Payment $r) => $r ? static::grantInfo($r) : '—'),
                    Forms\Components\Select::make('status')->label('Durum')
                        ->options([
                            'pending' => 'Bekliyor',
                            'paid'    => 'Ödendi',
                            'failed'  => 'Başarısız',
                        ])
                        ->required(),
                    Forms\Components\TextInput::make('bank_msg')->label('Not (dahili)')
                        ->maxLength(255)
                        ->helperText('Örn. dekont tarihi/işlem no.'),
                ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('id')->label('#')->sortable(),
                Tables\Columns\TextColumn::make('user.nickname')->label('Üye')->searchable()->default('—'),
                Tables\Columns\TextColumn::make('payment_method')->label('Yöntem')->badge()
                    ->color(fn ($state) => $state === 'bank_transfer' ? 'warning' : 'gray')
                    ->formatStateUsing(fn ($state) => $state === 'bank_transfer' ? 'Havale' : 'Kart'),
                Tables\Columns\TextColumn::make('plan')->label('Plan')->badge(),
                Tables\Columns\TextColumn::make('period')->label('Dönem')
                    ->formatStateUsing(fn ($state) => $state === 'yearly' ? 'Yıllık' : ($state === 'monthly' ? 'Aylık' : '—')),
                Tables\Columns\TextColumn::make('amount')->label('Tutar')->sortable()
                    ->formatStateUsing(fn ($state) => number_format(((int) $state) / 100, 2, ',', '.').' ₺'),
                Tables\Columns\TextColumn::make('status')->label('Durum')->badge()
                    ->color(fn ($state) => match ($state) {
                        'paid' => 'success',
                        'failed' => 'danger',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn ($state) => match ($state) {
                        'paid' => 'Ödendi',
                        'failed' => 'Başarısız',
                        'pending' => 'Bekliyor',
                        default => $state,
                    }),
                Tables\Columns\TextColumn::make('order_id')->label('Sipariş')->searchable()->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i')->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')->options([
                    'paid' => 'Ödendi',
                    'failed' => 'Başarısız',
                    'pending' => 'Bekliyor',
                ]),
                Tables\Filters\SelectFilter::make('payment_method')->label('Yöntem')->options([
                    'bank_transfer' => 'Havale',
                    'card' => 'Kart',
                ])->query(function ($query, array $data) {
                    $v = $data['value'] ?? null;
                    if ($v === 'bank_transfer') {
                        return $query->where('payment_method', 'bank_transfer');
                    }
                    if ($v === 'card') {
                        return $query->where(fn ($q) => $q->whereNull('payment_method')->orWhere('payment_method', '!=', 'bank_transfer'));
                    }

                    return $query;
                }),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('Onayla / Düzenle')
                    ->visible(fn (Payment $r) => $r->payment_method === 'bank_transfer'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPayments::route('/'),
            'edit'  => Pages\EditPayment::route('/{record}/edit'),
        ];
    }
}
