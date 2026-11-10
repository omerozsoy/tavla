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

    /** Tur -> datetime-local ('Y-m-d\TH:i') saat girişleri (sayfa içi liste, wire:model). */
    public array $roundTimes = [];

    /** Listede gösterilecek en yüksek tur no ("Tur ekle" artırır; ileri tur planlamak için). */
    public int $maxRow = 1;

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
        $this->syncRoundTimes();
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

    /** Blade: tur saatleri/başlatma listesi yalnız Swiss + bitmemiş turnuvada gösterilir. */
    public function showRoundList(): bool
    {
        return $this->isSwiss() && $this->t()->status !== 'finished';
    }

    protected function getHeaderActions(): array
    {
        return [
            $this->startAction(),
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
            ->label('Turnuvayı Başlat')
            ->icon('heroicon-o-play')
            ->color('success')
            ->requiresConfirmation()
            ->modalHeading('Turnuvayı başlat')
            ->modalDescription('Turnuva başlatılacak. Eleme ağacında eşleşmeler hemen oluşur. 3 Haklı Swiss\'te: 1. turun saatini aşağıdaki listeye girdiysen 1. tur kurası da hemen çekilir (girmediysen turnuva başlar, 1. turu listeden başlatırsın). Bu işlem geri alınamaz.')
            ->visible(fn (): bool => $this->t()->status === 'open'
                && count(array_filter($this->t()->players ?? [], fn ($p) => $p !== null)) >= 2)
            ->action(function (): void {
                if (! $this->isSwiss()) {
                    $this->t()->startBracket();
                    $this->record = $this->t()->fresh();
                    Notification::make()->title('Turnuva başlatıldı')->success()->send();

                    return;
                }
                // Swiss: başlat + (1. tur saati girildiyse) 1. tur kurasını çek — tek tık.
                $times = $this->normalizedTimes();
                $drew = false;
                DB::transaction(function () use ($times, &$drew): void {
                    $t = Tournament::lockForUpdate()->find($this->t()->id);
                    if (! $t) {
                        return;
                    }
                    SwissRuntime::setSchedule($t, $times); // 1. tur saati partial state'e yazılır
                    SwissRuntime::start($t);               // schedule korunur, next_at = schedule[1]
                    $t->refresh();
                    $drew = SwissRuntime::drawRound($t)['ok']; // 1. tur saati varsa çekilir
                });
                $this->record = $this->t()->fresh();
                $this->syncRoundTimes();
                Notification::make()
                    ->title($drew ? 'Turnuva başlatıldı — 1. tur kurası çekildi.' : 'Turnuva başlatıldı.')
                    ->body($drew ? null : '1. turun saatini listeye girip "Başlat"a bas.')
                    ->success()
                    ->send();
            });
    }

    // --- Tur saatleri + tur başlatma (sayfa içi liste; Blade satır-satır render eder) ---

    /** 'Y-m-d H:i:s' <-> datetime-local 'Y-m-d\TH:i'. */
    private function toLocal(?string $at): string
    {
        return $at ? str_replace(' ', 'T', substr((string) $at, 0, 16)) : '';
    }

    private function fromLocal(string $v): string
    {
        $v = str_replace('T', ' ', trim($v));

        return $v === '' ? '' : (strlen($v) === 16 ? $v.':00' : $v);
    }

    /** roundTimes'ı swiss_state (schedule + next_at) ile eşitle, maxRow'u ayarla. */
    public function syncRoundTimes(): void
    {
        $ss = is_array($this->t()->swiss_state) ? $this->t()->swiss_state : [];
        $schedule = is_array($ss['schedule'] ?? null) ? $ss['schedule'] : [];
        $drawn = count(is_array($this->t()->bracket) ? $this->t()->bracket : []);
        $next = $drawn + 1;

        $times = [];
        foreach ($schedule as $r => $at) {
            $times[(string) (int) $r] = $this->toLocal((string) $at);
        }
        if (! isset($times[(string) $next]) && ! empty($ss['next_at'])) {
            $times[(string) $next] = $this->toLocal((string) $ss['next_at']);
        }
        $this->roundTimes = $times;
        $maxSched = $schedule ? max(array_map('intval', array_keys($schedule))) : 0;
        $this->maxRow = max(1, $next, $maxSched);
    }

    /** roundTimes -> saklama formatı schedule map ('Y-m-d H:i:s'). */
    private function normalizedTimes(): array
    {
        $out = [];
        foreach ($this->roundTimes as $r => $v) {
            $r = (int) $r;
            $at = $this->fromLocal((string) $v);
            if ($r > 0 && $at !== '') {
                $out[(string) $r] = $at;
            }
        }

        return $out;
    }

    public function addRound(): void
    {
        $this->maxRow++;
    }

    /** Bir turun saatini sil (çekilmemiş turlar için). Kalan plan kaydedilir. */
    public function clearTime(int $round): void
    {
        unset($this->roundTimes[(string) $round]);
        $times = $this->normalizedTimes();
        DB::transaction(function () use ($times): void {
            $t = Tournament::lockForUpdate()->find($this->t()->id);
            if ($t && SwissRuntime::isSwiss($t)) {
                SwissRuntime::setSchedule($t, $times);
            }
        });
        $this->record = $this->t()->fresh();
        $this->syncRoundTimes();
        Notification::make()->title($round.'. tur saati silindi')->success()->send();
    }

    /** Girilen tüm tur saatlerini kaydet (Swiss). */
    public function saveTimes(): void
    {
        $times = $this->normalizedTimes();
        DB::transaction(function () use ($times): void {
            $t = Tournament::lockForUpdate()->find($this->t()->id);
            if ($t && SwissRuntime::isSwiss($t)) {
                SwissRuntime::setSchedule($t, $times);
            }
        });
        $this->record = $this->t()->fresh();
        $this->syncRoundTimes();
        Notification::make()->title('Tur saatleri kaydedildi')->success()->send();
    }

    /**
     * Bir turu BAŞLAT (kura çek). Yalnız gerçekten sıradaki tur (drawn+1). Önce girilen saatleri
     * kaydeder. Turnuva open + 1. tur ise önce turnuvayı başlatır (plan korunur), sonra kurayı çeker.
     */
    public function startRound(int $round): void
    {
        $times = $this->normalizedTimes();
        $res = ['ok' => false, 'reason' => 'x'];
        DB::transaction(function () use ($round, $times, &$res): void {
            $t = Tournament::lockForUpdate()->find($this->t()->id);
            if (! $t || ! SwissRuntime::isSwiss($t)) {
                return;
            }
            SwissRuntime::setSchedule($t, $times);
            // Turnuva başlamadıysa turu başlatma (önce "Turnuvayı Başlat").
            if ($t->status !== 'running') {
                $res = ['ok' => false, 'reason' => 'not_running'];

                return;
            }
            // Bu turun saati girilmemişse çekme.
            if (empty($times[(string) $round])) {
                $res = ['ok' => false, 'reason' => 'no_datetime'];

                return;
            }
            if ($round !== SwissRuntime::nextRoundNo($t)) {
                $res = ['ok' => false, 'reason' => 'not_next'];

                return;
            }
            $res = SwissRuntime::drawRound($t);
        });
        $this->record = $this->t()->fresh();
        $this->syncRoundTimes();
        $msg = match ($res['reason']) {
            'ok' => $round.'. tur başlatıldı (kura çekildi).',
            'round_incomplete' => 'Başlatılamadı: önceki turun maçları bitmedi.',
            'no_datetime' => 'Başlatılamadı: önce bu turun saatini girip kaydet.',
            'not_next' => 'Başlatılamadı: yalnızca sıradaki tur başlatılabilir.',
            'not_running' => 'Başlatılamadı: turnuva uygun durumda değil.',
            'finished' => 'Başlatılamadı: turnuva bitti.',
            default => 'Tur başlatılamadı.',
        };
        Notification::make()->title($msg)->{$res['ok'] ? 'success' : 'warning'}()->send();
    }

    /**
     * Blade tur listesi: 1..maxRow. status: drawn | next | future. canStart: sıradaki tur +
     * saat girilmiş + (running & tur tamam) ya da (open & 1. tur).
     *
     * @return list<array{round:int,status:string,isNext:bool,canStart:bool,hasTime:bool}>
     */
    public function roundRows(): array
    {
        $t = $this->t();
        $drawn = count(is_array($t->bracket) ? $t->bracket : []);
        $next = $drawn + 1;
        $running = $t->status === 'running';
        $complete = $running ? SwissRuntime::currentRoundComplete($t) : true;
        $rows = [];
        $top = max($this->maxRow, $next);
        for ($r = 1; $r <= $top; $r++) {
            $status = $r <= $drawn ? 'drawn' : ($r === $next ? 'next' : 'future');
            $hasTime = ! empty($this->roundTimes[(string) $r] ?? null);
            // Tur "Başlat": yalnız turnuva running + sıradaki tur + önceki tur tamam + saat girilmiş.
            $canStart = $running && $r === $next && $complete && $hasTime;
            $rows[] = ['round' => $r, 'status' => $status, 'isNext' => $r === $next, 'canStart' => $canStart, 'hasTime' => $hasTime];
        }

        return $rows;
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
