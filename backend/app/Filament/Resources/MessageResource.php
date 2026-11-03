<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MessageResource\Pages;
use App\Models\Message;
use App\Models\Room;
use App\Models\User;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\HtmlString;

/**
 * "Sohbetler": kullanicilar arasi tum konusmalar, tek listede. Her satir BİR KONUSMA; "Tür":
 *   • Özel (DM)  — messages tablosu, kisi-cifti basina (yon farketmez) gruplu.
 *   • Maç        — rooms.messages (oda ici sohbet, son 50 satir), oda basina.
 * Satira tiklayinca o konusmanin tum mesajlari thread olarak acilir. Salt-okunur (ekleme/duzenleme yok).
 */
class MessageResource extends Resource
{
    protected static ?string $model = Message::class;

    protected static ?string $navigationIcon = 'heroicon-o-chat-bubble-left-right';

    protected static ?string $navigationLabel = 'Sohbetler';

    protected static ?string $modelLabel = 'sohbet';

    protected static ?string $pluralModelLabel = 'Sohbetler';

    protected static ?string $navigationGroup = 'Güvenlik';

    protected static ?int $navigationSort = 2; // Küfür Şikayetleri'nin (1) hemen altı

    /**
     * Iki kaynak tek listede (UNION): özel DM (messages, kisi-cifti gruplu) + maç sohbeti
     * (rooms.messages dolu odalar). Ortak sütunlar: id(rkey), kind, u1/u2(user id), n1/n2(maç ad),
     * room_code, msg_count, last_at. fromSub → Eloquent sayfalama/siralama/arama calisir.
     */
    public static function getEloquentQuery(): Builder
    {
        // Satir anahtari TAM SAYI olmali (Message int PK): DM pozitif MIN(id), maç NEGATIF -rooms.id
        // → iki kaynak asla cakismaz, Filament satir-tikla dogru kaydi acar. Tur ayrimi `kind` ile.
        $dm = DB::table('messages')
            ->selectRaw("MIN(id) as id, 'dm' as kind, LEAST(sender_id, receiver_id) as u1, GREATEST(sender_id, receiver_id) as u2, CAST(NULL AS CHAR) as n1, CAST(NULL AS CHAR) as n2, CAST(NULL AS CHAR) as room_code, COUNT(*) as msg_count, MAX(created_at) as last_at")
            ->groupByRaw('LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)');

        $match = DB::table('rooms')
            ->whereNotNull('messages')
            ->whereRaw('JSON_LENGTH(messages) > 0')
            ->selectRaw("(0 - CAST(id AS SIGNED)) as id, 'match' as kind, p1_user_id as u1, p2_user_id as u2, p1_name as n1, p2_name as n2, code as room_code, JSON_LENGTH(messages) as msg_count, updated_at as last_at");

        return Message::query()->fromSub($dm->unionAll($match), 'conv')->select('conv.*');
    }

    /** Oyuncu id -> nickname (sayfa icinde memoize; az satir → ucuz). */
    protected static array $nameCache = [];

    protected static function nameFor($id): string
    {
        $id = (int) $id;
        if ($id === 0) {
            return '—';
        }
        if (! array_key_exists($id, static::$nameCache)) {
            static::$nameCache[$id] = User::where('id', $id)->value('nickname') ?: ('#'.$id);
        }

        return static::$nameCache[$id];
    }

    /** Satirdaki bir tarafin gorunur adi: maçta oda-adi (yoksa nickname), DM'de nickname. */
    protected static function partyName(Message $r, int $side): string
    {
        $uid = $side === 1 ? $r->u1 : $r->u2;
        $name = $side === 1 ? $r->n1 : $r->n2;

        return ($r->kind === 'match' && $name) ? $name : static::nameFor($uid);
    }

    /** Baloncuk thread'i ortak HTML kabugu. */
    protected static function wrap(string $rows): HtmlString
    {
        return new HtmlString('<div style="max-height:60vh;overflow:auto;padding:4px;">'
            .($rows !== '' ? $rows : '<em style="color:#6b6154;">Mesaj yok.</em>').'</div>');
    }

    protected static function bubble(string $name, string $body, string $time, bool $mine, string $extra = ''): string
    {
        $align = $mine ? 'flex-end' : 'flex-start';
        $bg = $mine ? '#dbeafe' : '#faf7f1';

        return '<div style="display:flex;justify-content:'.$align.';margin:4px 0;">'
            .'<div style="max-width:70%;background:'.$bg.';border:1px solid #e7e0d4;border-radius:10px;padding:8px 10px;">'
            .'<div style="font-weight:700;color:#2f2a24;font-size:12px;">'.$name.'</div>'
            .'<div style="color:#2f2a24;line-height:1.4;">'.$body.$extra.'</div>'
            .($time !== '' ? '<div style="color:#9c9488;font-size:11px;margin-top:3px;text-align:right;">'.$time.'</div>' : '')
            .'</div></div>';
    }

    /** Özel DM thread'i: iki kullanici arasindaki tum mesajlar (her iki yon) kronolojik. */
    protected static function renderDmThread(Message $record): HtmlString
    {
        $a = (int) $record->u1;
        $b = (int) $record->u2;
        $msgs = Message::query()
            ->where(fn ($q) => $q->where('sender_id', $a)->where('receiver_id', $b))
            ->orWhere(fn ($q) => $q->where('sender_id', $b)->where('receiver_id', $a))
            ->orderBy('created_at')->orderBy('id')->get();
        $names = User::whereIn('id', [$a, $b])->pluck('nickname', 'id');
        $rows = '';
        foreach ($msgs as $m) {
            $name = e((string) ($names[$m->sender_id] ?? ('#'.$m->sender_id)));
            $time = $m->created_at?->timezone('Europe/Istanbul')->format('d.m.Y H:i') ?? '';
            $body = $m->body !== null && $m->body !== '' ? nl2br(e((string) $m->body)) : '';
            $img = $m->image ? '<div><img src="'.e((string) $m->image).'" style="max-width:180px;border-radius:6px;margin-top:4px;"></div>' : '';
            $rows .= static::bubble($name, $body, $time, (int) $m->sender_id === $a, $img);
        }

        return static::wrap($rows);
    }

    /** Maç sohbeti thread'i: rooms.messages (slot/name/text) baloncuklar, sistem satiri gri. */
    protected static function renderMatchThread(Message $record): HtmlString
    {
        $room = Room::where('code', $record->room_code)->first();
        $msgs = is_array($room?->messages) ? $room->messages : [];
        $rows = '';
        foreach ($msgs as $m) {
            $slot = (string) ($m['slot'] ?? '');
            $name = e((string) ($m['name'] ?? ''));
            $text = isset($m['text']) && $m['text'] !== '' ? nl2br(e((string) $m['text'])) : '';
            if ($slot === 'sys' || $slot === 'admin') {
                $rows .= '<div style="color:#b45309;font-style:italic;margin:4px 0;text-align:center;">⚠️ '.$text.'</div>';

                continue;
            }
            $rows .= static::bubble($name, $text, '', $slot === 'p1');
        }

        return static::wrap($rows);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('last_at', 'desc')
            ->recordAction('thread') // satira tiklayinca sohbet thread'i acilir
            ->columns([
                Tables\Columns\TextColumn::make('kind')->label('Tür')
                    ->badge()
                    ->formatStateUsing(fn (string $state) => $state === 'match' ? 'Maç' : 'Özel')
                    ->color(fn (string $state) => $state === 'match' ? 'warning' : 'info'),
                Tables\Columns\TextColumn::make('last_at')->label('Son mesaj')
                    ->dateTime('d.m.Y H:i')->timezone('Europe/Istanbul')->sortable(),
                Tables\Columns\TextColumn::make('u1')->label('Oyuncu 1')
                    ->weight('bold')
                    ->getStateUsing(fn (Message $r) => static::partyName($r, 1))
                    // Isme gore ara: DM (nickname→user id) + maç (oda adi) her iki tarafi kapsar.
                    ->searchable(query: function (Builder $query, string $search): Builder {
                        $ids = User::where('nickname', 'like', "%{$search}%")->pluck('id')->all();

                        return $query->where(function (Builder $q) use ($ids, $search) {
                            if ($ids) {
                                $q->whereIn('u1', $ids)->orWhereIn('u2', $ids);
                            }
                            $q->orWhere('n1', 'like', "%{$search}%")->orWhere('n2', 'like', "%{$search}%");
                        });
                    }),
                Tables\Columns\TextColumn::make('u2')->label('Oyuncu 2')
                    ->getStateUsing(fn (Message $r) => static::partyName($r, 2)),
                Tables\Columns\TextColumn::make('room_code')->label('Oda')
                    ->badge()->color('gray')->placeholder('—'),
                Tables\Columns\TextColumn::make('msg_count')->label('Mesaj')
                    ->badge()->color('gray'),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('kind')->label('Tür')
                    ->options(['dm' => 'Özel', 'match' => 'Maç']),
            ])
            ->actions([
                Tables\Actions\Action::make('thread')->label('Sohbeti Gör')
                    ->icon('heroicon-o-chat-bubble-left-right')
                    ->modalHeading(fn (Message $r) => $r->kind === 'match'
                        ? ('Maç '.$r->room_code.': '.static::partyName($r, 1).' ↔ '.static::partyName($r, 2))
                        : (static::partyName($r, 1).' ↔ '.static::partyName($r, 2)))
                    ->modalContent(fn (Message $r) => $r->kind === 'match'
                        ? static::renderMatchThread($r)
                        : static::renderDmThread($r))
                    ->modalSubmitAction(false)
                    ->modalCancelActionLabel('Kapat'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMessages::route('/'),
        ];
    }
}
