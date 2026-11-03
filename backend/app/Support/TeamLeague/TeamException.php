<?php

namespace App\Support\TeamLeague;

/**
 * Tek hata tipi: makine-okunur kod + HTTP durum. Controller bunu yakalayıp
 * response()->json(['error' => $e->errorCode], $e->status) ile 4xx döndürür.
 * (Exception::$code int olarak ayrılmış → kendi kodumuz $errorCode'da tutulur.)
 */
class TeamException extends \RuntimeException
{
    public function __construct(public string $errorCode, public int $status = 422, ?string $message = null)
    {
        parent::__construct($message ?? $errorCode);
    }
}
