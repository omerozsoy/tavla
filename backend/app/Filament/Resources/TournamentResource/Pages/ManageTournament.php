<?php

namespace App\Filament\Resources\TournamentResource\Pages;

use App\Filament\Resources\TournamentResource;
use App\Models\Tournament;
use App\Support\Swiss\SwissRuntime;
use App\Support\TournamentModeration;
use Filament\Actions;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Concerns\InteractsWithRecord;
use Filament\Resources\Pages\Page;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turnuva "Yönetim Paneli": /admin/tournaments tablosundaki TEK düğmeden açılır. Eskiden satır
 * aksiyonlarına dağılmış tüm yönetici işlemleri (başlat / diskalifiye / çekilme / sonuç düzelt /
 * tur tarih-saati / kura çek / sıfırla / düzenle) + canlı istatistikler (tur başına oyuncu,
 * biten/kalan maç) burada toplanır. Mantık değişmedi; aksiyonlar TournamentResource'tan taşındı.
 */
class ManageTournament extends Page
{
    use InteractsWithRecord;

    protected static string $resource = TournamentResource::class;

    protected static string $view = 'filament.resources.tournament-resource.pages.manage-tournament';

    protected static ?string $title = 'Yönetim Paneli';

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
    }

    public function getTitle(): string
    {
        return 'Yönetim Paneli — '.$this->record->name;
    }

    private function t(): Tournament
    {
        return $this->record;
    }

    private function isSwiss(): bool
    {
        return ($this->t()->type ?? 'bracket') === 'swiss_triple';
    }

    protected function getHeaderActions(): array
    {
        return [
            $this->startAction(),
            $this->scheduleRoundAction(),
            $this->drawRoundAction(),
            $this->moderationAction('dq'),
            $this->moderationAction('withdraw'),
            $this->correctResultAction(),
            $this->resetAction(),
            Actions\Action::make('edit')
                ->label('Düzenle')
                ->icon('heroicon-o-pencil-square')
                ->color('gray')
                ->url(fn (): string => TournamentResource::getUrl('edit', ['record' => $this->record])),
        ];
    }

    private function startAction(): Actions\Action
    {
        return Actions\Action::make('start')
            ->label('Başlat')
            ->icon('heroicon-o-play')
            ->color('success')
            ->requiresConfirmation()
            ->modalHeading('Turnuvayı başlat')
            ->modalDescription('Turnuva başlatılacak. Eleme ağacında eşleşmeler hemen oluşur. 3 Haklı Swiss\'te KURA OTOMATİK ÇEKİLMEZ: başlattıktan sonra "Tur Tarih/Saati" ile 1. turun tarih/saatini girip "Kura Çek"e basmalısın. Bu işlem geri alınamaz.')
            ->visible(fn (): bool => $this->t()->status === 'open'
                && count(array_filter($this->t()->players ?? [], fn ($p) => $p !== null)) >= 2)
            ->action(function (): void {
                $record = $this->t();
                if (($record->type ?? 'bracket') === 'swiss_triple') {
                    SwissRuntime::start($record);
                } else {
                    $record->startBracket();
                }
                $this->record = $record->fresh();
                Notification::make()->title('Turnuva başlatıldı')->success()->send();
            });
    }

    private function scheduleRoundAction(): Actions\Action
    {
        return Actions\Action::make('scheduleRound')
            ->label('Tur Tarih/Saati')
            ->icon('heroicon-o-calendar-days')
            ->color('info')
            ->visible(fn (): bool => $this->t()->status === 'running' && $this->isSwiss())
            ->form([
                Forms\Components\Placeholder::make('nextInfo')
                    ->label('Sıradaki tur')
                    ->content(fn (): string => SwissRuntime::nextRoundNo($this->t()).'. tur — bu turun oynanacağı tarih/saati girin. Kura, tarih/saat girilmeden ÇEKİLEMEZ.'),
                Forms\Components\DateTimePicker::make('round_at')
                    ->label('Tur başlangıç tarih/saati')
                    ->seconds(false)
                    ->required()
                    ->default(fn () => $this->t()->swiss_state['next_at'] ?? null)
                    ->helperText('Sunucu saati (Türkiye, GMT+3).'),
            ])
            ->modalHeading('Tur tarih/saatini ayarla')
            ->action(function (array $data): void {
                DB::transaction(function () use ($data): void {
                    $t = Tournament::lockForUpdate()->find($this->t()->id);
                    if ($t) {
                        SwissRuntime::setNextRoundAt($t, (string) $data['round_at']);
                    }
                });
                $this->record = $this->t()->fresh();
                Notification::make()->title('Tur tarih/saati kaydedildi')->success()->send();
            });
    }

    private function drawRoundAction(): Actions\Action
    {
        return Actions\Action::make('drawRound')
            ->label('Kura Çek')
            ->icon('heroicon-o-sparkles')
            ->color('success')
            ->visible(fn (): bool => $this->t()->status === 'running' && $this->isSwiss())
            ->requiresConfirmation()
            ->modalHeading('Sıradaki turun kurasını çek')
            ->modalDescription(function (): string {
                $record = $this->t();
                $st = SwissRuntime::drawStatus($record);
                $n = SwissRuntime::nextRoundNo($record);
                $at = $record->swiss_state['next_at'] ?? null;

                return match ($st['reason']) {
                    'ok' => $n.'. tur eşleştirmesi çekilecek (planlanan: '.$at.'). Aynı haklılar eşleşir, daha önce oynamışlar mümkünse eşleşmez.',
                    'round_incomplete' => '⛔ Bu turdaki TÜM maçlar bitmeden kura ÇEKİLEMEZ. Önce bekleyen maçları bitir/çöz (Sonuç düzelt).',
                    'no_datetime' => '⛔ Önce '.$n.'. turun tarih/saatini girin ("Tur Tarih/Saati"). Tarih/saati belli olmayan turun kurası çekilmez.',
                    'finished' => 'Turnuva bitti; çekilecek tur yok.',
                    default => 'Kura şu an çekilemez.',
                };
            })
            ->action(function (): void {
                $res = ['ok' => false, 'reason' => 'x'];
                DB::transaction(function () use (&$res): void {
                    $t = Tournament::lockForUpdate()->find($this->t()->id);
                    if ($t) {
                        $res = SwissRuntime::drawRound($t);
                    }
                });
                $this->record = $this->t()->fresh();
                $msg = match ($res['reason']) {
                    'ok' => 'Kura çekildi — sıradaki tur oluşturuldu.',
                    'round_incomplete' => 'Çekilemedi: bu turdaki tüm maçlar bitmedi.',
                    'no_datetime' => 'Çekilemedi: önce tur tarih/saatini girin.',
                    'finished' => 'Çekilemedi: turnuva bitti.',
                    default => 'Kura çekilemedi.',
                };
                Notification::make()->title($msg)->{$res['ok'] ? 'success' : 'warning'}()->send();
            });
    }

    private function moderationAction(string $mode): Actions\Action
    {
        $isDq = $mode === 'dq';

        return Actions\Action::make($isDq ? 'disqualify' : 'withdrawPlayer')
            ->label($isDq ? 'Diskalifiye' : 'Çekilme (hükmen)')
            ->icon($isDq ? 'heroicon-o-no-symbol' : 'heroicon-o-arrow-right-start-on-rectangle')
            ->color($isDq ? 'danger' : 'warning')
            ->visible(fn (): bool => $this->t()->status === 'open'
                || ($this->t()->status === 'running' && $this->isSwiss()))
            ->form([
                Forms\Components\Select::make('user_id')
                    ->label('Oyuncu')
                    ->options(fn (): array => collect($this->t()->players ?? [])
                        ->filter()
                        ->mapWithKeys(fn ($p) => [(int) $p['id'] => ($p['name'] ?? ('#'.$p['id']))])
                        ->all())
                    ->searchable()
                    ->required(),
            ])
            ->requiresConfirmation()
            ->modalHeading($isDq ? 'Oyuncuyu diskalifiye et' : 'Oyuncuyu turnuvadan çek')
            ->modalDescription($isDq
                ? 'Kayıt açıksa oyuncu listeden çıkarılır + giriş ücreti iade edilir. Turnuva sürüyorsa hükmen uygulanır: sıradaki maçı rakibine verilir ve bir daha eşleşmeye alınmaz. Bu işlem geri alınamaz.'
                : 'Oyuncu adına çekilme kaydeder (örn. "devam edemeyeceğim" diyen oyuncu). Kayıt açıksa listeden çıkarılır + giriş ücreti iade; turnuva sürüyorsa sıradaki maçı rakibine verilir. Diskalifiyeden farkı: durum "çekildi" (ceza değil) olarak işaretlenir. Geri alınamaz.')
            ->action(function (array $data) use ($mode, $isDq): void {
                $uid = (int) $data['user_id'];
                DB::transaction(function () use ($uid, $mode): void {
                    $t = Tournament::lockForUpdate()->find($this->t()->id);
                    if ($t) {
                        TournamentModeration::remove($t, $uid, $mode);
                    }
                });
                $this->record = $this->t()->fresh();
                Notification::make()
                    ->title($isDq ? 'Oyuncu diskalifiye edildi' : 'Oyuncu turnuvadan çekildi')
                    ->success()
                    ->send();
            });
    }

    private function correctResultAction(): Actions\Action
    {
        return Actions\Action::make('correctResult')
            ->label('Sonuç düzelt')
            ->icon('heroicon-o-pencil-square')
            ->color('warning')
            ->visible(fn (): bool => $this->t()->status === 'running' && $this->isSwiss())
            ->form([
                Forms\Components\Select::make('match')
                    ->label('Maç (bekleyen)')
                    ->options(fn (): array => TournamentResource::pendingSwissMatches($this->t()))
                    ->required()
                    ->helperText('Yalnızca henüz sonuçlanmamış gerçek maçlar listelenir.'),
                Forms\Components\Radio::make('outcome')
                    ->label('Sonuç')
                    ->options([
                        'p1' => '1. oyuncu kazandı (hükmen)',
                        'p2' => '2. oyuncu kazandı (hükmen)',
                        'double_loss' => 'Çift mağlubiyet (ikisi de gelmedi)',
                    ])
                    ->required(),
            ])
            ->requiresConfirmation()
            ->modalHeading('Maç sonucunu düzelt')
            ->modalDescription('Bekleyen bir maçı hükmen çözer (galip ilan veya çift mağlubiyet). Çift mağlubiyet: iki oyuncuya da birer mağlubiyet yazılır, galip yok. Uygulanmış (sonraki tur üretilmiş) sonuçlar buradan düzeltilemez.')
            ->action(function (array $data): void {
                $ok = false;
                DB::transaction(function () use ($data, &$ok): void {
                    $t = Tournament::lockForUpdate()->find($this->t()->id);
                    if (! $t) {
                        return;
                    }
                    $cell = TournamentResource::findCell($t, $data['match']);
                    if (! $cell) {
                        return;
                    }
                    $outcome = $data['outcome'] === 'double_loss' ? 0
                        : (int) ($data['outcome'] === 'p1' ? ($cell['p1']['id'] ?? 0) : ($cell['p2']['id'] ?? 0));
                    $ok = SwissRuntime::resolveMatch($t, $data['match'], $outcome);
                });
                $this->record = $this->t()->fresh();
                Notification::make()
                    ->title($ok ? 'Maç sonucu düzeltildi' : 'Maç düzeltilemedi (zaten çözülmüş olabilir)')
                    ->{$ok ? 'success' : 'warning'}()
                    ->send();
            });
    }

    private function resetAction(): Actions\Action
    {
        return Actions\Action::make('resetTournament')
            ->label('Katılımcıları Temizle')
            ->icon('heroicon-o-arrow-path')
            ->color('danger')
            ->requiresConfirmation()
            ->modalHeading('Turnuvayı sıfırla (açık)')
            ->modalDescription('TÜM katılımcılar, eşleşme ağacı ve şampiyon silinir; turnuva "açık" durumuna döner (yeniden katılıma açılır). Yeniden başlatıldığında eşleşme KURA ile yeniden çekilir. Oynanmış maç sonuçları/ödüller GERİ ALINMAZ. Test turnuvaları için — geri alınamaz.')
            ->action(function (): void {
                $record = $this->t();
                TournamentModeration::cancelWithRefund($record, function (Tournament $t): void {
                    $t->players = [];
                    $t->bracket = [];
                    if (Schema::hasColumn('tournaments', 'swiss_state')) {
                        $t->swiss_state = null;
                    }
                    $t->champion_id = null;
                    $t->prize_paid = false;
                    $t->status = 'open';
                    $t->save();
                });
                $this->record = $record->fresh();
                Notification::make()
                    ->title('Turnuva sıfırlandı (açık)')
                    ->body('Katılımcılar temizlendi. Katılım açık; başlatınca kura yeniden çekilir.')
                    ->success()
                    ->send();
            });
    }

    /**
     * Blade için canlı istatistikler. Üst özet + tur-tur döküm (her turdaki oyuncu sayısı, biten/kalan maç).
     *
     * @return array{summary:array<string,string>, rounds:list<array{round:int,players:int,finished:int,remaining:int,byes:int}>}
     */
    public function stats(): array
    {
        $t = $this->t();
        $players = array_values(array_filter($t->players ?? [], fn ($p) => $p !== null));
        $bracket = is_array($t->bracket) ? $t->bracket : [];

        $rounds = [];
        $totalFinished = 0;
        $totalRemaining = 0;
        foreach ($bracket as $ri => $cells) {
            $p = 0;
            $fin = 0;
            $rem = 0;
            $byes = 0;
            foreach ($cells as $m) {
                $hasP1 = ! empty($m['p1']['id']);
                $hasP2 = ! empty($m['p2']['id']);
                if (! empty($m['bye'])) {
                    $byes++;
                    $p += $hasP1 ? 1 : 0;

                    continue;
                }
                $p += ($hasP1 ? 1 : 0) + ($hasP2 ? 1 : 0);
                if ($hasP1 && $hasP2) {
                    $done = ! empty($m['winner']) || ! empty($m['double_loss']);
                    $done ? $fin++ : $rem++;
                }
            }
            $totalFinished += $fin;
            $totalRemaining += $rem;
            $rounds[] = ['round' => $ri + 1, 'players' => $p, 'finished' => $fin, 'remaining' => $rem, 'byes' => $byes];
        }

        $ss = is_array($t->swiss_state) ? $t->swiss_state : [];
        $summary = [
            'Tip' => Tournament::TYPES[$t->type ?? 'bracket'] ?? 'Bracket System',
            'Durum' => $t->status,
            'Katılımcı' => (string) count($players),
        ];
        if ($this->isSwiss()) {
            $summary['Hak sayısı'] = (string) ($t->swiss_lives ?: 3);
            $summary['Sıradaki tur'] = SwissRuntime::nextRoundNo($t).'. tur';
            $summary['Sıradaki tur saati'] = $ss['next_at'] ?? '—';
        }
        $summary['Biten maç'] = (string) $totalFinished;
        $summary['Kalan maç'] = (string) $totalRemaining;

        return ['summary' => $summary, 'rounds' => $rounds];
    }
}
