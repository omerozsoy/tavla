<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Google Sign-In (ID token dogrulama). Client ID gizli degildir.
    'google' => [
        'client_id' => env(
            'GOOGLE_CLIENT_ID',
            '306143287506-u64icc2893q517phi6oi7089eicru801.apps.googleusercontent.com',
        ),
    ],

    // Yonetici e-postalari (virgulle ayrilabilir). Bu hesaplar admin sayilir.
    // GUVENLIK: kaynak koda gomulu e-posta YOK. Uretimde .env'de ADMIN_EMAILS
    // tanimlanmalidir (bkz. .env.example), aksi halde config-admin listesi bostur.
    'admin_emails' => array_filter(array_map('trim', explode(',', (string) env('ADMIN_EMAILS', '')))),

    // Anthropic (Claude) vision — Pozisyon Analizi "fotograftan diz" ozelligi.
    // Anahtar yoksa uc nokta 503 doner ("yapilandirilmadi").
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        // Opus daha iyi/kalibre okuyor (maliyet ~5x). Env ile Sonnet'e dusurulebilir.
        'model' => env('ANTHROPIC_VISION_MODEL', 'claude-opus-4-8'),
        // Kimlige-bagli (identity-linked) anahtar kullaniliyorsa workspace id sart.
        'workspace' => env('ANTHROPIC_WORKSPACE_ID'),
    ],

];
