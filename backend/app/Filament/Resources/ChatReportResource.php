<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ChatReportResource\Pages;
use App\Models\ChatReport;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\HtmlString;

/**
 * "Küfür Şikayetleri": oyuncuların maç sohbetindeki "Şikayet Et" butonuyla gönderdiği
 * uygunsuz dil şikayetleri. Her kayıt: şikayet eden + edilen taraf + şikayet anındaki SON 10
 * sohbet satırı. Kayıtlar yalnız şikayetten oluşur (panelden eklenmez) -> Create yok.
 */
class ChatReportResource extends Resource
{
    protected static ?string $model = ChatReport::class;

    protected static ?string $navigationIcon = 'heroicon-o-flag';

    protected static ?string $navigationLabel = 'Küfür Şikayetleri';

    protected static ?string $modelLabel = 'küfür şikayeti';

    protected static ?string $pluralModelLabel = 'Küfür Şikayetleri';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 1; // Hata Bildirimleri'nin (0) hemen altı

    public static function getNavigationBadge(): ?string
    {
        $count = static::getModel()::where('status', 'new')->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    /** Sohbet logunu okunur HTML'e çevir: şikayet edilen tarafı KIRMIZI, sistemi gri vurgular. */
    protected static function renderLog(?ChatReport $record): HtmlString
    {
        $msgs = is_array($record?->messages) ? $record->messages : [];
        if (empty($msgs)) {
            return new HtmlString('<em style="color:#6b6154;">Sohbet satırı yok.</em>');
        }
        $reported = $record?->reported_name;
        $rows = '';
        foreach ($msgs as $m) {
            $name = e((string) ($m['name'] ?? ''));
            $text = e((string) ($m['text'] ?? ''));
            $slot = (string) ($m['slot'] ?? '');
            if ($slot === 'sys') {
                $rows .= '<div style="color:#b45309;font-style:italic;margin:2px 0;">⚠️ '.$text.'</div>';

                continue;
            }
            $isReported = $reported && $name === e((string) $reported);
            $color = $isReported ? '#b91c1c' : '#2f2a24';
            $weight = $isReported ? '700' : '600';
            $rows .= '<div style="margin:3px 0;"><span style="color:'.$color.';font-weight:'.$weight.';">'
                .$name.($isReported ? ' (şikayet edilen)' : '').':</span> <span style="color:#2f2a24;">'.$text.'</span></div>';
        }

        return new HtmlString('<div style="background:#faf7f1;border:1px solid #e7e0d4;border-radius:8px;padding:12px;line-height:1.5;">'.$rows.'</div>');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Placeholder::make('reporter_name')->label('Şikayet eden')
                ->content(fn (?ChatReport $r) => $r?->reporter_name ?: '—'),
            Forms\Components\Placeholder::make('reported_name')->label('Şikayet edilen')
                ->content(fn (?ChatReport $r) => $r?->reported_name ?: '—'),

            Forms\Components\Placeholder::make('room_code')->label('Maç kodu')
                ->content(fn (?ChatReport $r) => $r?->room_code ?: '—'),
            Forms\Components\Placeholder::make('created_at')->label('Şikayet zamanı')
                ->content(fn (?ChatReport $r) => $r?->created_at?->timezone('Europe/Istanbul')->format('d.m.Y H:i') ?? '—'),

            Forms\Components\Placeholder::make('log')->label('Konuşma (son 10 satır)')
                ->content(fn (?ChatReport $r) => static::renderLog($r))
                ->columnSpanFull(),

            Forms\Components\Select::make('status')->label('Durum')
                ->options([
                    'new' => 'Yeni',
                    'in_progress' => 'İnceleniyor',
                    'resolved' => 'Çözüldü',
                ])
                ->default('new')->required()->native(false),

            Forms\Components\Textarea::make('admin_note')->label('Yönetici notu (dahili)')
                ->helperText('Yalnızca panelde görünür.')
                ->rows(3)->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')
                    ->dateTime('d.m.Y H:i')->timezone('Europe/Istanbul')->sortable(),
                Tables\Columns\TextColumn::make('reporter_name')->label('Şikayet eden')
                    ->placeholder('—')->searchable(),
                Tables\Columns\TextColumn::make('reported_name')->label('Şikayet edilen')
                    ->placeholder('—')->searchable()->color('danger')->weight('bold'),
                Tables\Columns\TextColumn::make('room_code')->label('Maç')
                    ->badge()->color('gray')->searchable(),
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
            'index' => Pages\ListChatReports::route('/'),
            'edit' => Pages\EditChatReport::route('/{record}/edit'),
        ];
    }
}
