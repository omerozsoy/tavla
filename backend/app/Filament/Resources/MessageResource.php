<?php

namespace App\Filament\Resources;

use App\Filament\Resources\MessageResource\Pages;
use App\Models\Message;
use App\Models\User;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\HtmlString;

/**
 * "Sohbetler": kullanicilar arasi ozel mesajlasma (DM, messages tablosu). Salt-okunur denetim
 * ekrani — admin isme gore arayip "Sohbeti Gor" ile iki kisi arasindaki tum konusmayi gorur.
 * Panelden mesaj eklenmez/duzenlenmez (yalniz silme).
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

    /** Iki kullanici arasindaki tum DM'leri (her iki yon) kronolojik baloncuklar halinde render et. */
    protected static function renderThread(Message $record): HtmlString
    {
        $a = (int) $record->sender_id;
        $b = (int) $record->receiver_id;

        $msgs = Message::query()
            ->where(function ($q) use ($a, $b) {
                $q->where('sender_id', $a)->where('receiver_id', $b);
            })
            ->orWhere(function ($q) use ($a, $b) {
                $q->where('sender_id', $b)->where('receiver_id', $a);
            })
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $names = User::whereIn('id', [$a, $b])->pluck('nickname', 'id');
        $rows = '';
        foreach ($msgs as $m) {
            $mine = (int) $m->sender_id === $a;
            $name = e((string) ($names[$m->sender_id] ?? ('#'.$m->sender_id)));
            $time = $m->created_at?->timezone('Europe/Istanbul')->format('d.m.Y H:i') ?? '';
            $body = $m->body !== null && $m->body !== '' ? nl2br(e((string) $m->body)) : '';
            $img = $m->image ? '<div><img src="'.e((string) $m->image).'" style="max-width:180px;border-radius:6px;margin-top:4px;"></div>' : '';
            $align = $mine ? 'flex-end' : 'flex-start';
            $bg = $mine ? '#dbeafe' : '#faf7f1';
            $rows .= '<div style="display:flex;justify-content:'.$align.';margin:4px 0;">'
                .'<div style="max-width:70%;background:'.$bg.';border:1px solid #e7e0d4;border-radius:10px;padding:8px 10px;">'
                .'<div style="font-weight:700;color:#2f2a24;font-size:12px;">'.$name.'</div>'
                .'<div style="color:#2f2a24;line-height:1.4;">'.$body.$img.'</div>'
                .'<div style="color:#9c9488;font-size:11px;margin-top:3px;text-align:right;">'.$time.'</div>'
                .'</div></div>';
        }
        if ($rows === '') {
            $rows = '<em style="color:#6b6154;">Mesaj yok.</em>';
        }

        return new HtmlString('<div style="max-height:60vh;overflow:auto;padding:4px;">'.$rows.'</div>');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Tables\Columns\TextColumn::make('created_at')->label('Tarih')
                    ->dateTime('d.m.Y H:i')->timezone('Europe/Istanbul')->sortable(),
                Tables\Columns\TextColumn::make('sender.nickname')->label('Gönderen')
                    ->placeholder('—')->searchable()->weight('bold'),
                Tables\Columns\TextColumn::make('receiver.nickname')->label('Alıcı')
                    ->placeholder('—')->searchable(),
                Tables\Columns\TextColumn::make('body')->label('Mesaj')
                    ->limit(60)->placeholder('—')->wrap()
                    ->tooltip(fn (Message $r) => $r->body),
                Tables\Columns\IconColumn::make('read_at')->label('Okundu')
                    ->boolean()->getStateUsing(fn (Message $r) => $r->read_at !== null),
            ])
            ->actions([
                Tables\Actions\Action::make('thread')->label('Sohbeti Gör')
                    ->icon('heroicon-o-chat-bubble-left-right')
                    ->modalHeading(fn (Message $r) => ($r->sender?->nickname ?: '#'.$r->sender_id)
                        .' ↔ '.($r->receiver?->nickname ?: '#'.$r->receiver_id))
                    ->modalContent(fn (Message $r) => static::renderThread($r))
                    ->modalSubmitAction(false)
                    ->modalCancelActionLabel('Kapat'),
                Tables\Actions\DeleteAction::make()->label('Sil'),
            ])
            ->bulkActions([
                Tables\Actions\DeleteBulkAction::make()->label('Seçilenleri sil'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMessages::route('/'),
        ];
    }
}
