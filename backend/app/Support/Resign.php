<?php

namespace App\Support;

/**
 * RESIGN / PES ETME — KESİN ve DEĞİŞMEZ kural. Backend TEK KAYNAK; frontend src/engine/resign.ts ile
 * BİREBİR aynı. Pes AYRI aksiyon: tür (SINGLE/GAMMON/BACKGAMMON) SEÇİLİR, tahtadan tahmin EDİLMEZ.
 *
 *   pointsWon = cubeValue × multiplier
 *   SINGLE = ×1 · GAMMON = ×2 · BACKGAMMON = ×3
 *
 * Kodun başka yerinde 1/2/3 magic number YAZILMAZ; hep bu sınıf kullanılır.
 */
final class Resign
{
    public const SINGLE = 'single';

    public const GAMMON = 'gammon';

    public const BACKGAMMON = 'backgammon';

    /** Çarpanlar TEK yerde. */
    private const MULT = [
        self::SINGLE => 1,
        self::GAMMON => 2,
        self::BACKGAMMON => 3,
    ];

    /** @return string[] */
    public static function types(): array
    {
        return [self::SINGLE, self::GAMMON, self::BACKGAMMON];
    }

    public static function isValid(?string $type): bool
    {
        return $type !== null && isset(self::MULT[$type]);
    }

    public static function multiplier(string $type): int
    {
        if (! isset(self::MULT[$type])) {
            throw new \InvalidArgumentException("Geçersiz resign türü: {$type}");
        }

        return self::MULT[$type];
    }

    /** pointsWon = cubeValue × multiplier. cubeValue >= 1 olmalı. */
    public static function points(string $type, int $cubeValue): int
    {
        if ($cubeValue < 1) {
            throw new \InvalidArgumentException("Geçersiz cube değeri: {$cubeValue}");
        }

        return $cubeValue * self::multiplier($type);
    }
}
