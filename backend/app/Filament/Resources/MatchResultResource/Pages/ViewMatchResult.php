<?php

namespace App\Filament\Resources\MatchResultResource\Pages;

use App\Filament\Resources\MatchResultResource;
use App\Models\MatchResult;
use Filament\Actions\Action;
use Filament\Infolists\Components\Section;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Pages\ViewRecord;

/**
 * Tek bir maç sonucunun tüm detayı (salt-okunur): kim–kim, ne zaman, ne tür, nesine
 * (bahis coin), sonuç, skor, iki tarafın PR'ı, şans, rating değişimi + XG .mat dosyası.
 */
class ViewMatchResult extends ViewRecord
{
    protected static string $resource = MatchResultResource::class;

    /** Başlıkta ".mat indir" — maçın log'undan üretilen XG uyumlu dosyayı stream indirir. */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('downloadMat')
                ->label('.mat indir')
                ->icon('heroicon-o-arrow-down-tray')
                ->color('gray')
                ->visible(fn () => trim($this->getRecord()->matText()) !== '')
                ->action(function () {
                    /** @var MatchResult $record */
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
                    TextEntry::make('user.nickname')->label('Oyuncu')->default('—'),
                    TextEntry::make('opponent_name')->label('Rakip')->default('—'),
                    TextEntry::make('won')->label('Sonuç')->badge()
                        ->formatStateUsing(fn ($state) => $state ? 'Galibiyet' : 'Mağlubiyet')
                        ->color(fn ($state) => $state ? 'success' : 'danger'),
                    TextEntry::make('score')->label('Skor')
                        ->state(fn (MatchResult $r) => ($r->score_self === null && $r->score_opp === null)
                            ? '—'
                            : ((int) $r->score_self).' - '.((int) $r->score_opp)),
                    TextEntry::make('match_type')->label('Tür')->badge()
                        ->formatStateUsing(fn ($state, MatchResult $r) => MatchResultResource::matchTypeLabel($state, $r->match_length))
                        ->color(fn ($state) => $state === 'coin' ? 'warning' : 'info'),
                    TextEntry::make('created_at')->label('Tarih / Saat')
                        ->dateTime('d.m.Y H:i:s', 'Europe/Istanbul'),
                ])
                ->columns(3),
            Section::make('Bahis (Coin)')
                ->schema([
                    TextEntry::make('room.stake')->label('Oynanan bahis')
                        ->state(fn (MatchResult $r) => $r->room && $r->room->stake
                            ? number_format((int) $r->room->stake).' coin'
                            : '—'),
                    TextEntry::make('coins_after')->label('Maç sonrası bakiye')
                        ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((int) $state).' coin'),
                    TextEntry::make('room_code')->label('Oda kodu')->default('—')->copyable(),
                ])
                ->columns(3),
            Section::make('Performans (PR) ve Şans')
                ->description('PR’ın tek yetkilisi gnubg (TavlaTV motoru). “Oyuncu PR” = gnubg değeri. '
                    .'“Kayıtlı PR” eski satırlarda istemci (wildbg) tahmini olabilir; ikisi arasında büyük fark '
                    .'(>10) bir tutarsızlık işaretidir → tavla:gnubg-pr-backfill --rerun ile düzeltilir.')
                ->schema([
                    // BİRİNCİL: gnubg (TavlaTV) PR. Yeni satırlarda pr == gnubg_pr; eski satırlarda gnubg_pr
                    // otoriter değer, pr ise bayat istemci tahmini olabilir -> ikisini de göster.
                    TextEntry::make('gnubg_pr')->label('Oyuncu PR (TavlaTV)')
                        ->state(fn (MatchResult $r) => $r->gnubg_pr ?? $r->pr)
                        ->formatStateUsing(fn ($state) => $state === null ? 'analiz bekliyor' : number_format((float) $state, 2)),
                    TextEntry::make('pr')->label('Kayıtlı PR')
                        ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2)),
                    TextEntry::make('pr_diff')->label('Fark (kayıtlı − gnubg)')
                        ->state(fn (MatchResult $r) => ($r->pr === null || $r->gnubg_pr === null)
                            ? '—' : number_format((float) $r->pr - (float) $r->gnubg_pr, 2))
                        ->color(fn ($state, MatchResult $r) => ($r->pr === null || $r->gnubg_pr === null)
                            ? 'gray' : (abs((float) $r->pr - (float) $r->gnubg_pr) > 10 ? 'danger' : 'gray')),
                    TextEntry::make('opponent_pr')->label('Rakip PR')
                        ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2)),
                    TextEntry::make('luck')->label('Şans')
                        ->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((float) $state, 2)),
                ])
                ->columns(3),
            Section::make('Puan (Rating)')
                ->schema([
                    TextEntry::make('rating_before')->label('Önce'),
                    TextEntry::make('rating_after')->label('Sonra'),
                    TextEntry::make('delta')->label('Değişim')
                        ->formatStateUsing(fn ($state) => ($state > 0 ? '+' : '').(int) $state)
                        ->color(fn ($state) => $state > 0 ? 'success' : ($state < 0 ? 'danger' : 'gray')),
                    TextEntry::make('opponent_rating')->label('Rakip puanı')->default('—'),
                ])
                ->columns(4),
            Section::make('.mat Dosyası (XG uyumlu)')
                ->description('Maçın hamle/zar kaydından üretilir; Extreme Gammon ile açılır. Başlıktaki “.mat indir” ile dosyayı kaydedin. (Online maçta iki oyuncunun logu birleştirilerek tam .mat üretilir.)')
                ->schema([
                    ViewEntry::make('mat')->hiddenLabel()
                        ->view('filament.match-result-mat')->columnSpanFull(),
                ])
                ->collapsible(),
        ]);
    }
}
