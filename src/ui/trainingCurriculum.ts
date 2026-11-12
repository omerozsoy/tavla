// Tavla Eğitimi müfredatı (BackgammonGalaxy "Mastery Path" düzeni).
// Kullanıcı yol haritasını verdi; her bölümün SORU İÇERİĞİ sonra eklenecek (authored pozisyonlar).
// Şimdilik yalnız "fundamentals" (Temel Kavramlar) oynanabilir (rastgele puzzle üreten trainer);
// diğerleri `ready:false` = kilitli ("içerik yakında"). İçerik geldikçe lesson.questions doldurulur.

export type LessonLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Lesson {
  id: string // kalıcı anahtar (ilerleme kaydı + derin-link)
  title: string
  questions: number // bölümdeki soru sayısı (yol haritası etiketinde gösterilir)
  ready?: boolean // true: oynanabilir (içerik/mekanik hazır). yoksa kilitli.
}

export interface LessonSection {
  level: LessonLevel
  titleKey: string // i18n başlık anahtarı (ör. "BAŞLANGIÇ SEVİYESİ")
  lessons: Lesson[]
}

// NOT: başlıklar şimdilik Türkçe gömülü (kullanıcının verdiği liste). İleride i18n'e taşınabilir.
export const CURRICULUM: LessonSection[] = [
  {
    level: 'beginner',
    titleKey: 'tr.level.beginner',
    lessons: [
      { id: 'fundamentals', title: 'Temel Kavramlar', questions: 10, ready: true },
      { id: 'opening-rolls', title: 'Açılış Zarları', questions: 15 },
      { id: 'building-sixprime', title: 'Altılı Blok Oluşturma', questions: 10 },
      { id: 'to-hit-or-not', title: 'Kırmalı mı, Kırmamalı mı?', questions: 11 },
      { id: 'midgame-strategies', title: 'Oyun Ortası Stratejileri', questions: 10 },
      { id: 'endgame-strategies', title: 'Oyun Sonu Stratejileri', questions: 10 },
    ],
  },
  {
    level: 'intermediate',
    titleKey: 'tr.level.intermediate',
    lessons: [
      { id: 'im-double5-blitz', title: 'Ders 1: Çift 5 ile Saldırı', questions: 12 },
      { id: 'im-early-cube', title: 'Ders 2: Oyunun Başında Küp Kararları', questions: 12 },
      { id: 'im-high-anchor', title: 'Ders 3: Yüksek Çapalı Bekleme Oyunları', questions: 10 },
      { id: 'im-deep-anchor', title: 'Ders 4: Derin Çapalı Bekleme Oyunları', questions: 9 },
      { id: 'im-holding-goalie', title: 'Ders 5: Bekleme Oyunları ve Kaleci Taş', questions: 10 },
      { id: 'im-back-checker-cube', title: 'Ders 6: Geride Tek Taş Varken Küp Kararları', questions: 10 },
      { id: 'im-anchor-21', title: 'Ders 7: 21 Hanesindeki Çapa — Kalmalı mı, Çıkmalı mı?', questions: 18 },
      { id: 'im-anchor-22', title: 'Ders 8: 22 Hanesindeki Çapa — Kalmalı mı, Çıkmalı mı?', questions: 20 },
      { id: 'im-risk-now-later', title: 'Ders 9: Riski Şimdi mi, Sonra mı Almalı? — 13 Hanesinden Oynamak', questions: 26 },
      { id: 'im-midgame-reference', title: 'Ders 10: Oyun Ortası Referans Pozisyonları', questions: 25 },
      { id: 'im-section-test', title: 'Bölüm Sonu Testi', questions: 16 },
    ],
  },
  {
    level: 'advanced',
    titleKey: 'tr.level.advanced',
    lessons: [
      { id: 'adv-michy-ubc', title: 'Michy’nin UBC’deki 20 Büyük Hatası', questions: 16 },
      { id: 'adv-bgwc2025-final', title: 'BGWC 2025 Final Testi (Monte Carlo)', questions: 20 },
      { id: 'adv-ubc2025-gm', title: 'UBC Online 2025 Büyükustalar Hataları', questions: 30 },
      { id: 'adv-bgwc-test3', title: 'BGWC Testi 3', questions: 10 },
      { id: 'adv-bgwc-test2', title: 'BGWC Testi 2', questions: 8 },
      { id: 'adv-bgwc-test1', title: 'BGWC Testi 1', questions: 10 },
      { id: 'adv-sebastian-ubc', title: 'Sebastian Wilkinson’ın UBC’deki 20 Büyük Hatası', questions: 20 },
      { id: 'adv-simon-ubc', title: 'Simon Barget’ın UBC’deki 20 Büyük Hatası', questions: 19 },
      { id: 'adv-bar-double5', title: 'Üçüncü Zar Atışında Bardan Çift 5 ile Giriş', questions: 19 },
      { id: 'adv-ian-terry-49', title: 'Ian Terry’nin 49 Büyük Hatası (Marc’ın Analiziyle)', questions: 49 },
      { id: 'adv-marc-olsen', title: 'Marc Olsen’ın Oyun Ortasındaki Büyük Hataları', questions: 22 },
      { id: 'adv-sixprime-or-blitz', title: 'Altılı Blok mu, Saldırı mı?', questions: 14 },
      { id: 'adv-ryan-rebelo-cube', title: 'Ryan Rebelo’nun Küp Hataları', questions: 11 },
      { id: 'adv-john-ohagan', title: 'John O’Hagan’ın Taş Oynama Kararları', questions: 11 },
    ],
  },
]

export const ALL_LESSONS: Lesson[] = CURRICULUM.flatMap((s) => s.lessons)
export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id)
}
