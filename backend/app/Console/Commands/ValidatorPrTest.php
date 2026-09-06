<?php

namespace App\Console\Commands;

use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Illuminate\Console\Command;

/**
 * TEŞHİS: validator SUNUCU-OTORİTER PR (/analyze-pr) gerçekten çalışıyor mu? VALIDATOR_PR_MODE=
 * authoritative bunu kullanır; validator'da onnxruntime-node + model yoksa null döner (PR sessizce
 * client'a düşer). Bilinen ZAYIF açılış (24/20, 3-1) gönderir -> gerçek PR (0'dan büyük) beklenir.
 */
class ValidatorPrTest extends Command
{
    protected $signature = 'tavla:validator-pr-test';

    protected $description = 'Validator authoritative PR (/analyze-pr) sinir ağıyla çalışıyor mu test eder.';

    public function handle(MoveValidatorService $validator): int
    {
        $this->line('validator.pr_mode = '.config('validator.pr_mode', 'off'));
        if (! $validator->isConfigured()) {
            $this->error('Validator yapılandırılmamış (VALIDATOR_URL yok).');

            return self::FAILURE;
        }

        // Açılış 3-1, beyaz ZAYIF oynar: 24/20 (en iyi 8/5 6/5). Gerçek analizör kayıp ~0.2 PR verir.
        $pos = Backgammon::initialState();
        $log = [[
            'player' => 'white',
            'pos' => $pos,
            'dice' => [3, 1],
            'playedSteps' => [
                ['from' => 23, 'to' => 22, 'die' => 1],
                ['from' => 22, 'to' => 19, 'die' => 3],
            ],
            'steps' => [
                ['from' => 23, 'to' => 22, 'die' => 1],
                ['from' => 22, 'to' => 19, 'die' => 3],
            ],
            'notation' => '24/20',
            'seq' => 0,
        ]];

        $this->info('Validator /analyze-pr çağrılıyor (zayıf 24/20 açılışı)...');
        $r = $validator->analyzePr('white', $log, 1, false);

        if ($r === null) {
            $this->error('❌ SONUÇ: null — validator /analyze-pr ÇALIŞMIYOR.');
            $this->line('Muhtemel neden: validator\'da onnxruntime-node/model kurulu değil, ya da /analyze-pr yok.');
            $this->line('Çözüm: validator sunucusunda `cd validator && npm i` + servis restart. Log: storage/logs/laravel.log (validator.analyzePr).');

            return self::FAILURE;
        }

        $this->line('');
        $this->info('✅ SONUÇ: validator PR döndü — authoritative PR ÇALIŞIYOR.');
        $this->line(sprintf('  pr=%s  decisions=%s  equity_lost=%s',
            var_export($r['pr'] ?? null, true), $r['decisions'] ?? 0, $r['equity_lost'] ?? 0));
        if (($r['pr'] ?? 0) <= 0.001 && ($r['decisions'] ?? 0) > 0) {
            $this->warn('  NOT: PR ~0 çıktı — zayıf hamle için beklenmez. Encoding/analizör kontrol et (yine de servis AYAKTA).');
        }

        return self::SUCCESS;
    }
}
