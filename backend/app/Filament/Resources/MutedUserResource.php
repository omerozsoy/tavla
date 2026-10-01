<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MutedUserResource\Pages;
use App\Models\User;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Yasaklılar": sohbet küfür yaptırımıyla konuşma yasağı almış kullanıcılar (ChatModeration).
 * Admin aktif yasakları görür + "Yasağı Kaldır" (muted_until temizle, geçmiş kalır -> tekrar
 * ederse yine artan ceza) veya "Sıfırla" (temiz başlangıç: muted_until + ihlal sayacı 0) yapar.
 * Yalnız ihlal geçmişi olanlar listelenir; panelden kayıt oluşturulmaz/düzenlenmez.
 */
class MutedUserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $slug = 'yasaklilar';

    protected static ?string $navigationIcon = 'heroicon-o-no-symbol';

    protected static ?string $navigationLabel = 'Yasaklılar';

    protected static ?string $modelLabel = 'yasaklı';

    protected static ?string $pluralModelLabel = 'Yasaklılar';

    protected static ?string $navigationGroup = 'Oyun';

    protected static ?int $navigationSort = 1;

    public static function canCreate(): bool
    {
        return false;
    }

    // Menü rozeti: ŞU AN aktif (süresi dolmamış) konuşma yasağı sayısı.
    public static function getNavigationBadge(): ?string
    {
        $count = User::where('chat_muted_until', '>', now())->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    // Yalnız ihlal geçmişi olanlar; aktif yasaklar üstte.
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where('chat_offenses', '>', 0)
            ->orderByRaw('chat_muted_until IS NULL, chat_muted_until DESC');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // düzenleme yok (yalnız liste + aksiyonlar)
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('nickname')->label('Kullanıcı')
                    ->searchable()->sortable(),
                Tables\Columns\TextColumn::make('chat_offenses')->label('İhlal')
                    ->badge()->color('warning')->sortable(),
                Tables\Columns\TextColumn::make('status')->label('Durum')
                    ->badge()
                    ->getStateUsing(fn (User $u) => $u->chat_muted_until && $u->chat_muted_until->isFuture() ? 'Aktif yasak' : 'Süresi doldu')
                    ->color(fn (string $state) => $state === 'Aktif yasak' ? 'danger' : 'gray'),
                Tables\Columns\TextColumn::make('chat_muted_until')->label('Bitiş')
                    ->dateTime('d.m.Y H:i')->timezone('Europe/Istanbul')
                    ->description(fn (User $u) => $u->chat_muted_until && $u->chat_muted_until->isFuture()
                        ? 'Kalan: '.$u->chat_muted_until->locale('tr')->diffForHumans(null, true)
                        : null)
                    ->placeholder('—')->sortable(),
            ])
            ->filters([
                Tables\Filters\Filter::make('active')->label('Yalnız aktif yasaklı')
                    ->query(fn (Builder $q) => $q->where('chat_muted_until', '>', now())),
            ])
            ->actions([
                // Yasağı Kaldır: aktif yasağı bitir (ihlal geçmişi KALIR -> tekrarında yine artar).
                Tables\Actions\Action::make('unmute')->label('Yasağı Kaldır')
                    ->icon('heroicon-o-speaker-wave')->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (User $u) => $u->chat_muted_until && $u->chat_muted_until->isFuture())
                    ->action(function (User $u) {
                        // chat_* alanları fillable DEĞİL -> doğrudan ata + save (ChatModeration ile aynı desen).
                        $u->chat_muted_until = null;
                        $u->save();
                        Notification::make()->title('Konuşma yasağı kaldırıldı')->success()->send();
                    }),
                // Sıfırla: temiz başlangıç (yasak + ihlal sayacı 0 -> sonraki ihlal yine 24 saatten başlar).
                Tables\Actions\Action::make('reset')->label('Sıfırla')
                    ->icon('heroicon-o-arrow-path')->color('gray')
                    ->requiresConfirmation()
                    ->modalDescription('İhlal geçmişi de sıfırlanır; sonraki küfür yeniden yalnız uyarı olur (sonra 24 saat, 1 hafta, 1 ay, 1 yıl).')
                    ->action(function (User $u) {
                        $u->chat_muted_until = null;
                        $u->chat_offenses = 0;
                        $u->save();
                        Notification::make()->title('İhlal geçmişi sıfırlandı')->success()->send();
                    }),
            ])
            ->emptyStateHeading('Konuşma yasaklı kullanıcı yok');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMutedUsers::route('/'),
        ];
    }
}
