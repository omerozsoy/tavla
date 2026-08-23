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
            'size' => ['required', 'integer', 'in:4,8,16'],
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
}
