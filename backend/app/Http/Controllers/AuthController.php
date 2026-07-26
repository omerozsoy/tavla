<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Uye kaydi
    public function register(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name'  => ['required', 'string', 'max:80'],
            'country'    => ['required', 'string', 'max:80'],
            'nickname'   => ['required', 'string', 'max:40', 'unique:users,nickname'],
            'email'      => ['required', 'email', 'max:120', 'unique:users,email'],
            'password'   => ['required', 'string', 'min:6', 'max:100'],
        ]);

        $user = User::create($data);
        $token = $user->createToken('web')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token], 201);
    }

    // Giris (email veya takma isim + sifre)
    public function login(Request $request)
    {
        $data = $request->validate([
            'login'    => ['required', 'string'], // email veya nickname
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['login'])
            ->orWhere('nickname', $data['login'])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['E-posta/takma isim veya şifre hatalı.'],
            ]);
        }

        $token = $user->createToken('web')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token]);
    }

    // Cikis (mevcut token'i iptal et)
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['ok' => true]);
    }

    // Giris yapmis kullanici
    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()]);
    }

    // Profil guncelle
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name'  => ['required', 'string', 'max:80'],
            'country'    => ['required', 'string', 'max:80'],
            'nickname'   => ['required', 'string', 'max:40', Rule::unique('users', 'nickname')->ignore($user->id)],
            'email'      => ['required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user->id)],
        ]);
        $user->update($data);
        return response()->json(['user' => $user]);
    }

    // Takma isim musait mi? (kayit formu icin, halka acik)
    public function nicknameAvailable(Request $request)
    {
        $nickname = (string) $request->query('nickname', '');
        $taken = User::where('nickname', $nickname)->exists();
        return response()->json(['available' => $nickname !== '' && ! $taken]);
    }
}
