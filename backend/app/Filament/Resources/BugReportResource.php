<?php

namespace App\Filament\Resources;

use App\Filament\Resources\BugReportResource\Pages;
use App\Models\BugReport;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

/**
 * "Hata Bildirimleri": kullanicilarin sag kenar "Hata Bildir" formundan gonderdigi bildirimler.
 * Hangi sayfada hata yasandigi + aciklama + (varsa) ekran goruntusu + tarayici bilgisi burada
 * incelenir; durum (yeni/inceleniyor/cozuldu) ve yonetici notu guncellenir. Kayitlar SALT
 * bildirimden olusur (panelden yeni eklenmez) -> Create yok.
 */
class BugReportResource extends Resource
{
    protected static ?string $model = BugReport::class;

    protected static ?string $navigationIcon = 'heroicon-o-bug-ant';

    protected static ?string $navigationLabel = 'Hata Bildirimleri';

    protected static ?string $modelLabel = 'hata bildirimi';

    protected static ?string $pluralModelLabel = 'Hata Bildirimleri';

    protected static ?string $navigationGroup = 'Destek';

    protected static ?int $navigationSort = 1;

    // Yeni (incelenmemis) bildirim sayisini menu rozetinde goster.
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
            Forms\Components\Placeholder::make('message')->label('Açıklama')
                ->content(fn (?BugReport $record) => $record?->message ?? '—')
                ->columnSpanFull(),

            Forms\Components\Placeholder::make('page')->label('Hata yaşanan sayfa')
                ->content(fn (?BugReport $record) => $record?->page ?: '—'),
            Forms\Components\Placeholder::make('url')->label('Adres (URL)')
                ->content(fn (?BugReport $record) => $record?->url ?: '—'),

            Forms\Components\Placeholder::make('name')->label('Bildiren')
                ->content(fn (?BugReport $record) => $record?->name ?: 'Misafir'),
            Forms\Components\Placeholder::make('email')->label('E-posta')
                ->content(fn (?BugReport $record) => $record?->email ?: '—'),

            Forms\Components\Placeholder::make('user_agent')->label('Tarayıcı')
                ->content(fn (?BugReport $record) => $record?->user_agent ?: '—')
                ->columnSpanFull(),

            // Ekran goruntusu: uploads diskinde tutulan dosya (varsa) onizleme.
            Forms\Components\ViewField::make('screenshot_preview')
                ->label('Ekran görüntüsü')
                ->view('filament.bug-report-screenshot')
                ->visible(fn (?BugReport $record) => (bool) $record?->screenshot)
                ->columnSpanFull(),

            Forms\Components\Select::make('status')->label('Durum')
                ->options([
                    'new' => 'Yeni',
                    'in_progress' => 'İnceleniyor',
                    'resolved' => 'Çözüldü',
                ])
                ->default('new')->required()->native(false),

            Forms\Components\Textarea::make('admin_note')->label('Yönetici notu (dahili)')
                ->helperText('Yalnızca panelde görünür; bildirene gönderilmez.')
                ->rows(3)->columnSpanFull(),

            // Bildirene gönderilen yanıt (üstteki "Yanıtla ve E-posta Gönder" butonuyla
            // yazılır + e-postalanır). Burada son gönderilen yanıt SALT-OKUNUR gösterilir.
            Forms\Components\Placeholder::make('admin_reply')->label('Bildirene gönderilen yanıt')
                ->content(fn (?BugReport $record) => $record?->admin_reply
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
                    ->dateTime('d.m.Y H:i')->sortable(),
                Tables\Columns\ImageColumn::make('screenshot')->label('Görsel')
                    ->disk('uploads')->height(40)->square()
                    ->defaultImageUrl(null)->placeholder('—'),
                Tables\Columns\TextColumn::make('message')->label('Açıklama')
                    ->limit(60)->wrap()->tooltip(fn (BugReport $r) => $r->message),
                Tables\Columns\TextColumn::make('page')->label('Sayfa')
                    ->limit(30)->placeholder('—'),
                Tables\Columns\TextColumn::make('name')->label('Bildiren')
                    ->placeholder('Misafir')->searchable(),
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
            'index' => Pages\ListBugReports::route('/'),
            'edit' => Pages\EditBugReport::route('/{record}/edit'),
        ];
    }
}
