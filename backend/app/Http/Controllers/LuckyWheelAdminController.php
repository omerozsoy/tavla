<?php

namespace App\Http\Controllers;

use App\Models\LuckyWheelAudit;
use App\Models\LuckyWheelReward;
use App\Models\LuckyWheelSpin;
use App\Support\LuckyWheelSettings as LWS;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Şans Çarkı YÖNETİM REST ucu (Filament'e ek/paralel programatik erişim). 'admin'
 * middleware ile korunur. Ödül yazımları model booted() event'leri ile otomatik
 * LuckyWheelAudit'e kaydedilir (ekonomik değer -> izlenebilirlik).
 */
class LuckyWheelAdminController extends Controller
{
    // Ödül nesnesini admin için serileştir (gerçek % + bugün/toplam kazanım).
    private function present(LuckyWheelReward $r, int $totalActiveWeight): array
    {
        return [
            'id' => $r->id,
            'name' => $r->name,
            'description' => $r->description,
            'type' => $r->type,
            'amount' => (int) $r->amount,
            'reference_id' => $r->reference_id,
            'weight' => (float) $r->weight,
            'probability' => ($r->is_active && $totalActiveWeight > 0)
                ? round((float) $r->weight / $totalActiveWeight * 100, 2) : 0.0,
            'icon' => $r->icon,
            'slice_color' => $r->slice_color,
            'text_color' => $r->text_color,
            'sort' => (int) $r->sort,
            'stock' => $r->stock,
            'daily_win_limit' => $r->daily_win_limit,
            'per_user_daily_limit' => $r->per_user_daily_limit,
            'per_user_lifetime_limit' => $r->per_user_lifetime_limit,
            'starts_at' => optional($r->starts_at)->toIso8601String(),
            'ends_at' => optional($r->ends_at)->toIso8601String(),
            'is_active' => (bool) $r->is_active,
            'won_today' => LuckyWheelSpin::where('reward_id', $r->id)
                ->where('created_at', '>=', now()->startOfDay())->count(),
            'total_won' => (int) $r->total_won,
        ];
    }

    // GET /admin/lucky-wheel/rewards — tüm ödüller (pasif dahil), sıraya göre.
    public function rewards()
    {
        $totalActiveWeight = LuckyWheelReward::totalActiveWeight();
        $rewards = LuckyWheelReward::query()->orderBy('sort')->orderBy('id')->get()
            ->map(fn ($r) => $this->present($r, $totalActiveWeight))->all();

        return response()->json([
            'rewards' => $rewards,
            'settings' => LWS::all(),
            'totalActiveWeight' => $totalActiveWeight,
            'eligibleCount' => LuckyWheelReward::query()->eligible()->count(),
            'types' => LuckyWheelReward::TYPES,
        ]);
    }

    // Ortak doğrulama kuralları (create/update).
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:255'],
            'type' => ['required', Rule::in(LuckyWheelReward::TYPES)],
            'amount' => ['nullable', 'integer', 'min:0'],
            'reference_id' => ['nullable', 'string', 'max:60'],
            // Weight 0'dan büyük olmalı (kazanılabilir ödül). Ondalık olabilir (örn. 0.5).
            // Salt-gösterim için Filament'ten 0 girilebilir; REST ucu >0 (min 0.01) ister.
            'weight' => ['required', 'numeric', 'min:0.01'],
            'icon' => ['nullable', 'string', 'max:60'],
            'slice_color' => ['nullable', 'string', 'max:20'],
            'text_color' => ['nullable', 'string', 'max:20'],
            'sort' => ['nullable', 'integer'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'daily_win_limit' => ['nullable', 'integer', 'min:0'],
            'per_user_daily_limit' => ['nullable', 'integer', 'min:0'],
            'per_user_lifetime_limit' => ['nullable', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['boolean'],
        ];
    }

    // Aktifleştirme maksimum dilim sayısını aşıyor mu? (spec: max aşılırsa hata)
    private function overMax(bool $willBeActive, ?int $ignoreId = null): bool
    {
        if (! $willBeActive) {
            return false;
        }
        $max = max(2, LWS::int('max_slice_count'));
        $activeOthers = LuckyWheelReward::query()->where('is_active', true)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->count();
        return ($activeOthers + 1) > $max;
    }

    // POST /admin/lucky-wheel/rewards
    public function storeReward(Request $request)
    {
        $data = $request->validate($this->rules());
        $data['is_active'] = (bool) ($data['is_active'] ?? true);

        if ($this->overMax($data['is_active'])) {
            return $this->fail('Maksimum dilim sayısı aşılıyor. Önce max dilimi artır veya bir ödülü pasifleştir.', 422);
        }

        $reward = LuckyWheelReward::create($data); // booted() -> audit
        return response()->json(['reward' => $this->present($reward->fresh(), LuckyWheelReward::totalActiveWeight())], 201);
    }

    // PUT /admin/lucky-wheel/rewards/{reward}
    public function updateReward(Request $request, LuckyWheelReward $reward)
    {
        $data = $request->validate($this->rules());
        $willBeActive = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : (bool) $reward->is_active;

        if ($willBeActive && ! $reward->is_active && $this->overMax(true, $reward->id)) {
            return $this->fail('Maksimum dilim sayısı aşılıyor. Önce max dilimi artır veya bir ödülü pasifleştir.', 422);
        }

        $reward->update($data); // booted() -> audit (değişen alanlar)
        return response()->json(['reward' => $this->present($reward->fresh(), LuckyWheelReward::totalActiveWeight())]);
    }

    // DELETE /admin/lucky-wheel/rewards/{reward}
    public function destroyReward(LuckyWheelReward $reward)
    {
        $reward->delete(); // booted() -> audit
        return $this->ok();
    }

    // GET /admin/lucky-wheel/settings
    public function getSettings()
    {
        return response()->json(['settings' => LWS::all()]);
    }

    // PUT /admin/lucky-wheel/settings
    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'require_login' => ['sometimes', 'boolean'],
            'show_probability' => ['sometimes', 'boolean'],
            'free_spins_per_day' => ['sometimes', 'integer', 'min:0'],
            'cooldown_minutes' => ['sometimes', 'integer', 'min:0'],
            'min_slice_count' => ['sometimes', 'integer', 'min:2', 'max:32'],
            'max_slice_count' => ['sometimes', 'integer', 'min:2', 'max:32'],
            'animation_duration' => ['sometimes', 'integer', 'min:1000', 'max:15000'],
            'reset_hour' => ['sometimes', 'integer', 'min:0', 'max:23'],
            'timezone' => ['sometimes', 'string', 'max:60'],
        ]);

        // min <= max tutarlılığı (yalnız ikisi de biliniyorsa).
        $min = $data['min_slice_count'] ?? LWS::int('min_slice_count');
        $max = $data['max_slice_count'] ?? LWS::int('max_slice_count');
        if ($min > $max) {
            return $this->fail('Minimum dilim, maksimumdan büyük olamaz.', 422);
        }

        foreach ($data as $k => $v) {
            LWS::put($k, $v);
        }
        LuckyWheelAudit::log('settings', 'settings', ['keys' => [null, array_keys($data)]]);

        return response()->json(['settings' => LWS::all()]);
    }

    // POST /admin/lucky-wheel/reorder — {ids: [3,1,2,...]} sırayı belirler (dilim sırası).
    public function reorder(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['ids'] as $i => $id) {
                LuckyWheelReward::where('id', $id)->update(['sort' => $i]);
            }
        });
        LuckyWheelAudit::log('reordered', 'rewards', ['order' => [null, $data['ids']]]);

        return $this->ok(['ids' => $data['ids']]);
    }
}
