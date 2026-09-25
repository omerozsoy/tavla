# İkon Eşleme Listesi — Tavla TV

Sitedeki **tüm arayüz ikonları** aşağıda. Hepsi `src/ui/Icon.tsx` içindeki tek `MAP`
üzerinden çalışır; uygulamada 577 yerde `<Icon name="..." />` şeklinde çağrılır ama
**çağrı yerleri hiç değişmez** — yalnızca bu tablodaki eşleme değişir.

## Nasıl doldurulur
- **YENİ İKON** sütununa, seçtiğin kütüphanedeki ikon adını yaz (ör. Lucide için `Trophy`,
  Tabler için `IconTrophy`).
- Emin olmadığın / karşılığı olmayan varsa boş bırak, ben en yakınını öneririm.
- "Kull." = kodda kabaca kaç yerde geçtiği (öncelik ipucu; dinamik kullanımlar eksik olabilir).
- Doldurup bana geri ver → `Icon.tsx`'i baştan yazıp (gerekirse paketi kurup) build alırım.

> Not: Aşağıdaki **100 semantik isim** ana settir. Ayrıca 2 "sızıntı" noktası var
> (bkz. en alt): 5 shadcn bileşeni + `ranks.ts` rütbe rozetleri — onları da aynı kütüphaneye
> ben taşırım, senin doldurman gerekmez.

---

## 1) Navigasyon / Menü / Sayfa
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `home` | House | 4 | Ana sayfa | |
| `menu` | List | 2 | Hamburger menü | |
| `book` | BookOpen | 3 | Sözlük / rehber | |
| `newspaper` | Newspaper | az | Haberler | |
| `briefcase` | Briefcase | az | Kariyer / kurumsal | |
| `building-office` | BuildingOffice | 2 | Kurumsal / organizasyon | |
| `monitor-play` | MonitorPlay | az | Canlı / TV | |
| `globe` | Globe | 2 | Dil / web | |
| `chevron` | CaretDown | 14 | Aşağı ok / açılır | |
| `caret-left` | CaretLeft | 6 | Sola (slider/geri) | |
| `caret-right` | CaretRight | 5 | Sağa (slider/ileri) | |
| `arrow-right` | ArrowRight | 15 | İleri / devam | |
| `arrow-up` | ArrowUp | 1 | Yukarı | |

## 2) Oyun / Tavla
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `play` | Play | 17 | Oyna / başlat | |
| `live` | Broadcast | 3 | Canlı maç | |
| `dice` | DiceFive | 9 | Zar / oyun | |
| `die-1` | DiceOne | 1 | Zar yüzü 1 | |
| `die-2` | DiceTwo | 1 | Zar yüzü 2 | |
| `die-3` | DiceThree | 2 | Zar yüzü 3 | |
| `die-4` | DiceFour | az | Zar yüzü 4 | |
| `die-5` | DiceFive | 1 | Zar yüzü 5 | |
| `die-6` | DiceSix | az | Zar yüzü 6 | |
| `robot` | Robot | 7 | Bot / yapay zekâ | |
| `sword` | Sword | 3 | Kılıç / arkadaş daveti | |
| `target` | Target | 5 | Hedef / maç uzunluğu | |
| `flag` | Flag | 9 | Pes / bayrak | |
| `analyze` | ChartLineUp | 3 | Analiz | |
| `chart` | ChartBar | 10 | Grafik / istatistik | |
| `chart-line` | ChartLine | 1 | Çizgi grafik | |
| `graduation` | GraduationCap | 1 | Öğren / eğitim | |
| `bulb` | Lightbulb | 6 | İpucu / fikir | |

## 3) Kullanıcı / Sosyal
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `user` | User | 6 | Profil | |
| `users` | UsersThree | 9 | Oyuncular / topluluk | |
| `user-plus` | UserPlus | 2 | Arkadaş ekle | |
| `chat` | ChatCircle | 11 | Sohbet | |
| `bell` | Bell | 5 | Bildirim | |
| `eye` | Eye | 12 | Görüntülenme / izle | |
| `camera` | Camera | 4 | Avatar / foto | |
| `smiley` | Smiley | 1 | Emoji / gülen | |
| `smiley-sad` | SmileySad | az | Üzgün | |
| `paper-plane-right` | PaperPlaneRight | 3 | Gönder (mesaj) | |
| `logout` | SignOut | 4 | Çıkış | |

## 4) Ödül / Rozet / Ekonomi
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `trophy` | Trophy | 19 | Kupa / turnuva | |
| `medal` | Medal | 18 | Madalya / PR sırası | |
| `crown` | Crown | 19 | Taç / lider | |
| `crown-simple` | CrownSimple | az | Sade taç | |
| `ranking` | Ranking | 4 | Sıralama | |
| `star` | Star | 12 | Yıldız / favori | |
| `coin` | Coin | 12 | Tek coin | |
| `coins` | Coins | 2 | Coin yığını | |
| `money` | Money | 3 | Para | |
| `banknotes` | Money | 1 | Banknot | |
| `credit-card` | CreditCard | 3 | Kredi kartı | |
| `bank` | Bank | az | Banka / ödeme | |
| `gift` | Gift | 4 | Hediye | |
| `ticket` | Ticket | 1 | Bilet | |
| `shop` | Storefront | 9 | Mağaza | |
| `cart` | ShoppingCart | 8 | Sepet | |
| `package` | Package | 4 | Paket / ürün | |
| `tag` | Tag | 1 | Etiket / fiyat | |
| `flame` | Flame | az | Seri / popüler | |
| `spinner-ball` | SpinnerBall | 1 | Şans çarkı | |
| `slot` | Cherries | 1 | Zar slotu (kiraz) | |

## 5) Aksiyon / Kontrol
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `x` | X | 77 | Kapat / iptal | |
| `check` | Check | 29 | Onay / seçili | |
| `checks` | Checks | az | Çift tik (okundu) | |
| `pencil` | Pencil | 1 | Düzenle | |
| `trash` | Trash | 11 | Sil | |
| `copy` | Copy | 1 | Kopyala | |
| `search` | MagnifyingGlass | 12 | Ara | |
| `file-magnifying-glass` | FileMagnifyingGlass | az | Dosya/kayıt incele | |
| `refresh` | ArrowsClockwise | 13 | Yenile | |
| `install` | DownloadSimple | 1 | İndir / kur | |
| `maximize` | ArrowsOut | az | Tam ekran | |
| `minimize` | ArrowsIn | az | Küçült | |
| `settings` | GearSix | 6 | Ayarlar | |
| `code` | Code | 2 | Kod / geliştirici | |
| `palette` | Palette | 1 | Tema / renk | |

## 6) Durum / Bildirim / Zaman
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `info` | Info | 4 | Bilgi | |
| `alert` | Warning | 7 | Uyarı (üçgen) | |
| `warning-circle` | WarningCircle | 2 | Uyarı (daire) | |
| `shield-check` | ShieldCheck | 8 | Güvenlik / doğrulandı | |
| `clock` | Clock | 4 | Saat / süre | |
| `calendar` | CalendarBlank | 4 | Takvim | |
| `calendar-dots` | CalendarDots | 2 | Etkinlik takvimi | |
| `lock` | Lock | 2 | Kilit | |
| `lock-key` | LockKey | 2 | Kilitli (anahtar) | |
| `lock-open` | LockKeyOpen | 1 | Kilit açık | |
| `fingerprint` | Fingerprint | az | Kimlik / güvenlik | |
| `pin` | MapPin | 8 | Konum | |
| `eye` (bkz. §3) | — | — | (yukarıda) | |

## 7) Tema / Ses
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `sun` | Sun | 2 | Açık tema | |
| `moon` | Moon | 2 | Koyu tema | |
| `volume` | SpeakerHigh | 1 | Ses açık | |
| `mute` | SpeakerSlash | az | Ses kapalı | |

## 8) İletişim / Sosyal medya
| Semantik isim | Şu anki (Phosphor) | Kull. | Ne için | YENİ İKON |
|---|---|---:|---|---|
| `phone` | Phone | 1 | Telefon | |
| `mail` | EnvelopeSimple | 1 | E-posta | |
| `megaphone` | Megaphone | az | Duyuru | |
| `instagram` | InstagramLogo | 2 | Instagram | |
| `youtube` | YoutubeLogo | 2 | YouTube | |
| `whatsapp` | WhatsappLogo | az | WhatsApp | |

---

## Senin doldurman GEREKMEYEN (ben taşırım) — bilgi amaçlı
Bunlar kütüphaneyi doğrudan import ediyor; aynı sete ben geçireceğim:
- **shadcn bileşenleri** (`src/components/ui/`): `checkbox` (Check), `dialog` (X),
  `dropdown-menu` (Check, CaretRight, Circle), `radio-group` (Circle), `select` (Check, CaretDown, CaretUp)
- **`src/ranks.ts`** — rütbe/ünvan rozetleri (Phosphor’dan doğrudan). Yeni sette karşılığı
  olmayabilecek özel rozetler için sana ayrıca danışırım.

## Toplam: 100 semantik ikon
Doldurup verdiğinde: paketi kurar → `Icon.tsx` MAP’ini + sızıntı noktalarını çevirir →
`tsc` + build alır → görsel kontrol için birkaç ekran görüntüsü alırım.
