<?php

namespace App\Support;

/**
 * İstenen HOST'tan marka (dil + sunum) çözümü — TEK kaynak.
 *
 * tavlatv.com  -> ['key'=>'tavla',  'locale'=>'tr', ...]
 * gammontv.com -> ['key'=>'gammon', 'locale'=>'en', ...]
 *
 * config/brands.php tablosunu okur. SeoMeta (SSR meta), AppServiceProvider (e-posta
 * linkleri/konuları) ve host-duyarlı manifest/robots/sitemap rotaları buradan besler.
 */
final class Brand
{
    /** Host dizesinden marka anahtarı (eşleşme yoksa brands.default). */
    public static function keyFromHost(?string $host): string
    {
        $host = strtolower((string) $host);
        foreach ((array) config('brands.hosts', []) as $needle => $key) {
            if ($needle !== '' && str_contains($host, (string) $needle)) {
                return (string) $key;
            }
        }

        return (string) config('brands.default', 'tavla');
    }

    /** Host'a karşılık gelen marka yapılandırması (anahtar dahil). */
    public static function fromHost(?string $host): array
    {
        $key = self::keyFromHost($host);
        $brand = (array) config("brands.brands.$key", []);
        if ($brand === []) {
            $key = (string) config('brands.default', 'tavla');
            $brand = (array) config("brands.brands.$key", []);
        }

        return ['key' => $key] + $brand;
    }

    /** Geçerli isteğin markası (request yoksa varsayılan). */
    public static function current(): array
    {
        $host = null;
        try {
            $host = request()?->getHost();
        } catch (\Throwable) {
            $host = null;
        }

        return self::fromHost($host);
    }

    /** Geçerli markada cep telefonu zorunlu/sorulur mu? (TavlaTv evet, GammonTV hayır.) */
    public static function requiresPhone(): bool
    {
        return (bool) (self::current()['require_phone'] ?? true);
    }

    /** Markanın kanonik kökü, SONUNDA '/' ile (SeoMeta BASE yerine). */
    public static function base(array $brand): string
    {
        return rtrim((string) ($brand['origin'] ?? 'https://www.tavlatv.com'), '/').'/';
    }
}
