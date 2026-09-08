<?php

namespace App\Filament\Resources\GameLogResource\Pages;

use App\Filament\Resources\GameLogResource;
use App\Models\GameLog;
use Filament\Actions\Action;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;

class ViewGameLog extends ViewRecord
{
    protected static string $resource = GameLogResource::class;

    /** Başlıkta ".mat indir" — kompakt turlardan üretilen XG uyumlu dosyayı stream indirir. */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('downloadMat')
                ->label('.mat indir')
                ->icon('heroicon-o-arrow-down-tray')
                ->color('gray')
                ->action(function () {
                    /** @var GameLog $record */
                    $record = $this->getRecord();
                    $mat = $record->matText();

                    return response()->streamDownload(function () use ($mat) {
                        echo $mat;
                    }, $record->matFilename(), ['Content-Type' => 'text/plain; charset=utf-8']);
                }),
        ];
    }

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
                    TextEntry::make('status')->label('Durum')->badge()
                        ->formatStateUsing(fn ($state) => $state === 'finished' ? 'Bitti' : 'Sürüyor')
                        ->color(fn ($state) => $state === 'finished' ? 'success' : 'warning'),
                    TextEntry::make('created_at')->label('Tarih')->dateTime('d.m.Y H:i', 'Europe/Istanbul'),
                ])
                ->columns(3),
            Section::make('Özet')
                ->schema([
                    TextEntry::make('game_count')->label('Oyun sayısı')
                        ->state(fn (GameLog $r) => collect($r->mergedTurns())
                            ->map(fn ($t) => (int) ($t['g'] ?? 1))->unique()->count()),
                    TextEntry::make('turn_count')->label('Toplam tur (hamle/kup)')
                        ->state(fn (GameLog $r) => collect($r->mergedTurns())
                            ->filter(fn ($t) => ($t['k'] ?? null) !== 'end')->count()),
                    TextEntry::make('duration')->label('Süre')
                        ->state(function (GameLog $r) {
                            if (! $r->created_at || ! $r->updated_at) {
                                return '—';
                            }
                            $sec = (int) abs($r->updated_at->diffInSeconds($r->created_at));
                            if ($sec < 60) {
                                return $sec.' sn';
                            }

                            return intdiv($sec, 60).' dk '.($sec % 60).' sn';
                        }),
                ])
                ->columns(3),
            Section::make('Analiz — PR / Şans / Puan')
                ->description('Online maçta her oyuncunun sunucu-otoriter sonuç kaydı (uid = oda kodu ile eşleşir).')
                ->schema([
                    ViewEntry::make('related')->hiddenLabel()
                        ->view('filament.game-log-results')->columnSpanFull(),
                ])
                ->collapsible(),
            Section::make('.mat Dosyası (XG uyumlu)')
                ->description('Kompakt tur kaydından üretilir; Extreme Gammon ile açılır. Başlıktaki “.mat indir” ile dosyayı kaydedin.')
                ->schema([
                    ViewEntry::make('mat')->hiddenLabel()
                        ->view('filament.game-log-mat')->columnSpanFull(),
                ])
                ->collapsible(),
            Section::make('Hamleler ve Zarlar')
                ->schema([
                    ViewEntry::make('replay')->hiddenLabel()
                        ->view('filament.game-log-replay')->columnSpanFull(),
                ]),
        ]);
    }
}
