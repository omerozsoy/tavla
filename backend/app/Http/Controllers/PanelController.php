<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PanelController extends Controller
{
    /* ---------- Kimlik ---------- */

    public function showLogin()
    {
        if (Auth::check() && Auth::user()->is_admin) {
            return redirect('/panel/users');
        }
        return view('panel.login');
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($data)) {
            return back()->withErrors(['email' => 'E-posta veya şifre hatalı.'])->withInput();
        }
        if (! Auth::user()->is_admin) {
            Auth::logout();
            return back()->withErrors(['email' => 'Bu hesap yönetici değil.']);
        }
        $request->session()->regenerate();
        return redirect('/panel/users');
    }

    // Sitede giris yapmis admin, Sanctum token'i ile /panel'e sifresiz girer.
    // "Yonetim" dugmesi -> /panel/enter?token=<sanctum-token>
    public function enter(Request $request)
    {
        $token = (string) $request->query('token', '');
        $access = $token ? \Laravel\Sanctum\PersonalAccessToken::findToken($token) : null;
        $user = $access?->tokenable;
        if ($user && $user->is_admin) {
            Auth::login($user);
            $request->session()->regenerate();
            return redirect('/panel/users');
        }
        return redirect('/panel/login')->withErrors(['email' => 'Oturum doğrulanamadı, giriş yap.']);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/panel/login');
    }

    /* ---------- Uyeler ---------- */

    public function users(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $query = User::query()->orderByDesc('created_at');
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('nickname', 'like', "%{$q}%")
                    ->orWhere('first_name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%");
            });
        }
        $users = $query->paginate(30)->withQueryString();
        return view('panel.users', ['users' => $users, 'q' => $q]);
    }

    public function userUpdate(Request $request, User $user)
    {
        $me = $request->user();
        $action = $request->input('action');

        if ($action === 'coins') {
            $user->coins = max(0, (int) $request->input('coins', 0));
            $user->save();
        } elseif ($action === 'rating') {
            // Rating'i (Elo) elle ayarla; seviye/lig bu degere gore hesaplanir.
            $user->rating = max(100, min(4000, (int) $request->input('rating', 1500)));
            $user->save();
        } elseif ($action === 'ban') {
            if ($user->id !== $me->id) {
                $user->banned_at = $user->banned_at ? null : now();
                if ($user->banned_at) {
                    $user->tokens()->delete();
                }
                $user->save();
            }
        } elseif ($action === 'admin') {
            if ($user->id !== $me->id && ! ($user->isConfigAdmin() && $user->is_admin)) {
                $user->is_admin = ! $user->is_admin;
                $user->save();
            }
        } elseif ($action === 'plan') {
            $plan = $request->input('plan', 'free');
            $days = max(0, (int) $request->input('days', 30));
            if (in_array($plan, ['free', 'star', 'starpro'], true)) {
                $user->plan = $plan;
                $user->plan_until = $plan === 'free' ? null : now()->addDays($days ?: 30);
                $user->save();
            }
        }
        return back()->with('ok', 'Üye güncellendi.');
    }

    /* ---------- Turnuvalar ---------- */

    public function tournaments()
    {
        $list = Tournament::orderByDesc('created_at')->limit(100)->get();
        return view('panel.tournaments', ['list' => $list]);
    }

    public function tournamentCreate(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'size' => ['required', 'integer', 'in:0,4,8,16,32,64,128,256'],
            'prize_coins' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'entry_fee' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ]);
        Tournament::create([
            'name' => $data['name'],
            'size' => $data['size'],
            'status' => 'open',
            'creator_id' => $request->user()->id,
            'prize_coins' => $data['prize_coins'] ?? 0,
            'entry_fee' => $data['entry_fee'] ?? 0,
            'players' => [],
        ]);
        return back()->with('ok', 'Turnuva oluşturuldu.');
    }

    public function tournamentFinish(Tournament $tournament)
    {
        $tournament->status = 'finished';
        $tournament->save();
        return back()->with('ok', 'Turnuva bitirildi.');
    }

    public function tournamentDelete(Tournament $tournament)
    {
        $tournament->delete();
        return back()->with('ok', 'Turnuva silindi.');
    }

    /* ---------- Icerik ---------- */

    private const TYPES = ['service', 'event', 'club', 'blog', 'news', 'ad', 'quiz'];

    public function contents(Request $request)
    {
        $type = (string) $request->query('type', 'service');
        if (! in_array($type, self::TYPES, true)) {
            $type = 'service';
        }
        $items = Content::where('type', $type)->orderByDesc('id')->get();
        $editing = null;
        if ($request->filled('edit')) {
            $editing = Content::find((int) $request->query('edit'));
        }
        return view('panel.content', [
            'type' => $type,
            'items' => $items,
            'types' => self::TYPES,
            'editing' => $editing,
        ]);
    }

    public function contentSave(Request $request)
    {
        $data = $request->validate([
            'id' => ['nullable', 'integer'],
            'type' => ['required', 'in:'.implode(',', self::TYPES)],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:20000'],
            'organizer' => ['nullable', 'string', 'max:200'],
            'place' => ['nullable', 'string', 'max:300'],
            'province' => ['nullable', 'string', 'max:60'],
            'contact' => ['nullable', 'string', 'max:200'],
            'image' => ['nullable', 'string', 'max:500'],
            'image_file' => ['nullable', 'image', 'max:5120'],
            'event_at' => ['nullable', 'date'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'published' => ['nullable'],
        ]);
        $data['published'] = $request->boolean('published');
        $data['sort'] = $data['sort'] ?? 0;
        unset($data['image_file']);

        // Gorsel yuklendiyse public/uploads'a tasi
        if ($request->hasFile('image_file')) {
            $file = $request->file('image_file');
            $ext = $file->getClientOriginalExtension() ?: 'jpg';
            $name = 'c_'.uniqid().'.'.$ext;
            $dir = public_path('uploads');
            if (! is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
            $file->move($dir, $name);
            $data['image'] = '/uploads/'.$name;
        }

        // Quiz: soru = title; sikler + dogru cevap + aciklama -> body JSON
        if ($data['type'] === 'quiz') {
            $opts = array_values(array_filter(
                [
                    trim((string) $request->input('opt1', '')),
                    trim((string) $request->input('opt2', '')),
                    trim((string) $request->input('opt3', '')),
                    trim((string) $request->input('opt4', '')),
                ],
                fn ($o) => $o !== ''
            ));
            $answer = (int) $request->input('answer', 0);
            if ($answer < 0 || $answer >= count($opts)) {
                $answer = 0;
            }
            $data['body'] = json_encode([
                'options' => $opts,
                'answer' => $answer,
                'explain' => trim((string) $request->input('explain', '')),
            ], JSON_UNESCAPED_UNICODE);
        }

        if (! empty($data['id'])) {
            $c = Content::findOrFail($data['id']);
            $c->update($data);
        } else {
            Content::create($data);
        }
        return redirect('/panel/content?type='.$data['type'])->with('ok', 'İçerik kaydedildi.');
    }

    public function contentDelete(Content $content)
    {
        $type = $content->type;
        $content->delete();
        return redirect('/panel/content?type='.$type)->with('ok', 'İçerik silindi.');
    }

    /* ---------- Bildirimler ---------- */

    public function notifications()
    {
        $recent = \App\Models\Notification::orderByDesc('id')->limit(50)->get();
        // id -> nickname eslemesi (gonderilenlerin kime gittigini gostermek icin)
        $userIds = $recent->pluck('user_id')->unique()->all();
        $names = User::whereIn('id', $userIds)->pluck('nickname', 'id');
        $memberCount = User::count();
        return view('panel.notifications', [
            'recent' => $recent,
            'names' => $names,
            'memberCount' => $memberCount,
        ]);
    }

    public function notificationSend(Request $request)
    {
        $data = $request->validate([
            'target' => ['required', 'in:all,user'],
            'query' => ['nullable', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:2000'],
            'icon' => ['nullable', 'string', 'max:32'],
        ]);
        $icon = $data['icon'] ?: 'bell';

        if ($data['target'] === 'all') {
            // Tum uyelere: her uye icin bir satir (parca parca ekle)
            $now = now();
            User::select('id')->chunk(500, function ($chunk) use ($data, $icon, $now) {
                $rows = $chunk->map(fn ($u) => [
                    'user_id' => $u->id,
                    'title' => $data['title'],
                    'body' => $data['body'] ?? null,
                    'icon' => $icon,
                    'read' => false,
                    'created_at' => $now,
                ])->all();
                \App\Models\Notification::insert($rows);
            });
            return back()->with('ok', 'Bildirim tüm üyelere gönderildi.');
        }

        // Tek uye: nickname / e-posta / id ile bul
        $q = trim((string) ($data['query'] ?? ''));
        if ($q === '') {
            return back()->withErrors(['query' => 'Üye seç (nickname, e-posta veya id).'])->withInput();
        }
        $user = User::where('nickname', $q)
            ->orWhere('email', $q)
            ->orWhere('id', is_numeric($q) ? (int) $q : 0)
            ->first();
        if (! $user) {
            return back()->withErrors(['query' => 'Üye bulunamadı.'])->withInput();
        }
        \App\Models\Notification::notify($user->id, $data['title'], $data['body'] ?? null, $icon);
        return back()->with('ok', "Bildirim gönderildi: {$user->nickname}");
    }

    // ---- Mail testi: mevcut SMTP ayarini goster + tek tikla test e-postasi ----
    public function mail(Request $request)
    {
        return view('panel.mail', [
            'cfg' => [
                'mailer' => config('mail.default'),
                'host' => config('mail.mailers.smtp.host'),
                'port' => config('mail.mailers.smtp.port'),
                'username' => config('mail.mailers.smtp.username'),
                'from' => config('mail.from.address'),
                'from_name' => config('mail.from.name'),
            ],
            'defaultTo' => $request->user()?->email,
        ]);
    }

    public function mailTest(Request $request)
    {
        $data = $request->validate([
            'to' => ['required', 'email'],
        ]);
        $mailer = config('mail.default');
        try {
            \Illuminate\Support\Facades\Mail::raw(
                "TavlaTv test e-postasi.\n\nBu mesaji gorduyseniz mail ayarlariniz calisiyor. \n(surucu: {$mailer})\n\nTarih: ".now()->toDateTimeString(),
                function ($m) use ($data) {
                    $m->to($data['to'])->subject('TavlaTv — Mail Testi');
                }
            );
        } catch (\Throwable $e) {
            return back()->withErrors(['to' => 'Gönderim hatası: '.$e->getMessage()])->withInput();
        }
        if ($mailer === 'log') {
            return back()->with(
                'ok',
                "Gönderildi ama sürücü 'log' — e-posta storage/logs/laravel.log'a yazıldı, gelen kutusuna GİTMEDİ. Gerçek teslim için .env'de SMTP ayarla."
            );
        }
        return back()->with('ok', "Test e-postası gönderildi: {$data['to']} (sürücü: {$mailer}). Gelen kutusunu ve spam'i kontrol et.");
    }
}
