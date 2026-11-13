<?php

namespace App\Http\Controllers;

use App\Models\Tournament;
use App\Support\Swiss\SwissRuntime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ORGANİZATÖR PANELİ: Dışarda (salon) Swiss turnuvasını siteye admin girmeden yöneten yetkili kullanıcı.
 * Admin turnuvaya manager_user_id atar; o kullanıcı SADECE kendi turnuvalarına katılımcı ekler + sonuç
 * girer. Tüm uçlar auth (sanctum) + turnuva-sahipliği kontrolü (managed) ile korunur.
 */
class OrganizerController extends Controller
{
    /** Auth kullanıcı bu turnuvanın organizatörü mü? Değilse 403. */
    private function managed(Request $request, Tournament $tournament): Tournament
    {
        if ((int) $tournament->manager_user_id !== (int) $request->user()->id) {
            abort(403, 'Bu turnuvayı yönetme yetkin yok.');
        }

        return $tournament;
    }

    /** Henüz çözülmemiş gerçek maçlar: [{key, round, p1:{id,name}, p2:{id,name}}] (bay/eksik hariç). */
    private function pendingMatches(Tournament $t): array
    {
        $out = [];
        foreach ((is_array($t->bracket) ? $t->bracket : []) as $cells) {
            foreach ($cells as $m) {
                if (! empty($m['winner']) || ! empty($m['double_loss'])) {
                    continue;
                }
                if (empty($m['p1']['id']) || empty($m['p2']['id'])) {
                    continue; // bay / eksik
                }
                $out[] = [
                    'key' => $m['key'],
                    'round' => $m['round'] ?? null,
                    'p1' => ['id' => (int) $m['p1']['id'], 'name' => $m['p1']['name'] ?? '?'],
                    'p2' => ['id' => (int) $m['p2']['id'], 'name' => $m['p2']['name'] ?? '?'],
                ];
            }
        }

        return $out;
    }

    /** Organizatörün yönettiği turnuvalar (panel listesi). */
    public function index(Request $request)
    {
        $list = Tournament::where('manager_user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (Tournament $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'type' => $t->type,
                'status' => $t->status,
                'count' => count($t->players ?? []),
                'size' => (int) $t->size,
            ]);

        return response()->json(['tournaments' => $list]);
    }

    /** Turnuva detayı: katılımcılar + bekleyen maçlar (sonuç girilecek). */
    public function show(Request $request, Tournament $tournament)
    {
        $t = $this->managed($request, $tournament);
        $playerCount = count(array_filter($t->players ?? [], fn ($p) => ! empty($p['id'])));
        // Kura çek butonu: salon turnuvasında planlı saat gerekmez (draw anında next_at=now kurulur),
        // o yüzden drawStatus'un 'no_datetime' sebebi de ÇEKİLEBİLİR sayılır.
        $drawReason = Tournament::isSwissType($t->type) ? SwissRuntime::drawStatus($t)['reason'] : 'na';
        $canDraw = $t->status === 'running' && in_array($drawReason, ['ok', 'no_datetime'], true);

        return response()->json([
            'id' => $t->id,
            'name' => $t->name,
            'type' => $t->type,
            'status' => $t->status,
            'canStart' => $t->status === 'open' && Tournament::isSwissType($t->type) && $playerCount >= 2,
            'canDraw' => $canDraw,
            'round' => (int) ($t->swiss_state['round'] ?? 0),
            'players' => array_values(array_map(fn ($p) => [
                'id' => (int) ($p['id'] ?? 0),
                'name' => $p['name'] ?? '',
                'offline' => ! empty($p['offline']),
            ], $t->players ?? [])),
            'pending' => $this->pendingMatches($t),
        ]);
    }

    /** Turnuvayı BAŞLAT (Swiss state kurulur; kura ayrı 'draw' ile çekilir). En az 2 katılımcı. */
    public function start(Request $request, Tournament $tournament)
    {
        $t = $this->managed($request, $tournament);
        if (! Tournament::isSwissType($t->type)) {
            return $this->fail('Yalnızca Swiss turnuva başlatılır.', 422);
        }
        $ok = false;
        DB::transaction(function () use ($t, &$ok) {
            $locked = Tournament::lockForUpdate()->find($t->id);
            if (! $locked || (int) $locked->manager_user_id !== (int) request()->user()->id) {
                return;
            }
            if ($locked->status !== 'open') {
                return;
            }
            $count = count(array_filter($locked->players ?? [], fn ($p) => ! empty($p['id'])));
            if ($count < 2) {
                return;
            }
            SwissRuntime::start($locked);
            $ok = true;
        });

        return $ok ? response()->json(['ok' => true]) : $this->fail('Başlatılamadı: en az 2 katılımcı + kayıt açık olmalı.', 422);
    }

    /** Sıradaki turun kurasını çek. bye verilmezse ve bay gerekiyorsa uygun oyuncular döner (organizatör seçer). */
    public function draw(Request $request, Tournament $tournament)
    {
        $t = $this->managed($request, $tournament);
        $data = $request->validate(['bye' => ['nullable', 'integer', 'min:0']]);
        if (! Tournament::isSwissType($t->type)) {
            return $this->fail('Yalnızca Swiss turnuvada kura çekilir.', 422);
        }
        $res = ['ok' => false, 'reason' => 'x', 'needsBye' => null, 'round' => 0];
        DB::transaction(function () use ($t, $data, &$res) {
            $locked = Tournament::lockForUpdate()->find($t->id);
            if (! $locked || (int) $locked->manager_user_id !== (int) request()->user()->id) {
                $res['reason'] = 'forbidden';

                return;
            }
            if ($locked->status !== 'running') {
                $res['reason'] = 'not_running';

                return;
            }
            // Salon: planlı saat yok -> sıradaki turun saatini şimdiye kur (drawStatus şartı).
            SwissRuntime::setNextRoundAt($locked, now()->format('Y-m-d H:i:s'));
            $elig = SwissRuntime::manualByeEligible($locked);
            $byeProvided = array_key_exists('bye', $data) && $data['bye'] !== null;
            if ($elig && ! $byeProvided) {
                // Bay gerekiyor ama seçilmedi -> organizatöre uygun oyuncuları döndür (salonda kura çeksin).
                $res = ['ok' => false, 'reason' => 'needs_bye', 'needsBye' => $elig, 'round' => SwissRuntime::nextRoundNo($locked)];

                return;
            }
            $bye = $byeProvided ? (int) $data['bye'] : null;
            if ($bye !== null && $elig && ! in_array($bye, array_column($elig, 'id'), true)) {
                $res['reason'] = 'bye_invalid';

                return;
            }
            $r = SwissRuntime::drawRound($locked, $bye);
            $res['ok'] = (bool) $r['ok'];
            $res['reason'] = $r['reason'];
        });
        if ($res['reason'] === 'needs_bye') {
            return response()->json(['ok' => false, 'needsBye' => $res['needsBye'], 'round' => $res['round']]);
        }

        return $res['ok']
            ? response()->json(['ok' => true])
            : $this->fail('Kura çekilemedi ('.$res['reason'].').', 422);
    }

    /** Katılımcı ekle (salon: isimle; yalnız kayıt açıkken). Sentetik POZİTİF id (resolveMatch p1/p2>0). */
    public function addParticipant(Request $request, Tournament $tournament)
    {
        $t = $this->managed($request, $tournament);
        $data = $request->validate(['name' => ['required', 'string', 'max:60']]);
        if ($t->status !== 'open') {
            return $this->fail('Turnuva başladıktan sonra katılımcı eklenemez.', 422);
        }
        $name = trim($data['name']);
        $players = $t->players ?? [];
        $maxId = 900000000; // offline taban (gerçek user id'leriyle çakışmaz)
        foreach ($players as $p) {
            $maxId = max($maxId, (int) ($p['id'] ?? 0));
        }
        $players[] = [
            'id' => $maxId + 1,
            'name' => $name,
            'rating' => 1500,
            'avatar' => null,
            'premium' => false,
            'fee_paid' => 0,
            'offline' => true,
            'entry' => bin2hex(random_bytes(6)),
        ];
        $t->players = $players;
        $t->save();

        return response()->json(['ok' => true, 'id' => $maxId + 1, 'name' => $name]);
    }

    /** Katılımcı çıkar (yalnız kayıt açıkken). */
    public function removeParticipant(Request $request, Tournament $tournament)
    {
        $t = $this->managed($request, $tournament);
        $data = $request->validate(['id' => ['required', 'integer']]);
        if ($t->status !== 'open') {
            return $this->fail('Turnuva başladıktan sonra katılımcı çıkarılamaz.', 422);
        }
        $players = array_values(array_filter(
            $t->players ?? [],
            fn ($p) => (int) ($p['id'] ?? 0) !== (int) $data['id'],
        ));
        $t->players = $players;
        $t->save();

        return response()->json(['ok' => true]);
    }

    /** Bekleyen Swiss maçının sonucunu gir. winner = kazanan oyuncu id'si; 0 = çift mağlubiyet. */
    public function enterResult(Request $request, Tournament $tournament)
    {
        $this->managed($request, $tournament);
        $data = $request->validate([
            'match' => ['required', 'string', 'max:16'],
            'winner' => ['required', 'integer', 'min:0'],
        ]);
        if (! Tournament::isSwissType($tournament->type)) {
            return $this->fail('Yalnızca Swiss turnuvada sonuç girilir.', 422);
        }
        $ok = false;
        DB::transaction(function () use ($tournament, $data, &$ok) {
            $locked = Tournament::lockForUpdate()->find($tournament->id);
            if ($locked && (int) $locked->manager_user_id === (int) request()->user()->id) {
                $ok = SwissRuntime::resolveMatch($locked, $data['match'], (int) $data['winner']);
            }
        });

        return $ok
            ? response()->json(['ok' => true])
            : $this->fail('Sonuç girilemedi (maç bulunamadı / zaten çözülü / geçersiz kazanan).', 422);
    }
}
