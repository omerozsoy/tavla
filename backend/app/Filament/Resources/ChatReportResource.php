<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ChatReportResource\Pages;
use App\Models\ChatReport;
use App\Models\Room;
use App\Models\User;
use App\Support\ChatModeration;
use App\Support\OfficialMessenger;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Schema;
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
                // Şikayet edilene konuşma yasağı ver (iki tarafa da bilgi gider; küfürlü kelimeler
                // Yasaklılar listesine işlenir; şikayet "Çözüldü" olur).
                Tables\Actions\Action::make('ban')->label('Yasak Ver')
                    ->icon('heroicon-o-no-symbol')->color('danger')
                    ->form([
                        Forms\Components\Select::make('minutes')->label('Süre')->required()
                            ->options(self::BAN_DURATIONS)->default('1440')->native(false),
                    ])
                    ->modalHeading('Konuşma yasağı ver')
                    ->modalDescription(fn (ChatReport $r) => ($r->reported_name ?: 'Şikayet edilen')
                        .' oyuncusuna yasak uygulanacak; hem şikayet edene hem edilene bilgi mesajı gönderilecek.')
                    ->action(fn (ChatReport $record, array $data) => static::applyBanFromReport($record, (int) $data['minutes'])),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ])
            ->bulkActions([
                Tables\Actions\DeleteBulkAction::make()->label('Seçilenleri sil'),
            ]);
    }

    /** Yasak süresi seçenekleri (dakika => etiket). chatMuteFormSchema ile aynı (kaldır hariç). */
    public const BAN_DURATIONS = [
        '1440' => '24 saat',
        '10080' => '1 hafta',
        '43200' => '1 ay',
        '525600' => '1 yıl',
    ];

    /** Şikayet edilen kullanıcıyı çöz: önce maç odasından karşı slot, yoksa isimden (nickname). */
    protected static function resolveReported(ChatReport $r): ?User
    {
        $room = Room::where('code', $r->room_code)->first();
        if ($room && $r->reporter_slot) {
            $uid = $r->reporter_slot === 'p1' ? $room->p2_user_id : $room->p1_user_id;
            if ($uid && ($u = User::find($uid))) {
                return $u;
            }
        }
        if ($r->reported_name) {
            return User::where('nickname', $r->reported_name)->first();
        }

        return null;
    }

    /** Şikayet edilen oyuncunun satırlarındaki küfürlü kelimeleri topla (Yasaklılar listesine işlenir). */
    protected static function profanityWords(ChatReport $r): ?string
    {
        $words = [];
        foreach ((is_array($r->messages) ? $r->messages : []) as $m) {
            if (($m['slot'] ?? '') === 'sys') {
                continue;
            }
            if ($r->reported_name && ($m['name'] ?? '') !== $r->reported_name) {
                continue; // yalnız şikayet edilenin yazdıkları
            }
            [, $hit, $word] = ChatModeration::filter((string) ($m['text'] ?? ''), null);
            if ($hit && $word && ! in_array($word, $words, true)) {
                $words[] = $word;
            }
        }

        return $words ? mb_substr(implode(', ', $words), 0, 120) : null;
    }

    /**
     * Şikayet sonucu konuşma yasağı uygula: şikayet edilene yasak + küfürlü kelimeleri Yasaklılar
     * listesine işle, HEM şikayet edene HEM edilene bilgi DM'i gönder, maçtaysa kırmızı satır düş,
     * şikayeti "Çözüldü" yap. "Küfür Şikayeti düzenle" ekranından ve listeden çağrılır.
     */
    public static function applyBanFromReport(ChatReport $r, int $minutes): void
    {
        $reported = static::resolveReported($r);
        if (! $reported) {
            Notification::make()->title('Şikayet edilen oyuncu bulunamadı')
                ->body('Oda/isim eşleşmedi; yasak uygulanamadı.')->danger()->send();

            return;
        }
        $label = self::BAN_DURATIONS[(string) $minutes] ?? ($minutes.' dk');

        $reported->chat_muted_until = now()->addMinutes($minutes);
        if (Schema::hasColumn('users', 'chat_muted_by')) {
            $reported->chat_muted_by = (int) auth()->id();
        }
        // Küfürlü kelimeleri Yasaklılar listesine işle ("Tetikleyen Kelime" sütunu).
        if (Schema::hasColumn('users', 'chat_offense_word') && ($words = static::profanityWords($r))) {
            $reported->chat_offense_word = $words;
        }
        $reported->save();

        $reporter = $r->reporter_user_id ? User::find($r->reporter_user_id) : null;
        $reportedName = $reported->nickname ?: ($r->reported_name ?: 'Rakip');
        $reporterName = $r->reporter_name ?: ($reporter?->nickname ?: 'Bir oyuncu');

        // Şikayet edilene bilgi: "X kişinin şikayeti sonucu 24 saat konuşma cezası aldınız."
        OfficialMessenger::sendTo(
            $reported,
            "⚠️ {$reporterName} kişinin şikayeti sonucu {$label} konuşma cezası aldınız. Ceza süresince sohbete yazamazsınız."
        );
        // Şikayet edene bilgi: "X kişisi şikayetiniz sonucu 24 saat konuşma cezası almıştır."
        if ($reporter) {
            OfficialMessenger::sendTo(
                $reporter,
                "✓ {$reportedName} kişisi şikayetiniz sonucu {$label} konuşma cezası almıştır. İlginiz için teşekkürler."
            );
        }
        // Kişi o an maçtaysa maç sohbetine kırmızı satır düş.
        ChatModeration::announceMuteInActiveMatch($reported, false);

        $r->status = 'resolved';
        $stamp = now()->timezone('Europe/Istanbul')->format('d.m.Y H:i');
        $r->admin_note = trim(($r->admin_note ? $r->admin_note."\n" : '')
            ."[{$stamp}] {$label} konuşma yasağı uygulandı ({$reportedName}).");
        $r->save();

        Notification::make()->title('Konuşma yasağı uygulandı')
            ->body("{$reportedName} oyuncusuna {$label} yasak verildi; iki tarafa da bilgi gönderildi.")
            ->success()->send();
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListChatReports::route('/'),
            'edit' => Pages\EditChatReport::route('/{record}/edit'),
        ];
    }
}
