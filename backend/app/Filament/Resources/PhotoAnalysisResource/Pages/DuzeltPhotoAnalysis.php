<?php

namespace App\Filament\Resources\PhotoAnalysisResource\Pages;

use App\Filament\Resources\PhotoAnalysisResource;
use App\Models\PhotoAnalysis;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Concerns\InteractsWithRecord;
use Filament\Resources\Pages\Page;
use Illuminate\Support\Facades\URL;

/**
 * Admin foto düzeltme — Filament panelin İÇİNDE native (iframe YOK, ön yüz YOK). SOLDA foto, SAĞDA
 * tıklanabilir Alpine/SVG tahta (temalı board'a görsel yakın). Fırça Sen/Rakip/Sil + Bar/Sıra/Zar/Küp.
 * Düzeltilmiş konum Livewire ile `$pos`'a akar; Kaydet (header action) ground_truth'a yazar
 * (review_status='labeled'). Session-auth (panel admin) — token/API yok.
 */
class DuzeltPhotoAnalysis extends Page
{
    use InteractsWithRecord;

    protected static string $resource = PhotoAnalysisResource::class;

    protected static string $view = 'filament.photo-duzelt';

    /** Düzenlenen konum (Alpine board buraya $wire.set ile yazar). */
    public array $pos = [];

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
        $this->pos = static::editorPosition($this->record);
    }

    public function getTitle(): string
    {
        return 'Foto Düzelt #'.$this->getRecord()->id;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('save')->label('Kaydet → Eğitime hazır')
                ->icon('heroicon-o-check')->color('success')->action('save'),
        ];
    }

    /**
     * Düzeltilmiş konumu eğitim etiketi (ground_truth) olarak kaydet. Admin bu konumu DOĞRU onayladı →
     * review_status='labeled'. Alpine deferred $pos action commit'inde flush olur.
     */
    public function save(): void
    {
        $pos = $this->pos;
        $points = $pos['points'] ?? [];
        if (! is_array($points) || count($points) !== 24 || ! in_array($pos['turn'] ?? null, ['white', 'black'], true)) {
            Notification::make()->danger()->title('Geçersiz konum')->body('24 nokta + sıra şart.')->send();

            return;
        }

        $this->getRecord()->labelCorrected([
            'points' => array_values(array_map('intval', $points)),
            'bar' => ['white' => (int) ($pos['bar']['white'] ?? 0), 'black' => (int) ($pos['bar']['black'] ?? 0)],
            'turn' => $pos['turn'],
            'dice' => array_values(array_filter(array_map('intval', $pos['dice'] ?? []), fn ($d) => $d >= 1 && $d <= 6)),
            'cube' => [
                'value' => (int) ($pos['cube']['value'] ?? 1),
                'owner' => in_array($pos['cube']['owner'] ?? null, ['white', 'black'], true) ? $pos['cube']['owner'] : null,
            ],
        ]);

        Notification::make()->success()->title('Kaydedildi — eğitime hazır (+'.PhotoAnalysis::REPORT_REWARD.' coin bildirene)')->send();
        $this->redirect(PhotoAnalysisResource::getUrl('index'));
    }

    /** Blade view verisi: foto, okunan zar/küp referansı, oryantasyon. */
    protected function getViewData(): array
    {
        $r = $this->getRecord();
        $pos = is_array($r->position) ? $r->position : [];

        return [
            'mineDark' => ($r->debug['photographer'] ?? null) === 'dark',
            'homeLeft' => (bool) $r->flip,
            'photoUrl' => URL::temporarySignedRoute('admin.photo-analysis.image', now()->addMinutes(30), ['photoAnalysis' => $r->id]),
            'readDice' => array_values(array_filter(array_map('intval', $pos['dice'] ?? []), fn ($d) => $d >= 1 && $d <= 6)),
            'readCube' => $pos['cube'] ?? null,
        ];
    }

    /** ground_truth varsa ondan, yoksa tanınan konumdan 24-nokta normalize başlangıç. */
    private static function editorPosition(PhotoAnalysis $r): array
    {
        $p = is_array($r->ground_truth) ? $r->ground_truth : (is_array($r->position) ? $r->position : []);

        return [
            'points' => array_map(fn ($i) => (int) ($p['points'][$i] ?? 0), range(0, 23)),
            'bar' => ['white' => (int) ($p['bar']['white'] ?? 0), 'black' => (int) ($p['bar']['black'] ?? 0)],
            'turn' => in_array($p['turn'] ?? null, ['white', 'black'], true) ? $p['turn'] : 'white',
            'dice' => array_values(array_filter(array_map('intval', $p['dice'] ?? []), fn ($d) => $d >= 1 && $d <= 6)),
            'cube' => [
                'value' => (int) ($p['cube']['value'] ?? 1),
                'owner' => in_array($p['cube']['owner'] ?? null, ['white', 'black'], true) ? $p['cube']['owner'] : null,
            ],
        ];
    }
}
