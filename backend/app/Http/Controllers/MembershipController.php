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
            return response()->json(['message' => 'Ücretsiz deneme hakkın zaten kullanıldı.'], 422);
        }

        $u->plan = $data['plan'];
        $u->plan_until = now()->addDays(7);
        $u->trial_used = true;
        $u->save();

        return response()->json(['user' => $u]);
    }
}
