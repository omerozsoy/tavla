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
use Illuminate\Support\Facades\Schema;

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

    // Küfür ihlal geçmişi olanlar VEYA şu an elle konuşma yasaklı olanlar (admin'in verdiği
    // yasaklar chat_offenses artırmaz, yalnız chat_muted_until yazar -> ikinci koşul onları kapsar).
    // Aktif yasaklar üstte.
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->where(function (Builder $q) {
                $q->where('chat_offenses', '>', 0)
                    ->orWhere('chat_muted_until', '>', now());
            })
            ->orderByRaw('chat_muted_until IS NULL, chat_muted_until DESC');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // düzenleme yok (yalnız liste + aksiyonlar)
    }

    public static function table(Table $table): Table
    {
        return $table
            ->headerActions([
                // Yasağı bitmiş (süresi dolmuş) + ihlal geçmişli kullanıcıları TOPLU arşivle: listede
                // gizlenir ama ceza geçmişi (chat_offenses) KORUNUR -> tekrar ederse yine artan ceza.
                // Aktif yasaklılar etkilenmez.
                Tables\Actions\Action::make('archiveExpired')->label('Yasağı Bitenleri Arşivle')
                    ->icon('heroicon-o-archive-box')->color('gray')
                    ->requiresConfirmation()
                    ->modalDescription('Yasağı bitmiş tüm kullanıcılar arşivlenir (listede gizlenir, ihlal geçmişi korunur). Aktif yasaklılar etkilenmez.')
                    ->action(function () {
                        $n = User::whereNull('chat_mute_archived_at')
                            ->where('chat_offenses', '>', 0)
                            ->where(fn (Builder $q) => $q->whereNull('chat_muted_until')->orWhere('chat_muted_until', '<=', now()))
                            ->update(['chat_mute_archived_at' => now()]);
                        Notification::make()->title($n.' kullanıcı arşivlendi')->success()->send();
                    }),
            ])
            ->columns([
                Tables\Columns\TextColumn::make('nickname')->label('Kullanıcı')
                    ->searchable()->sortable(),
                Tables\Columns\TextColumn::make('chat_offenses')->label('İhlal')
                    ->badge()->color('warning')->sortable(),
                // Hangi kelimeden yasaklandı: "kullanıcı_token (eşleşen_kök)" (ör. "klasik (sik)").
                // Admin yanlış-pozitifi görür -> listeyi inceltmeye / yasağı kaldırmaya karar verir.
                Tables\Columns\TextColumn::make('chat_offense_word')->label('Tetikleyen Kelime')
                    ->placeholder('—')->color('danger')->wrap()->searchable()
                    ->tooltip('Son ihlali tetikleyen kelime (kullanıcının yazdığı + eşleşen kök).'),
                // Yasak kaynağı: küfür filtresi (ihlal sayacı > 0) vs admin'in elle verdiği yasak.
                Tables\Columns\TextColumn::make('kind')->label('Tür')->badge()
                    ->getStateUsing(fn (User $u) => $u->chat_offenses > 0 ? 'Küfür' : 'Manuel')
                    ->color(fn (string $state) => $state === 'Küfür' ? 'warning' : 'info'),
                // Elle yasaklarda yasağı veren admin (küfür otomatik yasaklarında —).
                Tables\Columns\TextColumn::make('chat_muted_by')->label('Yasaklayan')
                    ->getStateUsing(fn (User $u) => $u->chat_muted_by
                        ? (User::find($u->chat_muted_by)?->nickname ?? ('#'.$u->chat_muted_by))
                        : null)
                    ->placeholder('—')->color('gray'),
                Tables\Columns\TextColumn::make('status')->label('Durum')
                    ->badge()
                    ->getStateUsing(fn (User $u) => $u->chat_muted_until && $u->chat_muted_until->isFuture()
                        ? 'Aktif yasak'
                        : ($u->chat_mute_archived_at ? 'Arşivlendi' : 'Süresi doldu'))
                    ->color(fn (string $state) => match ($state) {
                        'Aktif yasak' => 'danger', 'Arşivlendi' => 'info', default => 'gray',
                    }),
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
                // Varsayılan AÇIK: arşivlenenleri gizle (aktif yasaklılar her halükârda görünür).
                // Kapatınca arşivlenenler de listelenir (durumu "Arşivlendi").
                Tables\Filters\Filter::make('hideArchived')->label('Arşivlenenleri gizle')->default()
                    ->query(fn (Builder $q) => $q->whereRaw('(chat_mute_archived_at IS NULL OR chat_muted_until > ?)', [now()])),
            ])
            ->actions([
                // Arşivle: yasağı bitmiş tek kullanıcıyı gizle (geçmiş korunur).
                Tables\Actions\Action::make('archive')->label('Arşivle')
                    ->icon('heroicon-o-archive-box')->color('gray')
                    ->visible(fn (User $u) => $u->chat_mute_archived_at === null
                        && (! $u->chat_muted_until || ! $u->chat_muted_until->isFuture()))
                    ->action(function (User $u) {
                        $u->chat_mute_archived_at = now();
                        $u->save();
                        Notification::make()->title('Arşivlendi')->success()->send();
                    }),
                // Arşivden Çıkar: tekrar listede görünür.
                Tables\Actions\Action::make('unarchive')->label('Arşivden Çıkar')
                    ->icon('heroicon-o-arrow-uturn-left')->color('gray')
                    ->visible(fn (User $u) => $u->chat_mute_archived_at !== null)
                    ->action(function (User $u) {
                        $u->chat_mute_archived_at = null;
                        $u->save();
                        Notification::make()->title('Arşivden çıkarıldı')->success()->send();
                    }),
                // Yasağı Kaldır: aktif yasağı bitir (ihlal geçmişi KALIR -> tekrarında yine artar).
                Tables\Actions\Action::make('unmute')->label('Yasağı Kaldır')
                    ->icon('heroicon-o-speaker-wave')->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (User $u) => $u->chat_muted_until && $u->chat_muted_until->isFuture())
                    ->action(function (User $u) {
                        // chat_* alanları fillable DEĞİL -> doğrudan ata + save (ChatModeration ile aynı desen).
                        $u->chat_muted_until = null;
                        if (Schema::hasColumn('users', 'chat_muted_by')) {
                            $u->chat_muted_by = null;
                        }
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
                        if (Schema::hasColumn('users', 'chat_offense_word')) {
                            $u->chat_offense_word = null;
                        }
                        if (Schema::hasColumn('users', 'chat_muted_by')) {
                            $u->chat_muted_by = null;
                        }
                        if (Schema::hasColumn('users', 'chat_mute_archived_at')) {
                            $u->chat_mute_archived_at = null; // temiz başlangıç: arşiv de temizlenir
                        }
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
