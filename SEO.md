# TavlaTV SEO Yol Haritası

Son denetim: 23 Eylül 2026  
Başlangıç tahmini puan: **66/100**

Bu dosya SEO çalışmasının tek takip listesidir. Kod değişikliği yapılmadan önce ilgili madde seçilir; değişiklikten sonra test ve canlı URL kontrolü eklenir.

Anahtar kelime kümeleri ve hedef sayfa eşlemesi için [SEO_KEYWORDS.md](SEO_KEYWORDS.md) kullanılır.

## Tamamlananlar

- [x] `robots.txt` ve `sitemap.xml` canlıda 200 dönüyor.
- [x] Sitemap’teki 37 URL’nin tamamı canlıda 200 dönüyor.
- [x] Public rotalarda route-specific title, description ve canonical uygulanıyor.
- [x] Hesap/uygulama rotaları `noindex, follow` oldu.
- [x] Bulunmayan haber ve rehber slug’ları 404 + noindex dönüyor.
- [x] Ana sayfa description yaklaşık 211 karakterden yaklaşık 140 karaktere indirildi.
- [x] JS kapalı crawler’lar için noscript içeriğine public iç bağlantılar eklendi.
- [x] Var olmayan İngilizce URL sinyalleri kaldırıldı; JSON-LD dili Türkçe olarak düzeltildi.
- [x] Public SEO sayfalarına `BreadcrumbList` JSON-LD eklendi.
- [x] `SeoMetaTest`: 3 test, 9 assertion geçti.
- [x] Frontend production build başarılı.

## Kalan işler — öncelik sırasıyla

### P0 — Public içeriklerin ilk HTML’de sunulması

- [x] Public landing rotalarının JS kapalı HTML’inde route-specific H1/H2, açıklama, madde listesi ve iç bağlantılar sunuluyor.
- [ ] `/`, `/online-tavla`, `/tavla-oyna`, `/nasil-oynanir`, `/tavla-rehberi` gibi public sayfalar için SSR veya güvenli prerender planı hazırlanmalı.
- [ ] İlk HTML içinde gerçek başlık, açıklayıcı içerik, H1/H2 ve ana iç bağlantılar bulunmalı.
- [ ] React oyun akışına dokunmadan yalnızca SEO landing içerikleri server HTML’e alınmalı.
- [ ] Googlebot mobile ve JS kapalı crawler ile before/after kontrolü yapılmalı.

### P1 — Dinamik içerik SEO kontrolü

- [ ] Yayındaki haber slug’ları sitemap ile otomatik eşleştirilmeli.
- [ ] Silinen veya taslak haberler sitemap’ten otomatik çıkarılmalı.
- [x] Yayındaki haber detaylarına gerçek başlık, açıklama, varsa görsel, yazar ve publisher ile `Article` JSON-LD eklendi.
- [ ] Haber detaylarında gerçek yayın tarihi alanı doğrulanıp `datePublished`/`dateModified` eklenmeli.
- [ ] Haber görseli olmayan içerikler için güvenli fallback OG görseli kullanılmalı.

### P1 — Teknik indeksleme doğrulaması

- [x] Sitemap URL’leri için 200, canonical ve `index, follow` regresyon testi eklendi.
- [x] Hukuki/noindex sayfalar sitemap’ten çıkarıldı; testte tekrar giriş yapmaları yakalanıyor.
- [ ] Canonical URL’nin HTTPS + `www` standardıyla aynı kaldığı tüm rotalarda doğrulanmalı.

### P2 — Structured data ve içerik zenginliği

- [ ] Rehber yazılarına yayın tarihi, güncelleme tarihi, görsel ve publisher logo alanları eklenmeli.
- [ ] `FAQPage` yalnızca gerçekten soru-cevap içeren sayfalarda kullanılmalı.
- [ ] Gerekli sayfalara `WebPage`, `SoftwareApplication` veya `VideoGame` alanları doğrulanmalı.
- [ ] Google Rich Results Test ve Schema Markup Validator ile canlı doğrulama yapılmalı.

### P2 — Core Web Vitals ve mobil SEO

- [ ] Gerçek mobil Lighthouse/PageSpeed ölçümü alınmalı.
- [ ] LCP, INP ve CLS değerleri Search Console ile izlenmeli.
- [ ] İlk yüklemede büyük WASM/JS paketlerinin landing sayfalarını geciktirmediği doğrulanmalı.
- [ ] Görsellerde boyut, lazy-load ve modern format kullanımı denetlenmeli.

### P2 — Erişilebilirlik ve görsel SEO

- [ ] Tüm anlamlı görsellerde doğru `alt` metni kontrol edilmeli.
- [ ] Dekoratif görseller boş alt ile işaretlenmeli.
- [ ] Public sayfalarda tek ve görünür H1 doğrulanmalı.
- [ ] Link metinleri bağlamdan bağımsız anlaşılır olmalı.

### P3 — Dil ve uluslararası SEO

- [ ] İngilizce veya diğer diller SEO hedefi olacaksa URL tabanlı dil yapısı (`/en/...`) tasarlanmalı.
- [ ] Dil URL’leri oluşmadan `hreflang` eklenmemeli.
- [ ] Dil URL’leri eklendiğinde karşılıklı `hreflang`, canonical ve sitemap ayrımı yapılmalı.

### P3 — Ölçüm ve indeksleme operasyonu

- [ ] Google Search Console’a sitemap gönderilmeli.
- [ ] Index Coverage ve Page Experience haftalık izlenmeli.
- [ ] En çok gösterim alan sorgular için title/description CTR testi yapılmalı.
- [ ] 404, soft-404 ve canonical seçimi raporları düzenli kontrol edilmeli.

## Bilinen sınırlama

CSP enforcing site akışını bozduğu için beta sürümde ertelenmiştir. Bu SEO listesine dahil değildir; ileride Google GSI, WASM ve üçüncü taraf kaynaklarla birlikte ayrıca test edilmelidir.
