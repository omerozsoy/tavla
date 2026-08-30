<?php

namespace App\Console\Commands;

use App\Models\Content;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Tavla Magazin: @TavlaTV YouTube kanalindaki 3 seriyi (playlist) iceri aktarir.
 * Her playlist sayfasindan videolarin ID'leri (sirali) cikarilir, basliklar YouTube
 * oEmbed'den alinir. organizer = seri adi (bolum). type='magazine', video_id ile idempotent.
 *
 * Not: Sunucudan YouTube'a cikis engelli olabilir -> canli cekim YERELDE yapilir ve
 * database/data/magazine.json'a yazilir; deploy her zaman --file (offline) ile calisir.
 *
 * Kullanim:  php artisan magazine:import                 (playlist'lerden canli cek)
 *            php artisan magazine:import --file=database/data/magazine.json  (offline)
 */
class ImportMagazine extends Command
{
    protected $signature = 'magazine:import
        {--file= : RSS/playlist yerine yerel JSON dosyasindan yukle (offline; deploy icin)}
        {--dry : Veritabanina yazmadan sadece listele}';

    protected $description = 'TavlaTV YouTube serilerini (playlist) Tavla Magazin icerigine aktarir';

    /** TavlaTV kanalindaki tum seriler (seri adi => YouTube playlist ID). */
    private const PLAYLISTS = [
        'Tavla Sohbetleri' => 'PLlK6ulCZ0xO4ZMcbgct_C3A_JuEjBqh35',
        'Kısa Kısa Tavla' => 'PLlK6ulCZ0xO52s5sxPdJb1HBza9PdU0XR',
        'Tavla Magazin' => 'PLlK6ulCZ0xO7oXN5ugNhBc9iH2ZWA5Uhm',
        'Turnuva Karşılaşmaları' => 'PLlK6ulCZ0xO5KettpFroIR36T5Zju6B_U',
        'Tavla Haberleri' => 'PLlK6ulCZ0xO5avVRzUsFgy-N8xifhxzFe',
        'Şampiyonluk Anları' => 'PLlK6ulCZ0xO42cVaGhuoj9SRx8WPwmaEx',
    ];

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
            $items = $this->fetchPlaylists();
        }

        if (empty($items)) {
            $this->warn('Video bulunamadi.');
            return self::FAILURE;
        }

        $this->info(count($items).' video bulundu.');
        $created = 0;
        $updated = 0;
        foreach ($items as $it) {
            $this->line(sprintf(' • [%s] %s  (%s)', $it['organizer'], $it['title'], $it['video_id']));
            if ($dry) {
                continue;
            }
            $existing = Content::where('type', 'magazine')->where('video_id', $it['video_id'])->first();
            Content::updateOrCreate(
                ['type' => 'magazine', 'video_id' => $it['video_id']],
                [
                    'title' => $it['title'],
                    'organizer' => $it['organizer'], // seri adi (bolum)
                    'image' => $it['image'],
                    'event_at' => $it['event_at'],
                    'sort' => $it['sort'],
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
     * 3 playlist'i sirayla cek; her videonun ID+baslik+kapak+seri bilgisini dondur.
     * @return array<int, array{title:string, video_id:string, organizer:string, image:string, event_at:null, sort:int}>
     */
    private function fetchPlaylists(): array
    {
        $out = [];
        $sort = 0;
        foreach (self::PLAYLISTS as $section => $plid) {
            $this->info("Seri cekiliyor: {$section} ({$plid})");
            $vids = $this->playlistVideoIds($plid);
            if (empty($vids)) {
                $this->warn("   ! bu seride video bulunamadi");
                continue;
            }
            foreach ($vids as $vid) {
                $meta = $this->oembed($vid);
                $title = $meta['title'] ?? $vid;
                $out[] = [
                    'title' => mb_substr($title, 0, 200),
                    'video_id' => $vid,
                    'organizer' => $section,
                    'image' => "https://i.ytimg.com/vi/{$vid}/hqdefault.jpg",
                    'event_at' => null,
                    'sort' => $sort++, // seri + playlist sirasi korunur (kucuk = once)
                ];
            }
        }
        return $out;
    }

    /** Bir YouTube playlist sayfasindan sirali, benzersiz video ID'leri (lockupViewModel). */
    private function playlistVideoIds(string $plid): array
    {
        try {
            $res = Http::timeout(25)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 TavlaTvBot/1.0', 'Accept-Language' => 'tr'])
                ->get('https://www.youtube.com/playlist', ['list' => $plid]);
        } catch (\Throwable $e) {
            return [];
        }
        if (! $res->ok()) {
            return [];
        }
        $html = $res->body();
        $ids = [];
        // Her lockupViewModel blogundaki ilk contentId = video (kuyruk komutu degil)
        if (preg_match_all('/"lockupViewModel":\{.*?"contentId":"([A-Za-z0-9_-]{11})"/s', $html, $m)) {
            foreach ($m[1] as $vid) {
                if (! in_array($vid, $ids, true)) {
                    $ids[] = $vid;
                }
            }
        }
        return $ids;
    }

    /** YouTube oEmbed'den video basligi (ve kapak). Basarisizsa bos. */
    private function oembed(string $vid): array
    {
        try {
            $res = Http::timeout(15)->get('https://www.youtube.com/oembed', [
                'format' => 'json',
                'url' => "https://www.youtube.com/watch?v={$vid}",
            ]);
            if ($res->ok()) {
                return $res->json() ?? [];
            }
        } catch (\Throwable $e) {
            /* baslik yok -> id kullanilir */
        }
        return [];
    }

    /** Yerel JSON: [{title, video_id, organizer, image, event_at, sort}, ...] */
    private function parseJson(string $json): array
    {
        $data = json_decode($json, true);
        if (! is_array($data)) {
            return [];
        }
        $out = [];
        $i = 0;
        foreach ($data as $row) {
            $vid = trim((string) ($row['video_id'] ?? ''));
            $title = trim((string) ($row['title'] ?? ''));
            if ($vid === '' || $title === '') {
                continue;
            }
            $out[] = [
                'title' => mb_substr($title, 0, 200),
                'video_id' => $vid,
                // Seri bos ise frontend 'Videolar' grubuna dusuruyor -> seriyi de oyle yaz (bos kalmasin)
                'organizer' => trim((string) ($row['organizer'] ?? '')) ?: 'Videolar',
                'image' => isset($row['image']) && $row['image'] !== '' ? (string) $row['image'] : "https://i.ytimg.com/vi/{$vid}/hqdefault.jpg",
                'event_at' => isset($row['event_at']) && $row['event_at'] !== '' ? (string) $row['event_at'] : null,
                'sort' => isset($row['sort']) ? (int) $row['sort'] : $i,
            ];
            $i++;
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
