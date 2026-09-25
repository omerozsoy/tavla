<?php

namespace App\Exceptions;

/**
 * BEKLENEN + kendiliğinden düzelen analiz (gnubg PR) hatası.
 *
 * AnalyzeMatchPrJob, gnubg servisi geçici olarak erişilemez/degrade olduğunda (health geçse
 * bile analiz sırasında watchdog restart / contention / 0-sayılan-karar) SAHTE 0.0 PR yazmak
 * yerine BİLEREK fırlatır -> Laravel $tries/backoff retry + tavla:gnubg-pr-heal cron temiz
 * rerun'da GERÇEK PR'ı yazar (self-healing). Bu bir SUNUCU HATASI (500) DEĞİLDİR.
 *
 * bootstrap/app.php'deki 500-alarm reporter bu sınıfı ATLAR (DB deadlock'larıyla aynı mantık):
 * loglanır ama admin'e e-posta/WhatsApp "🔴 Sunucu HATASI" GÖNDERİLMEZ -> "cli/queue" 500
 * spam'i olmaz. Gerçek beklenmedik hatalar (plain RuntimeException/vb.) etkilenmez.
 */
class TransientAnalysisException extends \RuntimeException {}
