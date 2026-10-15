<?php

namespace App\Filament\Resources\MatchResultResource\Pages;

use App\Filament\Resources\MatchResultResource;
use App\Models\MatchResult;
use Filament\Actions\Action;
use Filament\Infolists\Components\Section;
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

    /**
     * Skorbord verisi: tek match_results satırı iki tarafı da taşır (oyuncu + rakip).
     * PR'ın TEK yetkilisi gnubg (gnubg_pr); kayıtlı istemci pr'ı yalnız gnubg'den gerçekten
     * farklıysa (tutarsızlık) ayrıca gösterilir — yeni maçlarda pr == gnubg_pr olduğundan
     * "iki PR" görünmez.
     */
    public static function summaryData(MatchResult $r): array
    {
        $gnubg = $r->gnubg_pr ?? $r->pr;              // gösterilen (yetkili) PR
        $stored = $r->pr;                             // eski istemci PR'ı
        $mismatch = $gnubg !== null && $stored !== null
            && abs((float) $gnubg - (float) $stored) > 0.01;

        $stake = (int) ($r->stake ?? ($r->room?->stake ?? 0));

        return [
            'id' => $r->id,
            'type_label' => MatchResultResource::matchTypeLabel($r->match_type, $r->match_length),
            'type_color' => $r->match_type === 'coin' ? 'warning' : ($r->match_type === 'ai' ? 'gray' : 'info'),
            'is_ai' => $r->match_type === 'ai',
            'date' => $r->created_at?->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i:s') ?? '—',
            'score' => ($r->score_self === null && $r->score_opp === null)
                ? '—' : ((int) $r->score_self).' - '.((int) $r->score_opp),
            'stake' => $stake,
            'coins_after' => $r->coins_after !== null ? (int) $r->coins_after : null,
            'room' => $r->room_code,
            'pr_mismatch' => $mismatch,
            'self' => [
                'name' => $r->user?->nickname ?? '—',
                'won' => (bool) $r->won,
                'pr' => $gnubg,
                'checker_pr' => $r->gnubg_checker_pr, // Pul Oyunu PR (gnubg)
                'cube_pr' => $r->gnubg_cube_pr,       // Küp PR (gnubg; küp kararı yoksa null)
                'stored_pr' => $stored,
                'luck' => $r->luck_emg, // gnubg luck equity (tek yetkili şans; istemci HAM luck kaldırıldı)
                'rating_before' => $r->rating_before,
                'rating_after' => $r->rating_after,
                'delta' => (int) ($r->delta ?? 0),
            ],
            'opp' => [
                'name' => $r->opponent_name ?: '—',
                'pr' => $r->opponent_pr,
                'rating' => $r->opponent_rating,
            ],
        ];
    }

    public function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            // MAÇ ÖZETİ: tek bakışta iki oyuncu + skor + PR + puan (maç-sonu özeti gibi).
            Section::make('Maç Özeti')
                ->schema([
                    ViewEntry::make('summary')->hiddenLabel()
                        ->state(fn (MatchResult $r) => self::summaryData($r))
                        ->view('filament.match-result.summary')->columnSpanFull(),
                ]),
            // OKUNUR hamle/zar kaydı: her hamle + zarı + notasyon (sunucu-otoriter match_moves).
            Section::make('Hamle / Zar Kaydı')
                ->description('Maçın her hamlesi, zarı ve notasyonu — sıra ile (sunucu-otoriter kayıttan).')
                ->schema([
                    ViewEntry::make('moveLog')->hiddenLabel()
                        ->view('filament.match-result.move-log')->columnSpanFull(),
                ])
                ->collapsible(),
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
