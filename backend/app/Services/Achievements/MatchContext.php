<?php

namespace App\Services\Achievements;

/**
 * MatchContext — tek bir degerlendirme icin event bayraklarini tasir.
 * StatsUpdater bir maci/turnuvayi isledikten sonra bunu uretir; AchievementService
 * 'event' tipli rozetleri bu bayraklara gore acar. Bayrak yoksa => false (guvenli).
 */
final class MatchContext
{
    /** @var array<string,bool> */
    private array $flags = [];

    public function set(string $flag, bool $on = true): self
    {
        if ($on) {
            $this->flags[$flag] = true;
        }
        return $this;
    }

    public function has(string $flag): bool
    {
        return $this->flags[$flag] ?? false;
    }

    /** @return string[] acik bayraklar (tavla_god zorluk sayimi icin) */
    public function activeFlags(): array
    {
        return array_keys($this->flags);
    }

    public function count(): int
    {
        return count($this->flags);
    }
}
