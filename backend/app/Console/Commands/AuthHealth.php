<?php

namespace App\Console\Commands;

use App\Services\MoveValidatorService;
use App\Support\Backgammon;
use Illuminate\Console\Command;

/**
 * Sunucu-otoriter modun (SERVER_AUTHORITATIVE) canlı SAĞLIK kontrolü — tek komut.
 *
 * SERVER_AUTHORITATIVE=true iken validator FAIL-CLOSED linchpin'dir: erişilemezse TÜM
 * maçlarda hamleler 503 alır. Bu komut deploy sonrası / şüphe anında hızlı GO/NO-GO verir:
 *   1) config durumu (server_authoritative, validator url/required/pr_mode)
 *   2) validator erişilebilir mi VE gerçekten doğruluyor mu (yasal hamleyi KABUL, yasadışıyı RED)
 *   3) son log penceresinde red oranı (authoritative.move-rejected) + dice.shadow-mismatch sayısı
 *
 * validator:watch (dakikalık cron) UP/DOWN + auto-restart'ı zaten yapar; bu komut onu TEKRARLAMAZ,
 * ek olarak "ayakta ama yanlış cevaplıyor mu" + gerçek oyuncu-red oranını raporlar. Salt-okunur.
 */
class AuthHealth extends Command
{
    protected $signature = 'tavla:auth-health {--lines=20000 : Taranacak son log satiri sayisi}';

    protected $description = 'Sunucu-otoriter mod + validator canli saglik kontrolu (GO/NO-GO)';

    public function handle(MoveValidatorService $validator): int
    {
        $ok = true;

        // 1) KONFİG DURUMU ---------------------------------------------------
        $srvAuth = (bool) config('game.server_authoritative');
        $allowList = (array) config('game.authoritative_users');
        $vUrl = (string) config('validator.url');
        $vRequired = (bool) config('validator.required', true);
        $prMode = (string) config('validator.pr_mode', 'off');

        $this->line('── KONFİG ──');
        $this->line('  SERVER_AUTHORITATIVE : '.($srvAuth ? 'AÇIK (tüm maçlar otoriter)' : 'kapalı (yalnız bahisli maçlar otoriter)'));
        if (! $srvAuth && $allowList) {
            $this->line('  allow-list           : '.implode(',', $allowList).' (yalnız bu ikili otoriter)');
        }
        $this->line('  VALIDATOR_URL        : '.($vUrl !== '' ? $vUrl : '(BOŞ)'));
        $this->line('  VALIDATOR_REQUIRED   : '.($vRequired ? 'true (fail-closed)' : 'false (GÜVENSİZ: doğrulama atlanır)'));
        $this->line('  VALIDATOR_PR_MODE    : '.$prMode);

        // KRİTİK ÇELİŞKİ: otoriter AÇIK ama validator yapılandırılmamış -> her hamle reddedilir.
        if (($srvAuth || $allowList) && $vUrl === '') {
            $this->error('  ✗ Otoriter mod açık ama VALIDATOR_URL boş -> otoriter maçlarda TÜM hamleler reddedilir!');
            $ok = false;
        }

        // 2) VALIDATOR CANLI PROBE ------------------------------------------
        $this->line('── VALIDATOR PROBE ──');
        if (! $validator->isConfigured()) {
            $this->warn('  VALIDATOR_URL boş -> probe atlandı.');
        } else {
            $legal = $this->probeLegal($validator);
            $illegal = $this->probeIllegalRejected($validator);
            $this->line('  yasal hamle KABUL     : '.($legal ? '✓ evet' : '✗ HAYIR'));
            $this->line('  yasadışı hamle RED    : '.($illegal ? '✓ evet' : '✗ HAYIR'));
            if (! $legal || ! $illegal) {
                $this->error('  ✗ Validator beklenen gibi doğrulamıyor (erişilemez VEYA motor↔validator uyumsuz).');
                $ok = false;
            } else {
                $this->info('  ✓ Validator ayakta ve doğru doğruluyor.');
            }
        }

        // 3) SON LOG PENCERESİ: RED ORANI -----------------------------------
        $this->line('── SON LOG (red sinyalleri) ──');
        $path = storage_path('logs/laravel.log');
        if (! is_file($path)) {
            $this->warn('  laravel.log bulunamadı ('.$path.') — log tabanlı kanaldaysanız tekil dosya olmayabilir.');
        } else {
            $lines = $this->tail($path, (int) $this->option('lines'));
            $rejected = 0;
            $shadow = 0;
            $reasons = [];
            foreach ($lines as $ln) {
                if (str_contains($ln, 'authoritative.move-rejected')) {
                    $rejected++;
                    if (preg_match('/"reason":"([^"]+)"/', $ln, $m)) {
                        $reasons[$m[1]] = ($reasons[$m[1]] ?? 0) + 1;
                    }
                }
                if (str_contains($ln, 'dice.shadow-mismatch')) {
                    $shadow++;
                }
            }
            $this->line('  taranan satır          : '.count($lines));
            $this->line('  authoritative.move-rejected: '.$rejected.($reasons ? ' ('.$this->fmtReasons($reasons).')' : ''));
            $this->line('  dice.shadow-mismatch   : '.$shadow);
            if ($rejected > 0) {
                $this->warn('  ⚠ Gerçek oyuncu hamleleri reddediliyor — validator down veya desync/uyumsuzluk olabilir. İncele.');
            }
        }

        $this->newLine();
        if ($ok) {
            $this->info('SONUÇ: GO — otoriter mod + validator sağlıklı görünüyor.');

            return self::SUCCESS;
        }
        $this->error('SONUÇ: NO-GO — yukarıdaki ✗ maddelerini gider.');

        return self::FAILURE;
    }

    /** Bilinen YASAL bir açılış hamlesini validator kabul ediyor mu? */
    private function probeLegal(MoveValidatorService $validator): bool
    {
        $s = Backgammon::initialState();
        $s['dice'] = [3, 1];
        $s['diceUsed'] = [false, false];
        $r = $validator->validate($s, [
            ['from' => 5, 'to' => 2, 'die' => 3],
            ['from' => 2, 'to' => 1, 'die' => 1],
        ]);

        return (bool) ($r['valid'] ?? false) && empty($r['unreachable']);
    }

    /** Açıkça YASADIŞI bir hamleyi (atılmayan zar) validator REDDEDİYOR mu? */
    private function probeIllegalRejected(MoveValidatorService $validator): bool
    {
        $s = Backgammon::initialState();
        $s['dice'] = [3, 1];
        $s['diceUsed'] = [false, false];
        // 23->17 = 6 pip ama zar [3,1]; 6 atılmadı -> yasadışı olmalı.
        $r = $validator->validate($s, [
            ['from' => 23, 'to' => 17, 'die' => 6],
        ]);
        // Erişilemezse RED sayma (bu ayrı bir hata; legal probe onu yakalar).
        if (! empty($r['unreachable'])) {
            return false;
        }

        return empty($r['valid']);
    }

    /** Dosyanın son $n satırını bellek-dostu (sondan) oku. */
    private function tail(string $path, int $n): array
    {
        $n = max(100, $n);
        $f = new \SplFileObject($path, 'r');
        $f->seek(PHP_INT_MAX);
        $last = $f->key();
        $start = max(0, $last - $n);
        $out = [];
        $f->seek($start);
        while (! $f->eof()) {
            $out[] = $f->fgets();
        }

        return $out;
    }

    private function fmtReasons(array $reasons): string
    {
        arsort($reasons);
        $parts = [];
        foreach ($reasons as $k => $v) {
            $parts[] = "$k:$v";
        }

        return implode(', ', $parts);
    }
}
