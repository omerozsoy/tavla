<?php

namespace App\Console\Commands;

use App\Models\Room;
use App\Models\User;
use App\Support\AvatarStore;
use Illuminate\Console\Command;

/**
 * Mevcut base64 (data:) avatarları WebP dosyaya + kısa URL'e çevirir.
 *
 * İDEMPOTENT + RESUMABLE: yalnız `data:` ile başlayan avatarlar seçilir; çevrilince URL olur,
 * tekrar çalıştırınca atlanır. Yarıda kesilirse kaldığı yerden devam eder.
 *
 *   php artisan avatars:migrate            # yalnız users.avatar
 *   php artisan avatars:migrate --rooms    # + AKTİF odaların (waiting/playing) p1/p2_avatar'ı
 */
class MigrateAvatars extends Command
{
    protected $signature = 'avatars:migrate {--rooms : aktif odalardaki base64 avatarları da çevir}';

    protected $description = 'Base64 (data:) avatarları WebP dosya + kısa URL e çevirir (idempotent, resumable)';

    public function handle(): int
    {
        $users = 0;
        User::where('avatar', 'like', 'data:%')->chunkById(200, function ($rows) use (&$users) {
            foreach ($rows as $u) {
                $url = AvatarStore::store($u->avatar);
                if ($url !== null && $url !== $u->avatar && ! str_starts_with($url, 'data:')) {
                    $u->avatar = $url;
                    $u->saveQuietly(); // model event/observer tetikleme (yan etki yok)
                    $users++;
                }
            }
            $this->info("… $users kullanıcı çevrildi");
        });
        $this->info("Kullanıcı avatarları: $users çevrildi.");

        if ($this->option('rooms')) {
            $rooms = 0;
            Room::whereIn('status', ['waiting', 'playing'])
                ->where(fn ($q) => $q->where('p1_avatar', 'like', 'data:%')->orWhere('p2_avatar', 'like', 'data:%'))
                ->chunkById(200, function ($rows) use (&$rooms) {
                    foreach ($rows as $r) {
                        $changed = false;
                        if (str_starts_with((string) $r->p1_avatar, 'data:')) {
                            $r->p1_avatar = AvatarStore::store($r->p1_avatar);
                            $changed = true;
                        }
                        if (str_starts_with((string) $r->p2_avatar, 'data:')) {
                            $r->p2_avatar = AvatarStore::store($r->p2_avatar);
                            $changed = true;
                        }
                        if ($changed) {
                            $r->save();
                            $rooms++;
                        }
                    }
                });
            $this->info("Aktif oda avatarları: $rooms çevrildi.");
        }

        return self::SUCCESS;
    }
}
