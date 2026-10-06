<?php

namespace App\Support;

use App\Models\Message;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * "Tavla TV Yönetim" resmi mesaj hesabı: admin panelden oyunculara (tekil veya toplu)
 * DM gönderir. Gerçek bir users satırıdır (messages.sender_id bir kullanıcı ister) ama
 * is_system=true ile işaretlidir: giriş yapamaz (rastgele parola), liderlik/oyuncu
 * listelerinden gizli, DM'de istek kutusuna DÜŞMEZ (konuşma daima açık — bkz
 * MessageController isOpen/threads is_system dalı). Görünen ad + avatar panelden ayarlanır.
 */
class OfficialMessenger
{
    /** SABİT resmi hesap kimliği: hesap id=1'e bağlıdır (e-postadan BAĞIMSIZ). #1'in e-postası
     *  değişse bile yeni hesap YARATILMAZ (eski e-posta bağımlılığı bug'ı buradan geliyordu). */
    public const ACCOUNT_ID = 1;

    /** Yalnız ilk kurulum/test'te hesap YOKTURSA oluşturulacak e-posta (çözümleme buna bağlı DEĞİL). */
    public const EMAIL = 'yonetim@sistem.tavlatv';

    public const DEFAULT_NAME = 'Tavla TV Yönetim';

    /** Resmi hesabı getir; yoksa oluştur (giriş yapılamaz). */
    public static function account(): User
    {
        $hasSys = Schema::hasColumn('users', 'is_system');
        // BİRİNCİL: sabit id=1. is_system guard -> id=1 normal bir kullanıcıysa (ör. test ortamı)
        // onu resmi sayma, fallback'e düş. Prod'da #1 = sistem hesabı (TavlaTV) -> doğrudan döner.
        $byId = User::find(self::ACCOUNT_ID);
        if ($byId && (! $hasSys || $byId->is_system)) {
            return $byId;
        }

        // FALLBACK (id=1 sistem hesabı değil/yok — test veya ilk kurulum): e-postayla bul, yoksa oluştur.
        $u = User::where('email', self::EMAIL)->first();
        if (! $u) {
            $u = new User;
            $u->first_name = self::DEFAULT_NAME;
            $u->last_name = '';
            $u->country = 'TR';
            $u->nickname = self::freeNickname(self::DEFAULT_NAME);
            $u->email = self::EMAIL;
            $u->password = Hash::make(Str::random(48));
            if ($hasSys) {
                $u->is_system = true;
            }
            $u->save();
        } elseif ($hasSys && ! $u->is_system) {
            $u->is_system = true;
            $u->save();
        }

        return $u;
    }

    /** Resmi hesap id'si (VARSA) — OLUŞTURMADAN. Rozet/salt-okuma gibi yan etkisiz yerler için.
     *  account() ile AYNI çözümleme: sabit id=1 (is_system) öncelikli; yoksa e-posta fallback. */
    public static function existingId(): ?int
    {
        $hasSys = Schema::hasColumn('users', 'is_system');
        $byId = User::find(self::ACCOUNT_ID);
        if ($byId && (! $hasSys || $byId->is_system)) {
            return (int) $byId->id;
        }

        $id = User::where('email', self::EMAIL)->value('id');

        return $id !== null ? (int) $id : null;
    }

    /** İlk kurulumda çakışmayan bir nickname bul (ad genelde 15 char limitini aştığından güvenli). */
    private static function freeNickname(string $name): string
    {
        $base = trim($name) !== '' ? trim($name) : self::DEFAULT_NAME;
        $nick = $base;
        $i = 1;
        while (User::where('nickname', $nick)->exists()) {
            $nick = $base.' '.(++$i);
        }

        return $nick;
    }

    /** Görünen ad (= nickname). */
    public static function name(): string
    {
        return self::account()->nickname ?: self::DEFAULT_NAME;
    }

    /** Panelde seçili avatar (uploads diskine göreli yol; boş olabilir). */
    public static function avatarPath(): string
    {
        return Setting::get('official_messenger_avatar', '');
    }

    /**
     * Kimliği güncelle (panel). $avatarPath null => avatarı DEĞİŞTİRME (mevcut korunur).
     * Ad başka bir kullanıcıda kullanılıyorsa false döner (çağıran uyarır, kayıt yapılmaz).
     */
    public static function updateIdentity(string $name, ?string $avatarPath): bool
    {
        $u = self::account();
        $name = trim($name) !== '' ? trim($name) : self::DEFAULT_NAME;
        if (User::where('nickname', $name)->where('id', '!=', $u->id)->exists()) {
            return false;
        }
        $u->nickname = $name;
        $u->first_name = $name;
        if ($avatarPath !== null) {
            $path = ltrim($avatarPath, '/');
            Setting::put('official_messenger_avatar', $path);
            $u->avatar = $path !== '' ? '/uploads/'.$path : null;
        }
        $u->save();

        return true;
    }

    /** Tek oyuncuya gönder (body VEYA image gerekli — doğrulama çağırana ait). */
    public static function sendTo(User $to, string $body, ?string $image = null): void
    {
        $official = self::account();
        if ($to->id === $official->id) {
            return;
        }
        $attrs = [
            'sender_id' => $official->id,
            'receiver_id' => $to->id,
            'body' => $body,
            'read_at' => null,
            'created_at' => now(),
        ];
        if (Schema::hasColumn('messages', 'image')) {
            $attrs['image'] = $image;
        }
        Message::create($attrs);
    }

    /** Belirli kullanıcı id'lerine gönder (ör. turnuva katılımcıları). Gönderilen sayısını döndürür. */
    public static function sendToIds(array $ids, string $body, ?string $image = null): int
    {
        $official = self::account();
        $hasImg = Schema::hasColumn('messages', 'image');
        $now = now();
        $rows = [];
        foreach (array_unique(array_map('intval', $ids)) as $id) {
            if ($id <= 0 || $id === (int) $official->id) {
                continue;
            }
            $row = [
                'sender_id' => $official->id,
                'receiver_id' => $id,
                'body' => $body,
                'read_at' => null,
                'created_at' => $now,
            ];
            if ($hasImg) {
                $row['image'] = $image;
            }
            $rows[] = $row;
        }
        if ($rows) {
            Message::insert($rows);
        }

        return count($rows);
    }

    /** Tüm gerçek kullanıcılara gönder (sistem hesapları hariç). Gönderilen sayısını döndürür. */
    public static function broadcast(string $body, ?string $image = null): int
    {
        $official = self::account();
        $hasImg = Schema::hasColumn('messages', 'image');
        $hasSys = Schema::hasColumn('users', 'is_system');
        $now = now();
        $count = 0;

        User::query()
            ->where('id', '!=', $official->id)
            ->when($hasSys, fn ($q) => $q->where('is_system', false))
            ->select('id')
            ->chunkById(500, function ($users) use (&$count, $official, $body, $image, $hasImg, $now) {
                $rows = [];
                foreach ($users as $u) {
                    $row = [
                        'sender_id' => $official->id,
                        'receiver_id' => $u->id,
                        'body' => $body,
                        'read_at' => null,
                        'created_at' => $now,
                    ];
                    if ($hasImg) {
                        $row['image'] = $image;
                    }
                    $rows[] = $row;
                }
                if ($rows) {
                    Message::insert($rows);
                    $count += count($rows);
                }
            });

        return $count;
    }
}
