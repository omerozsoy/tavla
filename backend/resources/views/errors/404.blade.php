<!doctype html>
<html lang="tr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#A83A2B" />
    <meta name="robots" content="noindex, follow" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <title>Sayfa Bulunamadı (404) | TavlaTv</title>
    <meta name="description" content="Aradığınız sayfa bulunamadı. TavlaTV ana sayfasından ücretsiz online tavla oynamaya devam edebilirsiniz." />
    <style>
        :root {
            --bg: #f4efe6;
            --card: #fffdf8;
            --text: #2a2420;
            --muted: #7a7064;
            --accent: #a83a2b;
            --accent-ink: #f8f1e7;
            --border: #e6ddce;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #17130f;
                --card: #201a15;
                --text: #f1e9dd;
                --muted: #a89b8a;
                --accent: #d6604e;
                --accent-ink: #1a1410;
                --border: #342b22;
            }
        }
        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body {
            margin: 0;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }
        .wrap {
            width: 100%;
            max-width: 560px;
            text-align: center;
        }
        .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 28px;
            text-decoration: none;
            color: var(--text);
        }
        .brand img { width: 40px; height: 40px; border-radius: 10px; }
        .brand-name { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; }
        .brand-name span { color: var(--accent); }
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: clamp(28px, 6vw, 48px);
            box-shadow: 0 24px 60px -32px rgba(0, 0, 0, 0.35);
        }
        .code {
            font-size: clamp(4.5rem, 18vw, 8rem);
            font-weight: 900;
            line-height: 1;
            letter-spacing: -0.04em;
            color: var(--accent);
            margin: 0;
        }
        h1 { font-size: clamp(1.4rem, 4vw, 1.9rem); margin: 8px 0 10px; letter-spacing: -0.01em; }
        p.lead { color: var(--muted); margin: 0 auto 26px; max-width: 42ch; }
        .links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 11px 18px;
            border-radius: 12px;
            font-size: 0.95rem;
            font-weight: 600;
            text-decoration: none;
            border: 1px solid var(--border);
            color: var(--text);
            background: transparent;
            transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .btn:hover { border-color: var(--accent); transform: translateY(-1px); }
        .btn-primary {
            background: var(--accent);
            color: var(--accent-ink);
            border-color: var(--accent);
        }
        .btn-primary:hover { filter: brightness(1.05); }
    </style>
</head>
<body>
    <main class="wrap">
        <a class="brand" href="/">
            <img src="/icon-192.png" alt="TavlaTV" />
            <span class="brand-name">TAVLA<span>TV</span></span>
        </a>
        <div class="card">
            <p class="code">404</p>
            <h1>Sayfa Bulunamadı</h1>
            <p class="lead">
                Aradığın sayfa taşınmış, kaldırılmış ya da hiç var olmamış olabilir.
                Aşağıdaki bağlantılardan devam edebilirsin.
            </p>
            <nav class="links" aria-label="Öne çıkan sayfalar">
                <a class="btn btn-primary" href="/">Ana Sayfa</a>
                <a class="btn" href="/tavla-oyna">Tavla Oyna</a>
                <a class="btn" href="/nasil-oynanir">Nasıl Oynanır</a>
                <a class="btn" href="/online-turnuvalar">Turnuvalar</a>
            </nav>
        </div>
    </main>
</body>
</html>
