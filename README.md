# World Backgammon Council (Dünya Tavla Konseyi)

Tarayıcıda çalışan, yapay sinir ağı destekli tavla oyunu. React + TypeScript + Vite.

## Özellikler

- **Güçlü bot:** [wildbg](https://github.com/carsten-wenderdel/wildbg) sinir ağı, tarayıcıda `onnxruntime-web` (WASM) ile çalışır — sunucu gerekmez.
- **İki bot seviyesi:** Sinir Ağı (wildbg) ve hızlı heuristik.
- **Analiz paneli:** Kazanma olasılığı, equity, en iyi hamleler, gnubg tarzı hata sınıflandırması.
- **Küp (doubling cube):** Teklif/kabul/pas, Crawford kuralı, maç skoru (1/3/5/7 puan).
- **Etkileşim:** Tek tıkla oyna veya sürükle-bırak; birleşik hamleler; zar sırası değiştirme.
- **Kişiselleştirme:** Koyu/açık tema, 8 board renk teması, TR/EN dil desteği.
- **Üyelik + otomatik kayıt:** Yerel profil ve oyun kaydı (yarım kalmaz).

## Kurulum

```bash
npm install
npm run dev      # http://localhost:5173
```

## Komutlar

```bash
npm run dev      # gelistirme sunucusu
npm run build    # production build
npx vitest run   # testler
```

## Yapı

- `src/engine/` — tavla kurallari, hamle uretimi, sinir agi motoru (saf TypeScript, test kapsamli)
- `src/ui/` — tahta, zarlar, analiz paneli, kayit formu
- `public/models/` — wildbg ONNX agirliklari (contact/race)
- `src/ort/` — onnxruntime-web WASM dosyalari (offline calismasi icin)

## Lisans

Sinir agi modelleri wildbg'den (MIT/Apache). Proje kodu kisisel/egitim amacli.
