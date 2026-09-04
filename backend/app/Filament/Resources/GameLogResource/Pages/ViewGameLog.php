<?php

namespace App\Filament\Resources\GameLogResource\Pages;

use App\Filament\Resources\GameLogResource;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;

class ViewGameLog extends ViewRecord
{
    protected static string $resource = GameLogResource::class;

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            Section::make('Maç')
                ->schema([
                    TextEntry::make('uid')->label('Maç ID')->copyable(),
                    TextEntry::make('mode')->label('Tür')->formatStateUsing(fn ($state) => match ($state) {
                        'pvb' => 'Bilgisayar',
                        'online' => 'Online',
                        'local' => 'Yerel',
                        default => $state,
                    }),
                    TextEntry::make('target')->label('Uzunluk')
                        ->formatStateUsing(fn ($state) => $state > 1 ? $state.' puan' : 'Tek oyun'),
                    TextEntry::make('p1_name')->label('Oyuncu 1')->default('—'),
                    TextEntry::make('p2_name')->label('Oyuncu 2')->default('—'),
                    TextEntry::make('winner')->label('Kazanan')->formatStateUsing(fn ($state) => match ($state) {
                        'white' => 'Beyaz',
                        'black' => 'Siyah',
                        default => '—',
                    }),
                    TextEntry::make('score')->label('Skor')
                        ->formatStateUsing(function ($state) {
                            if (! is_array($state)) {
                                return '—';
                            }

                            return 'Beyaz '.($state['white'] ?? 0).' — '.($state['black'] ?? 0).' Siyah';
                        }),
                    TextEntry::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i', 'Europe/Istanbul'),
                ])
                ->columns(3),
            ViewEntry::make('replay')
                ->label('Hamleler ve Zarlar')
                ->view('filament.game-log-replay')
                ->columnSpanFull(),
        ]);
    }
}
