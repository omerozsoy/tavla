<?php

namespace App\Console\Commands;

use App\Models\Tournament;
use App\Models\User;
use App\Services\BotMoveService;
use App\Services\WalletService;
use Illuminate\Console\Command;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * TURNUVA TEST BOTLARI: gercek kullanici hesaplari olan botlar bir turnuvaya katilir ve maclarini
 * "Kahvedeki Dayi" (seviye 12: gnubg 3-ply, deep movefilter) gucunde OYNAR.
 *
 * Oyun, sitenin NORMAL oyuncu API'si uzerinden oynanir (enter/roll/move/cube/report — insan
 * istemcinin yaptiginin aynisi): kurallar, saat, adil zar, sonuc dogrulama hic by-pass edilmez.
 * Yalniz hamle/kup KARARI bu surecte BotMoveService ile verilir.
 *
 *   php artisan tavla:tourney-bots setup                         # 4 bot hesabi (Premium + 10.000 coin)
 *   php artisan tavla:tourney-bots join "Test Turnuvası 2"        # botlar turnuvaya katilir
 *   php artisan tavla:tourney-bots run  "Test Turnuvası 2"        # turnuva bitene kadar maclari oynar
 *   php artisan tavla:tourney-bots status "Test Turnuvası 2"
 *   php artisan tavla:tourney-bots tick                          # ZAMANLAYICI: ~55sn oynat, cik
 *
 * `run` uzun surer (turnuva bitene kadar; SSH + screen gerekir). SSH yoksa `tick` her dakika
 * zamanlayicidan (routes/console.php) calisir: botlarin katildigi acik/suren TUM turnuvalari
 * ~55sn oynatir ve cikar. Mac durumu sunucuda (oda/bracket) tutuldugu icin dakikalar arasi
 * kopukluk sorun degil (match-room/enter idempotent). Bot turnuvasi yoksa aninda cikar.
 */
class TourneyBots extends Command
{
    protected $signature = 'tavla:tourney-bots
        {action : setup | join | run | status | tick}
        {tournament? : Turnuva adi (tam) veya id}
        {--count=4 : Bot sayisi}
        {--level=12 : Bot gucu (12 = Kahvedeki Dayi)}
        {--base-url= : API koku (varsayilan APP_URL)}
        {--seconds=55 : tick: bu kadar saniye oynat}';

    protected $description = 'Turnuva test botlari: hesaplari kur, turnuvaya kat, maclari Dayi (seviye 12) gucunde oyna.';

    /** @var array<int, array{user: User, api: PendingRequest, token: string}> */
    private array $bots = [];

    /** Mac bazli durum: key "tid:matchKey" -> code / reported / noShowAt */
    private array $matches = [];

    /** Ayni el icin kup teklifi bir kez degerlendirilsin: "code:gameNo:turns" */
    private array $cubeChecked = [];

    /** Turnuva basina son yazilan durum (log'u her turda tekrar etmesin) */
    private array $lastStatus = [];

    /**
     * SITE TRAFIGINDEN TETIK (cron/SSH gerekmez): turnuva/oda istekleri bunu cagirir. Botlarin
     * katildigi acik/suren turnuva varsa ve calisan bot sureci yoksa, ARKA PLANDA ayri bir CLI
     * sureci baslatir (`tick --seconds=55`) ve HEMEN doner -> istek beklemez. (Eski afterResponse
     * yolu bu sunucuda yaniti tur bitene kadar bekletiyordu.) Surec bitince zinciri kendisi
     * surdurur (spawnNext). Bot turnuvasi yoksa maliyeti tek onbellek okumasi.
     */
    public static function kick(): void
    {
        try {
            if (! Cache::remember('tourney-bots:active', 20, fn () => self::hasActiveBotTournament())) {
                return;
            }
            self::spawn();
        } catch (\Throwable $e) {
            Log::warning('tourney-bots kick: '.$e->getMessage());
        }
    }

    /** Arka plan tick sureci baslat (ayni anda tek surec: atomik Cache::add bayragi). */
    private static function spawn(): bool
    {
        if (! Cache::add('tourney-bots:spawned', 1, 70)) {
            return false; // zaten calisan/baslatilmis surec var
        }
        if (! function_exists('exec')) {
            Log::warning('tourney-bots: exec() kapali, arka plan sureci baslatilamiyor');

            return false;
        }
        $cmd = sprintf('nohup %s %s tavla:tourney-bots tick --seconds=55 >> %s 2>&1 &',
            escapeshellarg(self::phpCli()), escapeshellarg(base_path('artisan')),
            escapeshellarg(storage_path('logs/tourney-bots.log')));
        @exec($cmd);

        return true;
    }

    /** Tick bitince: bayragi birak, hala aktif bot turnuvasi varsa sonraki sureci baslat. */
    private static function spawnNext(): void
    {
        Cache::forget('tourney-bots:spawned');
        Cache::forget('tourney-bots:active');
        if (self::hasActiveBotTournament()) {
            self::spawn();
        }
    }

    /** CLI php yolu: web SAPI'de PHP_BINARY php-fpm/cgi olabilir -> Plesk CLI yolunu tercih et. */
    private static function phpCli(): string
    {
        $env = (string) env('TOURNEY_BOTS_PHP', '');
        if ($env !== '') {
            return $env;
        }
        $plesk = '/opt/plesk/php/'.PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION.'/bin/php';
        if (is_file($plesk)) {
            return $plesk;
        }
        if (PHP_SAPI === 'cli' && PHP_BINARY !== '') {
            return PHP_BINARY;
        }

        return 'php';
    }

    private static function hasActiveBotTournament(): bool
    {
        $ids = User::where('email', 'like', 'dayibot%@bots.tavlatv.invalid')->pluck('id')->map(fn ($i) => (int) $i)->all();
        if (! $ids) {
            return false;
        }

        return Tournament::whereIn('status', ['open', 'running'])->get(['id', 'players'])
            ->contains(fn ($t) => collect($t->players ?? [])->contains(fn ($p) => in_array((int) ($p['id'] ?? 0), $ids, true)));
    }

    public function handle(BotMoveService $engine, WalletService $wallet): int
    {
        // Uzun-omurlu + veri/hesap agir dongu (level-12 gnubg motoru + 55sn boyunca tekrar tekrar
        // oda/turnuva yukleme). CLI varsayilan 128M bunu KALDIRMIYOR -> tick oyun ortasinda
        // "Allowed memory size exhausted" ile COKUP odayi abandon'a birakiyordu (final 0-0 dongusu).
        // Komuta ozel yukselt (sunucu geneli php.ini'ye dokunma).
        @ini_set('memory_limit', '512M');

        // GNUBG İZOLASYON (canlı bot "takılması" kökü): turnuva botları Seviye 12'de (agir 3-4 ply)
        // her hamlede gnubg ON havuzunu (8092/8093/8096/8097) mesgul ediyor -> AYNI havuzu kullanan
        // canlı insan-vs-AI maclarinin bot hamlesi araya giremeyip timeout'a dusuyor (unavailable).
        // TOURNEY_BOTS_GNUBG_URLS verilirse (or. heavy havuz 8098..8101) turnuva botlari o havuzu
        // kullansin -> canlı ON havuz turnuvaya BLOKE OLMAZ. Bu CLI surecine ozel runtime override;
        // FPM (canlı mac) etkilenmez. Bossa eski davranis (ON havuz paylasilir).
        $isoUrls = array_values(array_filter(array_map('trim', explode(',', (string) env('TOURNEY_BOTS_GNUBG_URLS', '')))));
        if ($isoUrls) {
            config([
                'gnubg.url' => $isoUrls[0],
                'gnubg.url_backup' => implode(',', array_slice($isoUrls, 1)),
            ]);
        }

        $action = (string) $this->argument('action');
        if ($action === 'setup') {
            return $this->setup($wallet);
        }
        if ($action === 'tick') {
            return $this->tick($engine);
        }

        $t = $this->findTournament();
        if (! $t) {
            return self::FAILURE;
        }
        $this->loadBots();
        if (! $this->bots) {
            $this->error('Bot hesabi yok. Once: php artisan tavla:tourney-bots setup');

            return self::FAILURE;
        }

        return match ($action) {
            'join' => $this->join($t),
            'run' => $this->runBots($t, $engine),
            'status' => $this->status($t),
            default => $this->bail("Bilinmeyen islem: {$action}"),
        };
    }

    private function bail(string $msg): int
    {
        $this->error($msg);

        return self::FAILURE;
    }

    // ---------------------------------------------------------------- hesaplar

    private function botEmail(int $n): string
    {
        return "dayibot{$n}@bots.tavlatv.invalid";
    }

    private function setup(WalletService $wallet): int
    {
        $count = max(1, (int) $this->option('count'));
        for ($n = 1; $n <= $count; $n++) {
            $u = User::where('email', $this->botEmail($n))->first();
            if (! $u) {
                $u = User::create([
                    'first_name' => 'Dayı',
                    'last_name' => "Bot {$n}",
                    'country' => 'TR',
                    'nickname' => "DayiBot{$n}",
                    'email' => $this->botEmail($n),
                    'password' => bcrypt(Str::random(40)), // girisi yok; API token ile oynar
                ]);
            }
            if (! $u->hasVerifiedEmail()) {
                $u->markEmailAsVerified();
            }
            // Premium (Premium'a ozel turnuvalara da katilabilsin)
            $u->forceFill(['plan' => 'star', 'plan_until' => now()->addYear()])->save();
            if ((int) $u->coins < 10000) {
                $wallet->setBalance($u->fresh(), 10000, 'admin_adjustment');
            }
            $u->refresh();
            $this->info(sprintf('  %-10s id=%d coin=%d plan=%s', $u->nickname, $u->id, $u->coins, $u->plan_active));
        }
        $this->info("{$count} bot hazir.");

        return self::SUCCESS;
    }

    private function loadBots(): void
    {
        $count = max(1, (int) $this->option('count'));
        $base = rtrim((string) ($this->option('base-url') ?: config('app.url')), '/').'/api';
        $gate = (string) config('app.site_password', '');
        for ($n = 1; $n <= $count; $n++) {
            $u = User::where('email', $this->botEmail($n))->first();
            if (! $u) {
                continue;
            }
            // Token onbellekte (tick her dakika calisir -> her seferinde yeni token uretilmesin).
            // Eski tokenlar (onbellek suresinden uzun) temizlenir.
            $plain = Cache::get('tourney-bot-token:'.$u->id);
            if (! $plain || ! $u->tokens()->where('name', 'tourney-bot')->exists()) {
                $u->tokens()->where('name', 'tourney-bot')->where('created_at', '<', now()->subDays(8))->delete();
                $plain = $u->createToken('tourney-bot')->plainTextToken;
                Cache::put('tourney-bot-token:'.$u->id, $plain, now()->addDays(7));
            }
            $api = Http::baseUrl($base)->withToken($plain)->acceptJson()->timeout(40);
            if ($gate !== '') {
                $api = $api->withHeaders(['X-Site-Gate' => $gate]);
            }
            $this->bots[$u->id] = [
                'user' => $u,
                'api' => $api,
                // Oda koltuk tokeni (enter/roll/move 'token' alani): bot basina sabit.
                'token' => 'tbot-'.$u->id.'-'.substr(hash('sha256', config('app.key').'|'.$u->id), 0, 24),
            ];
        }
    }

    private function findTournament(): ?Tournament
    {
        $arg = (string) $this->argument('tournament');
        if ($arg === '') {
            $this->error('Turnuva adi veya id verin.');

            return null;
        }
        $t = ctype_digit($arg) ? Tournament::find((int) $arg) : Tournament::where('name', $arg)->orderByDesc('id')->first();
        if (! $t) {
            $this->error("Turnuva bulunamadi: {$arg}");
        }

        return $t;
    }

    // ---------------------------------------------------------------- join / status

    private function join(Tournament $t): int
    {
        foreach ($this->bots as $b) {
            $r = $b['api']->post("/tournaments/{$t->id}/join");
            $this->line(sprintf('  %-10s join -> %d %s', $b['user']->nickname, $r->status(), $r->successful() ? 'OK' : ($r->json('message') ?? '')));
        }

        return $this->status($t->fresh());
    }

    private function status(Tournament $t): int
    {
        $t = $t->fresh();
        $this->info("#{$t->id} {$t->name} · {$t->status} · oyuncu ".count(array_filter($t->players ?? [])).'/'.$t->size
            .' · son katilim '.($t->register_until?->copy()->tz('Europe/Istanbul')->format('d.m.Y H:i') ?? '—').' (TSI)');
        foreach (is_array($t->bracket) ? $t->bracket : [] as $ri => $round) {
            foreach ($round as $m) {
                $this->line(sprintf('  %-6s %s vs %s%s', $m['key'], $m['p1']['name'] ?? '—', $m['p2']['name'] ?? '—',
                    ! empty($m['winner']) ? '  -> kazanan '.$m['winner'] : ''));
            }
        }

        return self::SUCCESS;
    }

    // ---------------------------------------------------------------- oyun dongusu

    /** Zamanlayici: botlarin katildigi acik/suren turnuvalari --seconds boyunca oynat, cik. */
    private function tick(BotMoveService $engine): int
    {
        $botIds = User::where('email', 'like', 'dayibot%@bots.tavlatv.invalid')->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (! $botIds) {
            return self::SUCCESS;
        }
        $has = fn (Tournament $t) => collect($t->players ?? [])->contains(fn ($p) => in_array((int) ($p['id'] ?? 0), $botIds, true));
        $tours = Tournament::whereIn('status', ['open', 'running'])->get()->filter($has)->values();
        if ($tours->isEmpty()) {
            return self::SUCCESS; // bot turnuvasi yok -> maliyetsiz cikis
        }
        $this->loadBots();
        $deadline = time() + max(5, (int) $this->option('seconds'));
        $this->line('['.now('Europe/Istanbul')->format('H:i:s').'] tick: '.$tours->pluck('id')->implode(','));
        try {
            while (time() < $deadline) {
                foreach ($tours as $t) {
                    $this->runBots($t, $engine, $deadline, true);
                }
                gc_collect_cycles(); // 55sn dongude biriken dongusel referanslari birak (OOM'a karsi)
                usleep(1_200_000);
            }
        } finally {
            self::spawnNext(); // zincir: sonraki 55sn'lik sureci baslat (turnuva bittiyse durur)
        }

        return self::SUCCESS;
    }

    private function runBots(Tournament $t, BotMoveService $engine, ?int $deadline = null, bool $once = false): int
    {
        $level = max(1, min(12, (int) $this->option('level')));
        if (! $once) {
            $this->info("Botlar calisiyor (seviye {$level}). Durdurmak icin Ctrl+C.");
        }
        $first = reset($this->bots);
        while ($deadline === null || time() < $deadline) {
            // Turnuva detayini cek (autoStartDue tetiklenir: son katilim gecince baslar)
            $r = $first['api']->get("/tournaments/{$t->id}");
            $tour = $r->json('tournament');
            if (! is_array($tour)) {
                $this->warn('Turnuva okunamadi: '.$r->status());
                sleep(3);

                continue;
            }
            if ($tour['status'] !== ($this->lastStatus[$t->id] ?? null)) {
                $this->info("#{$t->id} turnuva durumu: ".$tour['status']);
                $this->lastStatus[$t->id] = $tour['status'];
            }
            if ($tour['status'] === 'finished') {
                $this->info("#{$t->id} turnuva bitti. Sampiyon id: ".($tour['champion_id'] ?? '—'));

                return self::SUCCESS;
            }
            if ($tour['status'] === 'running') {
                foreach ($tour['bracket'] ?? [] as $round) {
                    foreach ($round as $m) {
                        if (! empty($m['winner']) || empty($m['p1']['id']) || empty($m['p2']['id'])) {
                            continue;
                        }
                        foreach ([(int) $m['p1']['id'], (int) $m['p2']['id']] as $uid) {
                            if (isset($this->bots[$uid])) {
                                try {
                                    $this->playMatch($t->id, $m, $this->bots[$uid], $engine, $level);
                                } catch (\Throwable $e) {
                                    $this->warn("  [{$m['key']}] {$this->bots[$uid]['user']->nickname}: ".$e->getMessage());
                                }
                            }
                        }
                    }
                }
            }
            if ($once) {
                return self::SUCCESS; // tick: tek tur; dongu tick() icinde
            }
            usleep(1_200_000);
        }

        return self::SUCCESS;
    }

    private function playMatch(int $tid, array $m, array $bot, BotMoveService $engine, int $level): void
    {
        $key = "{$tid}:{$m['key']}";
        $me = $bot['user'];
        $st = &$this->matches[$key.':'.$me->id];
        $st ??= ['code' => null, 'entered' => false, 'reported' => false, 'noShowAt' => 0];
        if ($st['reported']) {
            return;
        }
        $api = $bot['api'];

        if (! $st['code']) {
            $r = $api->post("/tournaments/{$tid}/match-room", ['match' => $m['key']]);
            if (! $r->successful()) {
                $this->warn("  [{$m['key']}] {$me->nickname} match-room: ".$r->status().' '.($r->json('message') ?? ''));

                return;
            }
            $st['code'] = $r->json('code');
        }
        $code = $st['code'];

        if (! $st['entered']) {
            // Saat: en genis (casual) — 3-ply dusunme + tek surecte ardisik botlar bankayi yormasin.
            $r = $api->post("/rooms/{$code}/enter", ['token' => $bot['token'], 'name' => $me->nickname, 'time_control' => 'casual']);
            if (! $r->successful()) {
                $this->warn("  [{$m['key']}] {$me->nickname} enter: ".$r->status().' '.($r->json('message') ?? ''));

                return;
            }
            $st['entered'] = true;
            $this->line("  [{$m['key']}] {$me->nickname} odaya girdi ({$code}, {$r->json('room.target')} puan)");
        }

        // Poll: durum + varlik (presence) damgasi
        $r = $api->withHeaders(['X-Room-Token' => $bot['token']])->get("/rooms/{$code}", ['token' => $bot['token']]);
        $room = $r->json('room');
        if (! is_array($room)) {
            return;
        }

        if ($room['status'] === 'finished') {
            if (! in_array($room['server_match']['winner'] ?? null, ['white', 'black'], true)) {
                // Sonucsuz kapandi: sunucu match-room'da yeni oda verir -> yeniden gir.
                $st['code'] = null;
                $st['entered'] = false;
                $this->line("  [{$m['key']}] {$me->nickname} oda sonucsuz kapandi, yeni oda istenecek");

                return;
            }
            $this->report($tid, $m, $bot, $room, $st);

            return;
        }
        if ($room['status'] === 'waiting') {
            // Rakip gelmedi: sunucu 60sn'yi dogrular; 10sn'de bir dene.
            if (time() - $st['noShowAt'] >= 10) {
                $st['noShowAt'] = time();
                $ns = $api->post("/tournaments/{$tid}/no-show", ['match' => $m['key'], 'token' => $bot['token']]);
                if ($ns->successful()) {
                    $this->info("  [{$m['key']}] {$me->nickname} hukmen kazandi (rakip gelmedi)");
                    $st['reported'] = true;
                }
            }

            return;
        }
        if ($room['status'] !== 'playing') {
            return;
        }

        $this->act($code, $m['key'], $bot, $room, $engine, $level);
    }

    private function report(int $tid, array $m, array $bot, array $room, array &$st): void
    {
        $winColor = $room['server_match']['winner'] ?? null;
        if (! in_array($winColor, ['white', 'black'], true)) {
            return;
        }
        $winnerId = (int) ($winColor === 'white' ? $room['p1_user_id'] : $room['p2_user_id']);
        $r = $bot['api']->post("/tournaments/{$tid}/report", ['match' => $m['key'], 'winner_id' => $winnerId]);
        if ($r->successful() || $r->status() === 422) { // 422 = sonuc zaten girildi (rakip bildirdi)
            $st['reported'] = true;
            $score = $room['server_match']['score'] ?? [];
            $this->info(sprintf('  [%s] bitti %d-%d, kazanan id=%d', $m['key'], $score['white'] ?? 0, $score['black'] ?? 0, $winnerId));
        }
    }

    private function act(string $code, string $mkey, array $bot, array $room, BotMoveService $engine, int $level): void
    {
        $me = $bot['user'];
        $mine = (int) $room['p1_user_id'] === $me->id ? 'white' : 'black';
        $state = $room['server_state'] ?? null;
        $sm = $room['server_match'] ?? null;
        $ver = (int) ($room['server_version'] ?? 0);
        $api = $bot['api'];
        $cmd = fn (array $extra) => array_merge([
            'token' => $bot['token'],
            'command_id' => (string) Str::uuid(),
            'expected_version' => $ver,
        ], $extra);
        $tag = "  [{$mkey}] {$me->nickname}";

        if (is_array($sm) && ! empty($sm['done'])) {
            return;
        }

        // Kup teklifi bekliyor
        $pending = $sm['cube']['pending'] ?? null;
        if ($pending !== null) {
            if ($pending === $mine) {
                return; // rakibin cevabini bekle
            }
            $decision = $engine->chooseCube($state, $sm, 'respond', $level);
            $r = $api->post("/rooms/{$code}/cube/respond", $cmd(['action' => $decision]));
            $this->line("{$tag} kup: {$decision} ({$r->status()})");

            return;
        }

        // Acilis eli (yeni oyun): sira kontrolu yok; ilk cagiran acar.
        if (! is_array($state) || ! is_array($sm) || empty($sm['opened'])) {
            $r = $api->post("/rooms/{$code}/roll", $cmd([]));
            if ($r->successful() && $r->json('opening') && ! $r->json('reused')) {
                $this->line("{$tag} acilis: ".implode('-', (array) $r->json('dice')).' baslayan '.$r->json('starter'));
            }

            return;
        }

        if (($state['turn'] ?? null) !== $mine) {
            return;
        }

        if (empty($state['dice'])) {
            // Zar atmadan once: kup teklifi (el basina bir kez degerlendir)
            $ck = $code.':'.($sm['gameNo'] ?? 1).':'.($sm['turns'] ?? 0);
            if ((int) ($sm['target'] ?? 1) > 1 && ! isset($this->cubeChecked[$ck])) {
                $this->cubeChecked[$ck] = true;
                $owner = $sm['cube']['owner'] ?? null;
                if (empty($sm['crawford']) && ($owner === null || $owner === $mine) && (int) ($sm['turns'] ?? 0) >= 1
                    && $engine->chooseCube($state, $sm, 'offer', $level) === 'double') {
                    $r = $api->post("/rooms/{$code}/cube/offer", $cmd([]));
                    if ($r->successful()) {
                        $this->line("{$tag} kup teklif etti");

                        return;
                    }
                }
            }
            $api->post("/rooms/{$code}/roll", $cmd([]));

            return;
        }

        // Zar atildi: tam turu sec ve oyna (bos = oynanacak hamle yok, pas)
        $steps = $engine->chooseSteps($state, $sm, $level);
        // IZLENEBILIRLIK: hamleyi ONCE 'live' onizleme olarak POST et + kisa reveal, SONRA commit.
        // Boylece izleyiciler (spectate) adimlari INSAN oynuyormus gibi tek tek animasyonla gorur
        // (Spectate rv.live'i turn == board.turn iken oynatir; bot kendi turunda POST ettigi icin
        // eslesir). Bot aninda commit ederse live bos kalir -> izleyici "kut" gorurdu. Reveal
        // suresi adim sayisina gore (~550ms/adim, 0.6-2.2sn) -> istemcinin 500ms/adim animasyonuna denk.
        if (! empty($steps)) {
            $api->post("/rooms/{$code}/live", [
                'token' => $bot['token'],
                'steps' => array_values($steps),
                'turn' => $mine,
                'seq' => (int) ($sm['turns'] ?? 0),
            ]);
            usleep(min(2200, max(600, count($steps) * 550)) * 1000);
        }
        $r = $api->post("/rooms/{$code}/move", $cmd(['steps' => $steps]));
        if (! $r->successful()) {
            $this->warn("{$tag} hamle reddedildi: ".$r->status().' '.($r->json('message') ?? ''));
        }
    }
}
