<?php

namespace App\Console\Commands;

use App\Jobs\SendVerificationEmailJob;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * Doğrulanmamış üyelere doğrulama maili (kuyruk) gönderir.
 *   php artisan users:send-verification            # TÜM doğrulanmamışlar
 *   php artisan users:send-verification --days=30   # son 30 günde kayıt olanlar
 *   php artisan users:send-verification --limit=100 # en çok 100 (Resend günlük limiti için)
 *   php artisan users:send-verification --force      # onay sorma
 * Her mail ayrı SendVerificationEmailJob -> DB kuyruğu (worker gönderir). Sistem hesapları,
 * e-postası boş olanlar ve zaten doğrulanmışlar atlanır.
 */
class SendVerificationMails extends Command
{
    protected $signature = 'users:send-verification
        {--days= : Yalnız son N günde kayıt olanlar (boş = hepsi)}
        {--limit= : En fazla bu kadar üyeye gönder (en eski kayıttan başlar)}
        {--force : Onay sorma}';

    protected $description = 'Doğrulanmamış üyelere doğrulama maili kuyruğa alır (Resend).';

    public function handle(): int
    {
        $q = User::whereNull('email_verified_at')
            ->whereNotNull('email')
            ->where('email', '!=', '');
        if (Schema::hasColumn('users', 'is_system')) {
            $q->where('is_system', false);
        }
        if ($days = $this->option('days')) {
            $q->where('created_at', '>=', now()->subDays((int) $days));
        }
        $q->orderBy('id'); // deterministik; --limit en eski kayıttan alır
        // NOT: chunkById ile limit() birlikte kullanılmaz -> cap'i chunk içinde manuel uygula.
        $cap = ($limit = $this->option('limit')) ? (int) $limit : PHP_INT_MAX;

        $matched = (clone $q)->count();
        $total = min($matched, $cap);
        if ($total === 0) {
            $this->info('Gönderilecek doğrulanmamış üye yok.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm("{$total} üyeye doğrulama maili kuyruğa alınacak. Devam?")) {
            $this->warn('İptal edildi.');

            return self::SUCCESS;
        }

        $queued = 0;
        $q->select('id')->chunkById(500, function ($users) use (&$queued, $cap) {
            foreach ($users as $u) {
                if ($queued >= $cap) {
                    return false; // cap'e ulaşıldı -> chunk'ı durdur
                }
                SendVerificationEmailJob::dispatch((int) $u->id);
                $queued++;
            }
        });

        $this->info("{$queued} doğrulama maili kuyruğa alındı (worker arka planda gönderir).");

        return self::SUCCESS;
    }
}
