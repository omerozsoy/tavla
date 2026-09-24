<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ContentCommentResource\Pages;
use App\Models\ContentComment;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Yorumlar": haber (Content type='news') altina kayitli kullanicilarin biraktigi yorumlar.
 * Yorum ONAY BEKLER (pending) -> buradan Onayla ile yayina alinir (approved) veya Reddet
 * (rejected). Yalniz onayli yorumlar sitede haber altinda gorunur. Panelden yeni yorum
 * olusturulmaz (yalniz kullanici birakir) -> Create yok.
 */
class ContentCommentResource extends Resource
{
    protected static ?string $model = ContentComment::class;

    protected static ?string $slug = 'yorumlar';

    protected static ?string $navigationIcon = 'heroicon-o-chat-bubble-left-right';

    protected static ?string $navigationLabel = 'Yorumlar';

    protected static ?string $modelLabel = 'yorum';

    protected static ?string $pluralModelLabel = 'Yorumlar';

    protected static ?string $navigationGroup = 'İçerik';

    protected static ?int $navigationSort = 6;

    // Onay bekleyen yorum sayisini menu rozetinde goster.
    public static function getNavigationBadge(): ?string
    {
        $count = static::getModel()::where('status', 'pending')->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['user', 'content']);
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Placeholder::make('content')->label('Haber')
                ->content(fn (?ContentComment $record) => $record?->content?->title ?? '—')
                ->columnSpanFull(),
            Forms\Components\Placeholder::make('author')->label('Yorumu yapan')
                ->content(fn (?ContentComment $record) => $record?->authorName() ?? '—'),
            Forms\Components\Placeholder::make('created_at')->label('Tarih')
                ->content(fn (?ContentComment $record) => $record?->created_at?->timezone('Europe/Istanbul')->format('d.m.Y H:i') ?? '—'),
            Forms\Components\Textarea::make('body')->label('Yorum')
                ->rows(5)->maxLength(2000)->columnSpanFull()
                ->helperText('Gerekirse yorumu düzenleyebilirsiniz (ör. uygunsuz kısmı çıkarmak için).'),
            Forms\Components\Select::make('status')->label('Durum')
                ->options([
                    'pending' => 'Onay bekliyor',
                    'approved' => 'Yayında',
                    'rejected' => 'Reddedildi',
                ])
                ->default('pending')->required()->native(false),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')
                    ->dateTime('d.m.Y H:i')->timezone('Europe/Istanbul')->sortable(),
                Tables\Columns\TextColumn::make('user.nickname')->label('Kullanıcı')
                    ->getStateUsing(fn (ContentComment $r) => $r->authorName())
                    ->searchable(),
                Tables\Columns\TextColumn::make('content.title')->label('Haber')
                    ->limit(40)->wrap()->tooltip(fn (ContentComment $r) => $r->content?->title)
                    ->searchable(),
                Tables\Columns\TextColumn::make('body')->label('Yorum')
                    ->limit(70)->wrap()->tooltip(fn (ContentComment $r) => $r->body),
                Tables\Columns\TextColumn::make('status')->label('Durum')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'pending' => 'Onay bekliyor',
                        'approved' => 'Yayında',
                        'rejected' => 'Reddedildi',
                        default => $state,
                    })
                    ->color(fn (string $state) => match ($state) {
                        'pending' => 'warning',
                        'approved' => 'success',
                        'rejected' => 'danger',
                        default => 'gray',
                    }),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')
                    ->options([
                        'pending' => 'Onay bekliyor',
                        'approved' => 'Yayında',
                        'rejected' => 'Reddedildi',
                    ])
                    ->default('pending'),
            ])
            ->actions([
                // Onayla: yorumu yayina al (approved). Yalniz onaylanmamis satirlarda gorunur.
                Tables\Actions\Action::make('approve')->label('Onayla')
                    ->icon('heroicon-o-check-circle')->color('success')
                    ->visible(fn (ContentComment $r) => $r->status !== 'approved')
                    ->action(function (ContentComment $r) {
                        $r->update(['status' => 'approved', 'approved_at' => now()]);
                        Notification::make()->title('Yorum yayına alındı')->success()->send();
                    }),
                // Reddet: yorumu gizle (rejected). Yalniz reddedilmemis satirlarda gorunur.
                Tables\Actions\Action::make('reject')->label('Reddet')
                    ->icon('heroicon-o-x-circle')->color('danger')
                    ->requiresConfirmation()
                    ->visible(fn (ContentComment $r) => $r->status !== 'rejected')
                    ->action(function (ContentComment $r) {
                        $r->update(['status' => 'rejected']);
                        Notification::make()->title('Yorum reddedildi')->warning()->send();
                    }),
                Tables\Actions\EditAction::make()->label('Düzenle'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ])
            ->bulkActions([
                // Toplu onay: secili yorumlari tek seferde yayina al.
                Tables\Actions\BulkAction::make('approveSelected')->label('Seçilenleri onayla')
                    ->icon('heroicon-o-check-circle')->color('success')
                    ->action(fn ($records) => $records->each->update(['status' => 'approved', 'approved_at' => now()]))
                    ->deselectRecordsAfterCompletion(),
                Tables\Actions\DeleteBulkAction::make()->label('Seçilenleri sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListContentComments::route('/'),
            'edit' => Pages\EditContentComment::route('/{record}/edit'),
        ];
    }
}
