<?php

namespace App\Support\TeamLeague;

use App\Jobs\SendPushJob;
use App\Models\Notification;
use App\Models\TeamNotification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Takımlar Ligi bildirimleri (§11) — site içi + push + izinliyse e-posta. team_notifications defteriyle
 * İDEMPOTENT: her (match,kind,channel,anchor_at) bir kez. Push/e-posta hatası sonucu bozmaz; başarısız
 * kanal defteri yazmaz → sonraki tick yeniden dener (mükerrer yok). LeagueNotifier ile aynı sözleşme.
 */
class TeamNotifier
{
    private const CHANNELS = ['site', 'push', 'email'];

    /**
     * Bir olayı alıcı listesine gönder. $matchId dedup anahtarı (maç-dışı olaylar için null → her kanal
     * yine idempotent değil; o yüzden maç olayları için kullan). $anchorAt zaman çıpası.
     *
     * @param  list<int>  $userIds
     */
    public static function fire(?int $matchId, string $kind, Carbon $anchorAt, array $userIds, string $title, string $body, string $icon = 'users'): void
    {
        $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if (empty($userIds)) {
            return;
        }
        foreach (self::CHANNELS as $channel) {
            $exists = TeamNotification::where('match_id', $matchId)->where('kind', $kind)
                ->where('channel', $channel)->where('anchor_at', $anchorAt)->exists();
            if ($exists) {
                continue;
            }
            try {
                foreach ($userIds as $uid) {
                    self::sendChannel($channel, $uid, $title, $body, $icon);
                }
                TeamNotification::create([
                    'match_id' => $matchId, 'kind' => $kind, 'channel' => $channel,
                    'anchor_at' => $anchorAt, 'sent_at' => now(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('team notify failed', ['match' => $matchId, 'kind' => $kind, 'channel' => $channel, 'err' => $e->getMessage()]);
            }
        }
    }

    private static function sendChannel(string $channel, int $userId, string $title, string $body, string $icon): void
    {
        if ($channel === 'site') {
            Notification::notify($userId, $title, $body, $icon, 'team', null, false); // push ayrı kanalda
        } elseif ($channel === 'push') {
            SendPushJob::dispatch($userId, $title, $body, ['action' => 'team']);
        } else { // email (kullanıcı e-postası doğrulanmışsa)
            $email = User::whereKey($userId)->value('email');
            if ($email) {
                Mail::raw($body, fn ($msg) => $msg->to($email)->subject($title));
            }
        }
    }
}
