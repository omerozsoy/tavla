<?php

namespace App\Console\Commands;

use App\Support\Shopier;
use Illuminate\Console\Command;

// Shopier webhook'unu bir kez kaydeder ve imza token'ını yazdırır. Çıktıdaki token'ı .env
// SHOPIER_WEBHOOK_TOKEN'a koy (webhook imza doğrulaması bunu kullanır). Prod'da çalıştır:
//   php artisan shopier:setup-webhook
class ShopierSetupWebhook extends Command
{
    protected $signature = 'shopier:setup-webhook';

    protected $description = 'Shopier webhook kaydı oluşturur ve imza token\'ını yazdırır';

    public function handle(): int
    {
        if (! Shopier::enabled()) {
            $this->error('SHOPIER_PAT boş — önce .env\'e PAT ekle (+ config:cache).');

            return self::FAILURE;
        }
        $url = url('/api/pay/shopier/callback');
        $this->info('Webhook kaydediliyor: '.$url);

        $res = Shopier::registerWebhook($url);
        if (! $res || isset($res['error'])) {
            $this->error('Kayıt başarısız: '.($res['error'] ?? 'bilinmeyen hata'));

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Webhook kaydı OK. Dönen yanıt:');
        $this->line(json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        // VERIFY: token alan adı ('token' / 'signatureKey' / 'secret').
        $token = $res['token'] ?? $res['signatureKey'] ?? $res['secret'] ?? null;
        $this->newLine();
        if ($token) {
            $this->warn('.env\'e EKLE:  SHOPIER_WEBHOOK_TOKEN='.$token);
        } else {
            $this->warn('Token alanı otomatik bulunamadı — yukarıdaki yanıttan imza anahtarını bul, SHOPIER_WEBHOOK_TOKEN\'a koy.');
        }

        return self::SUCCESS;
    }
}
