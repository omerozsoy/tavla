<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ContactMessageResource\Pages;
use App\Models\ContactMessage;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * "İletişim Talepleri": footer "İletişim" sayfasindaki ve turnuva organizasyonu
 * landing'lerindeki (/tavla-turnuvasi-organizasyonu + kurumsal/belediye/avm) formdan
 * gonderilen talepler. Kayitlar SALT formdan olusur (panelden yeni eklenmez) -> Create yok.
 * BugReport gelen-kutusu deseniyle ayni.
 */
class ContactMessageResource extends Resource
{
    protected static ?string $model = ContactMessage::class;

    protected static ?string $navigationIcon = 'heroicon-o-envelope';

    protected static ?string $navigationLabel = 'İletişim Talepleri';

    protected static ?string $modelLabel = 'iletişim talebi';

    protected static ?string $pluralModelLabel = 'İletişim Talepleri';

    protected static ?string $navigationGroup = 'İletişim';

    protected static ?int $navigationSort = 0;

    // Yeni (incelenmemis) talep sayisini menu rozetinde goster.
    public static function getNavigationBadge(): ?string
    {
        $count = static::getModel()::where('status', 'new')->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Placeholder::make('message')->label('Mesaj')
                ->content(fn (?ContactMessage $record) => $record?->message ?? '—')
                ->columnSpanFull(),

            Forms\Components\Placeholder::make('name')->label('Ad Soyad')
                ->content(fn (?ContactMessage $record) => $record?->name ?: '—'),
            Forms\Components\Placeholder::make('org')->label('Kurum')
                ->content(fn (?ContactMessage $record) => $record?->org ?: '—'),

            Forms\Components\Placeholder::make('subject')->label('Talep türü')
                ->content(fn (?ContactMessage $record) => ContactMessage::SUBJECTS[$record?->subject] ?? ($record?->subject ?: '—')),
            Forms\Components\Placeholder::make('city')->label('İl / Şehir')
                ->content(fn (?ContactMessage $record) => $record?->city ?: '—'),

            Forms\Components\Placeholder::make('email')->label('E-posta')
                ->content(fn (?ContactMessage $record) => $record?->email ?: '—'),
            Forms\Components\Placeholder::make('phone')->label('Telefon')
                ->content(fn (?ContactMessage $record) => $record?->phone ?: '—'),

            Forms\Components\Placeholder::make('event_date')->label('Etkinlik tarihi')
                ->content(fn (?ContactMessage $record) => $record?->event_date ?: '—'),
            Forms\Components\Placeholder::make('participants')->label('Katılımcı sayısı')
                ->content(fn (?ContactMessage $record) => $record?->participants ? (string) $record->participants : '—'),

            Forms\Components\Placeholder::make('source_page')->label('Gönderilen sayfa')
                ->content(fn (?ContactMessage $record) => $record?->source_page ?: '—'),
            // created_at UTC saklanır -> gösterimde Türkiye saatine (+3) çevrilir.
            Forms\Components\Placeholder::make('created_at')->label('Gönderilme zamanı')
                ->content(fn (?ContactMessage $record) => $record?->created_at?->timezone('Europe/Istanbul')->format('d.m.Y H:i') ?? '—'),

            Forms\Components\Select::make('status')->label('Durum')
                ->options([
                    'new' => 'Yeni',
                    'in_progress' => 'İnceleniyor',
                    'resolved' => 'Çözüldü',
                ])
                ->default('new')->required()->native(false),

            Forms\Components\Textarea::make('admin_note')->label('Yönetici notu (dahili)')
                ->helperText('Yalnızca panelde görünür; talep sahibine gönderilmez.')
                ->rows(3)->columnSpanFull(),

            Forms\Components\Placeholder::make('admin_reply')->label('Talep sahibine gönderilen yanıt')
                ->content(fn (?ContactMessage $record) => $record?->admin_reply
                    ? new \Illuminate\Support\HtmlString(nl2br(e($record->admin_reply))
                        .($record->replied_at
                            ? '<div style="margin-top:8px;font-size:12px;color:#6b6154;">Gönderildi: '
                                .$record->replied_at->format('d.m.Y H:i').'</div>'
                            : ''))
                    : 'Henüz yanıt gönderilmedi. Üstteki “Yanıtla ve E-posta Gönder” butonunu kullanın.')
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')
                    ->dateTime('d.m.Y H:i')->timezone('Europe/Istanbul')->sortable(),
                Tables\Columns\TextColumn::make('name')->label('Ad')->searchable(),
                Tables\Columns\TextColumn::make('org')->label('Kurum')
                    ->limit(30)->placeholder('—')->searchable(),
                Tables\Columns\TextColumn::make('subject')->label('Tür')
                    ->badge()
                    ->formatStateUsing(fn (?string $state) => ContactMessage::SUBJECTS[$state] ?? ($state ?: '—')),
                Tables\Columns\TextColumn::make('message')->label('Mesaj')
                    ->limit(50)->wrap()->tooltip(fn (ContactMessage $r) => $r->message),
                Tables\Columns\TextColumn::make('phone')->label('Telefon')->placeholder('—'),
                Tables\Columns\TextColumn::make('status')->label('Durum')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => match ($state) {
                        'new' => 'Yeni',
                        'in_progress' => 'İnceleniyor',
                        'resolved' => 'Çözüldü',
                        default => $state,
                    })
                    ->color(fn (string $state) => match ($state) {
                        'new' => 'danger',
                        'in_progress' => 'warning',
                        'resolved' => 'success',
                        default => 'gray',
                    }),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')->label('Durum')
                    ->options([
                        'new' => 'Yeni',
                        'in_progress' => 'İnceleniyor',
                        'resolved' => 'Çözüldü',
                    ]),
                Tables\Filters\SelectFilter::make('subject')->label('Talep türü')
                    ->options(ContactMessage::SUBJECTS),
            ])
            ->actions([
                Tables\Actions\EditAction::make()->label('İncele'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ])
            ->bulkActions([
                Tables\Actions\DeleteBulkAction::make()->label('Seçilenleri sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListContactMessages::route('/'),
            'edit' => Pages\EditContactMessage::route('/{record}/edit'),
        ];
    }
}
