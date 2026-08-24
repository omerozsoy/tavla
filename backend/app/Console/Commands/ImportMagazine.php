<?php

namespace App\Console\Commands;

use App\Models\Content;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Tavla Magazin: @TavlaTV YouTube kanalinin videolarini kanal RSS feed'inden cekip
 * 'magazine' icerigi olarak iceri aktarir. Video kimligi (video_id) embed icin saklanir;
 * kapak olarak YouTube kucuk resmi (ytimg CDN) kullanilir. Baslik+video_id ile idempotent.
 *
 * Kullanim:  php artisan magazine:import
 *            php artisan magazine:import --file=database/data/magazine.json  (offline; deploy)
 */
class ImportMagazine extends Command
{
    protected $signature = 'magazine:import
        {--channel=UCaV5mugEVc1U18ESfNUXyZg : YouTube kanal ID (TavlaTV)}
        {--file= : RSS yerine yerel JSON dosyasindan yukle (offline; deploy icin)}
        {--dry : Veritabanina yazmadan sadece listele}';

    protected $description = 'TavlaTV YouTube kanal videolarini Tavla Magazin (magazine) icerigine aktarir';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $file = (string) $this->option('file');

        if ($file !== '') {
            $path = $this->resolveFile($file);
            if ($path === null) {
                $this->error("JSON dosyasi bulunamadi: {$file}");
                return self::FAILURE;
            }
            $this->info("Yerel dosyadan yukleniyor: {$path}");
            $items = $this->parseJson((string) file_get_contents($path));
        } else {
            $channel = (string) $this->option('channel');
            $url = 'https://www.youtube.com/feeds/videos.xml?channel_id='.$channel;
            $this->info("Kanal feed'i cekiliyor: {$url}");
            try {
                $res = Http::timeout(20)
                    ->withHeaders(['User-Agent' => 'TavlaTvBot/1.0 (+https://www.tavlai.com)'])
                    ->get($url);
            } catch (\Throwable $e) {
                $this->error('Feed cekilemedi: '.$e->getMessage());
                return self::FAILURE;
            }
            if (! $res->ok()) {
                $this->error('Feed HTTP hatasi: '.$res->status());
                return self::FAILURE;
            }
            $items = $this->parseFeed($res->body());
        }

        if (empty($items)) {
            $this->warn('Video bulunamadi (bos veya bicim taninmadi).');
            return self::FAILURE;
        }

        $this->info(count($items).' video bulundu.');
        $created = 0;
        $updated = 0;
        $n = count($items);
        foreach ($items as $i => $it) {
            $sort = $n - $i; // en yeni en ustte
            $this->line(sprintf(' • [%s] %s  (%s)', $it['event_at'] ?? '—', $it['title'], $it['video_id']));
            if ($dry) {
                continue;
            }
            $existing = Content::where('type', 'magazine')->where('video_id', $it['video_id'])->first();
            Content::updateOrCreate(
                ['type' => 'magazine', 'video_id' => $it['video_id']],
                [
                    'title' => $it['title'],
                    'body' => $it['body'],
                    'image' => $it['image'],
                    'event_at' => $it['event_at'],
                    'sort' => $sort,
                    'published' => true,
                ],
            );
            $existing ? $updated++ : $created++;
        }

        if ($dry) {
            $this->comment('Kuru calisma (--dry): hicbir sey yazilmadi.');
        } else {
            $this->info("Tamam: {$created} yeni, {$updated} guncellendi.");
        }
        return self::SUCCESS;
    }

    /**
     * YouTube kanal Atom feed'ini ayristirir.
     * @return array<int, array{title:string, video_id:string, image:?string, body:?string, event_at:?string}>
     */
    private function parseFeed(string $xml): array
    {
        $prev = libxml_use_internal_errors(true);
        $doc = simplexml_load_string($xml);
        libxml_use_internal_errors($prev);
        if ($doc === false) {
            return [];
        }
        $out = [];
        foreach ($doc->entry ?? [] as $entry) {
            $yt = $entry->children('http://www.youtube.com/xml/schemas/2015');
            $media = $entry->children('http://search.yahoo.com/mrss/');
            $vid = trim((string) ($yt->videoId ?? ''));
            $title = trim((string) ($entry->title ?? ''));
            if ($vid === '' || $title === '') {
                continue;
            }
            $desc = '';
            if (isset($media->group->description)) {
                $desc = trim((string) $media->group->description);
            }
            $pub = (string) ($entry->published ?? '');
            $eventAt = null;
            if ($pub !== '' && ($ts = strtotime($pub)) !== false) {
                $eventAt = date('Y-m-d H:i:s', $ts);
            }
            $out[] = [
                'title' => mb_substr($title, 0, 200),
                'video_id' => $vid,
                // maxres bazen yok; hqdefault her videoda vardir
                'image' => "https://i.ytimg.com/vi/{$vid}/hqdefault.jpg",
                'body' => $desc !== '' ? mb_substr($desc, 0, 5000) : null,
                'event_at' => $eventAt,
            ];
        }
        return $out;
    }

    /** Yerel JSON: [{title, video_id, image, body, event_at}, ...] */
    private function parseJson(string $json): array
    {
        $data = json_decode($json, true);
        if (! is_array($data)) {
            return [];
        }
        $out = [];
        foreach ($data as $row) {
            $vid = trim((string) ($row['video_id'] ?? ''));
            $title = trim((string) ($row['title'] ?? ''));
            if ($vid === '' || $title === '') {
                continue;
            }
            $out[] = [
                'title' => mb_substr($title, 0, 200),
                'video_id' => $vid,
                'image' => isset($row['image']) && $row['image'] !== '' ? (string) $row['image'] : "https://i.ytimg.com/vi/{$vid}/hqdefault.jpg",
                'body' => isset($row['body']) && $row['body'] !== '' ? mb_substr((string) $row['body'], 0, 5000) : null,
                'event_at' => isset($row['event_at']) && $row['event_at'] !== '' ? (string) $row['event_at'] : null,
            ];
        }
        return $out;
    }

    /** --file yolunu coz: mutlak/base_path/'backend/' oneki/dosya adi. */
    private function resolveFile(string $file): ?string
    {
        $noBackend = preg_replace('#^/?backend/#', '', $file);
        foreach ([$file, base_path($file), base_path($noBackend), database_path('data/'.basename($file))] as $c) {
            if (is_file($c)) {
                return $c;
            }
        }
        return null;
    }
}
