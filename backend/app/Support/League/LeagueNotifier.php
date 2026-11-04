<?php

namespace App\Support\League;

use App\Jobs\SendPushJob;
use App\Models\LeagueMatch;
use App\Models\LeagueNotification;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Lig bildirimleri (§14) — site içi + push + e-posta, league_notifications defteriyle İDEMPOTENT.
 * Her (match,kind,channel,anchor_at) bir kez gönderilir (unique kilit). Push/e-posta hatası sonucu
 * BOZMAZ (best-effort try/catch). Kanal başarıyla gönderilince defter satırı yazılır -> başarısız kanal
 * sonraki tick'te yeniden denenir, başarılı kanal tekrarlanmaz.
 */
class LeagueNotifier
{
    private const CHANNELS = ['site', 'push', 'email'];

    /**
     * Bir olayı iki oyuncuya gönder. $anchorAt olayın zaman çıpası (hatırlatma=randevu saati; eşleşme=
     * sabit referans) -> randevu değişince yeni çıpa yeni hatırlatmaya izin verir, eskisi tekrarlanmaz.
     */
    public static function fire(LeagueMatch $m, string $kind, Carbon $anchorAt, string $title, string $body, string $icon = 'trophy', ?array $channels = null): void
    {
        $users = array_values(array_filter([(int) $m->p1_user_id, (int) $m->p2_user_id]));
        foreach ($channels ?? self::CHANNELS as $channel) {
            $exists = LeagueNotification::where('match_id', $m->id)->where('kind', $kind)
                ->where('channel', $channel)->where('anchor_at', $anchorAt)->exists();
            if ($exists) {
                continue;
            }
            try {
                foreach ($users as $uid) {
                    self::sendChannel($channel, $uid, $title, $body, $icon);
                }
                LeagueNotification::create([
                    'season_id' => $m->season_id, 'match_id' => $m->id, 'kind' => $kind,
                    'channel' => $channel, 'anchor_at' => $anchorAt, 'sent_at' => now(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('league notify failed', ['match' => $m->id, 'kind' => $kind, 'channel' => $channel, 'err' => $e->getMessage()]);
                // defter yazılmaz -> bu kanal sonraki tick'te yeniden denenir (§14 mükerrer YOK, sonuç bozulmaz)
            }
        }
    }

    private static function sendChannel(string $channel, int $userId, string $title, string $body, string $icon): void
    {
        if ($channel === 'site') {
            Notification::notify($userId, $title, $body, $icon, 'league', null, false); // push ayrı kanalda
        } elseif ($channel === 'push') {
            SendPushJob::dispatch($userId, $title, $body, ['action' => 'league']);
        } else { // email
            $email = User::whereKey($userId)->value('email');
            if ($email) {
                Mail::raw($body, fn ($msg) => $msg->to($email)->subject($title));
            }
        }
    }
}
