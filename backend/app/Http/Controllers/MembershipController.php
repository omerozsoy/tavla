<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class MembershipController extends Controller
{
    // 7 gunluk ucretsiz deneme baslat (bir kez). Gercek odeme entegrasyonu ayri.
    public function startTrial(Request $request)
    {
        $data = $request->validate([
            'plan' => ['required', 'in:star,starpro'],
        ]);
        $u = $request->user();

        if ($u->trial_used) {
            return $this->fail('Ücretsiz deneme hakkın zaten kullanıldı.', 422);
        }

        $u->plan = $data['plan'];
        $u->plan_until = now()->addDays(7);
        $u->trial_used = true;
        if (! $u->plan_since) {
            $u->plan_since = now();
        }
        $u->auto_renew = true;
        $u->save();

        return response()->json(['user' => $u]);
    }

    // Otomatik yenilemeyi ac/kapat. Kapaliysa plan_until'da biter, tekrar tahsilat olmaz.
    public function autoRenew(Request $request)
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);
        $u = $request->user();
        $u->auto_renew = $data['enabled'];
        $u->save();

        return response()->json(['user' => $u]);
    }
}
