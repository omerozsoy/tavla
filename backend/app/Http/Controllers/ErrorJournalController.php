<?php

namespace App\Http\Controllers;

use App\Services\ErrorJournalService;
use App\Support\ErrorJournalConfig as Cfg;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Hata Gunlugu API (brief §25, §28-33).
 *
 * Tek uc: gunun/donemin ozeti + kategori kirilimi + son hatalar + insight fakti.
 * Frontend equity/PR/classification TEKRAR HESAPLAMAZ; bu ciktiyi gosterir.
 * Kategori id -> gorunen etiket eslemesi frontend'de (i18n). Kategori sirasi burada.
 */
class ErrorJournalController extends Controller
{
    public function __construct(private readonly ErrorJournalService $journal) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $period = (string) $request->query('period', 'today');
        [$from, $to] = $this->range($period, $request);

        $category = $request->query('category');
        $category = is_string($category) && $category !== '' ? $category : null;
        $limit = min(100, max(1, (int) $request->query('limit', 50)));

        $summary = $this->journal->summary($user, $from, $to);
        $entries = $this->journal->errors($user, $from, $to, $category, $limit);

        return response()->json([
            'period' => $period,
            'from' => optional($from)->toIso8601String(),
            'to' => optional($to)->toIso8601String(),
            'summary' => $summary,
            'entries' => $entries,
            'categoryOrder' => Cfg::CATEGORY_ORDER,
            'insights' => $this->insights($summary),
        ]);
    }

    /**
     * Donem -> [from, to]. Desteklenen (brief §33): today|yesterday|7d|30d|all|custom.
     * custom: ?from=ISO&to=ISO. Varsayilan: today.
     * @return array{0:?Carbon,1:?Carbon}
     */
    private function range(string $period, Request $request): array
    {
        $now = Carbon::now();

        return match ($period) {
            'all' => [null, null],
            'yesterday' => [$now->copy()->subDay()->startOfDay(), $now->copy()->subDay()->endOfDay()],
            '3d' => [$now->copy()->subDays(3)->startOfDay(), $now],
            '7d' => [$now->copy()->subDays(7)->startOfDay(), $now],
            '30d' => [$now->copy()->subDays(30)->startOfDay(), $now],
            'custom' => [
                $this->parseDate($request->query('from')) ?? $now->copy()->startOfDay(),
                $this->parseDate($request->query('to')) ?? $now,
            ],
            default => [$now->copy()->startOfDay(), $now], // today
        };
    }

    private function parseDate($v): ?Carbon
    {
        if (! is_string($v) || $v === '') {
            return null;
        }
        try {
            return Carbon::parse($v);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Insight FAKTLARI (brief §32). Cumleleri frontend i18n ile kurar; biz sadece
     * gercek datayi veririz (sayi uydurma yok).
     *   topWeakness: yeterli ornekte (>=5 karar) en yuksek errorRate'li kategori.
     *   biggestLoss: en cok equity kaybi olan kategori.
     */
    private function insights(array $summary): array
    {
        $cats = $summary['categories'] ?? [];

        $eligible = array_filter($cats, fn ($c) => $c['decisions'] >= 5 && $c['errors'] > 0);
        $topWeakness = null;
        foreach ($eligible as $c) {
            if ($topWeakness === null || $c['errorRate'] > $topWeakness['errorRate']) {
                $topWeakness = $c;
            }
        }

        $biggestLoss = null;
        foreach ($cats as $c) {
            if ($c['equityLoss'] > 0 && ($biggestLoss === null || $c['equityLoss'] > $biggestLoss['equityLoss'])) {
                $biggestLoss = $c;
            }
        }

        return [
            'topWeakness' => $topWeakness,
            'biggestLoss' => $biggestLoss,
        ];
    }
}
