<?php

namespace App\Http\Controllers;

use App\Models\UserAddress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Adreslerim (adres defteri) CRUD. Kullanıcı yalnız KENDİ adreslerini yönetir.
 * type: shipping (teslimat) | billing (fatura). Her tip içinde bir varsayılan.
 */
class AddressController extends Controller
{
    // GET /addresses — kullanıcının tüm adresleri (tip + varsayılan sıralı).
    public function index(Request $request)
    {
        $items = UserAddress::where('user_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->get();

        return response()->json(['addresses' => $items]);
    }

    private function rules(): array
    {
        return [
            'type' => ['required', Rule::in(UserAddress::TYPES)],
            'title' => ['nullable', 'string', 'max:60'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            'address' => ['required', 'string', 'max:1000'],
            'city' => ['required', 'string', 'max:80'],
            'district' => ['nullable', 'string', 'max:80'],
            'postal' => ['nullable', 'string', 'max:20'],
            'is_default' => ['boolean'],
            // Fatura alanları (opsiyonel)
            'company' => ['nullable', 'string', 'max:160'],
            'tax_office' => ['nullable', 'string', 'max:120'],
            'tax_number' => ['nullable', 'string', 'max:40'],
        ];
    }

    // POST /addresses
    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $data['user_id'] = $request->user()->id;
        $data['is_default'] = (bool) ($data['is_default'] ?? false);

        $address = DB::transaction(function () use ($data, $request) {
            // İlk adres (o tipte) otomatik varsayılan olsun.
            $firstOfType = ! UserAddress::where('user_id', $request->user()->id)->where('type', $data['type'])->exists();
            if ($firstOfType) {
                $data['is_default'] = true;
            }
            $a = UserAddress::create($data);
            if ($a->is_default) {
                $this->clearOtherDefaults($a);
            }
            return $a;
        });

        return response()->json(['address' => $address], 201);
    }

    // PUT /addresses/{address}
    public function update(Request $request, UserAddress $address)
    {
        $this->authorizeOwner($request, $address);
        $data = $request->validate($this->rules());
        $data['is_default'] = (bool) ($data['is_default'] ?? false);

        DB::transaction(function () use ($address, $data) {
            $address->update($data);
            if ($address->is_default) {
                $this->clearOtherDefaults($address);
            }
        });

        return response()->json(['address' => $address->fresh()]);
    }

    // DELETE /addresses/{address}
    public function destroy(Request $request, UserAddress $address)
    {
        $this->authorizeOwner($request, $address);
        $wasDefault = $address->is_default;
        $type = $address->type;
        $userId = $address->user_id;
        $address->delete();

        // Varsayılan silindiyse aynı tipte en yeni adresi varsayılan yap.
        if ($wasDefault) {
            $next = UserAddress::where('user_id', $userId)->where('type', $type)->orderByDesc('id')->first();
            if ($next) {
                $next->is_default = true;
                $next->save();
            }
        }

        return $this->ok();
    }

    // Aynı tip + kullanıcıda bu adres dışındaki varsayılanları kaldır.
    private function clearOtherDefaults(UserAddress $address): void
    {
        UserAddress::where('user_id', $address->user_id)
            ->where('type', $address->type)
            ->where('id', '!=', $address->id)
            ->update(['is_default' => false]);
    }

    private function authorizeOwner(Request $request, UserAddress $address): void
    {
        abort_if($address->user_id !== $request->user()->id, 403, 'Bu adrese erişim yok.');
    }
}
