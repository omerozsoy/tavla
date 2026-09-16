/**
 * BAHANE MAKİNESİ — veri katmanı (tek kaynak).
 *
 * 100 bahane BİREBİR burada tutulur; UI bileşenine dağıtılmaz. İleride veritabanına /
 * yönetim paneline taşınabilecek şekilde alan-tabanlı (id/text/category/rarity/enabled).
 * `weight` opsiyonel: şu an TANIMSIZ -> tüm bahaneler EŞİT olasılıkla seçilir (mimari
 * ileride ağırlıklı seçime hazır). Rarity yalnızca gösterim/renk; seçim ihtimalini değiştirmez.
 *
 * NOT: Metinler Türkçe içeriktir (tavla espri/atışma) ve dilden bağımsız aynı kalır;
 * yalnız arayüz metinleri (başlık, buton, rarity etiketi) i18n'den gelir.
 */

export type ExcuseCategory =
  | 'dice' // zar
  | 'luck' // şans
  | 'internet' // internet / cihaz
  | 'time' // süre / saat
  | 'cube' // küp
  | 'pr' // PR / analiz / istatistik
  | 'mistake' // dalgınlık / yanlış hamle
  | 'classic' // klasik atışma
  | 'funny' // absürt / komik

export type ExcuseRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface Excuse {
  id: number
  text: string
  category: ExcuseCategory
  rarity: ExcuseRarity
  enabled: boolean
  /** İleride ağırlıklı seçim için (tanımsız = 1). Şu an kullanılmıyor. */
  weight?: number
}

// Metinler backtick ile: hem tek (') hem çift (") tırnak içeren bahaneler güvenli.
export const EXCUSES: Excuse[] = [
  { id: 1, text: `Zar vermedi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 2, text: `Bugün zarlar bana düşman.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 3, text: `Hep sana çift geldi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 4, text: `Benim zarlar bozuk.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 5, text: `Bu zar normal değil.`, category: 'dice', rarity: 'rare', enabled: true },
  { id: 6, text: `Şansın tuttu bugün.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 7, text: `Bir daha oynasak böyle olmaz.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 8, text: `Tam açılıyordum, oyun bitti.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 9, text: `Son zar tamamen şanstı.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 10, text: `O 6-6 gelmese görürdün.`, category: 'dice', rarity: 'rare', enabled: true },
  { id: 11, text: `Bana bir kere çift gelmedi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 12, text: `Hep ihtiyacın olan zarı attın.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 13, text: `Ben zar değil, sabır attım.`, category: 'funny', rarity: 'rare', enabled: true },
  { id: 14, text: `Zar biraz verse maç bendeydi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 15, text: `Böyle zarla dünya şampiyonu olursun.`, category: 'luck', rarity: 'rare', enabled: true },
  { id: 16, text: `Bugün şanslı günündesin.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 17, text: `Normalde seni rahat alırım.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 18, text: `Isınma maçıydı zaten.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 19, text: `Daha oyuna konsantre olamadım.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 20, text: `Elim mouse'a alışmadı.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 21, text: `Telefonda oynuyorum.`, category: 'internet', rarity: 'common', enabled: true },
  { id: 22, text: `Ekran küçük.`, category: 'internet', rarity: 'common', enabled: true },
  { id: 23, text: `İnternet takıldı.`, category: 'internet', rarity: 'common', enabled: true },
  { id: 24, text: `Mouse kaçırdı.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 25, text: `Yanlış taşı tuttum.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 26, text: `Oraya oynamayacaktım.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 27, text: `Parmağım kaydı.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 28, text: `Yanlışlıkla onayladım.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 29, text: `Hamleyi geri alabilsem maç değişirdi.`, category: 'mistake', rarity: 'rare', enabled: true },
  { id: 30, text: `Dalgınlığıma geldi.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 31, text: `Bir an telefona baktım.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 32, text: `Mesaj geldi, dikkatim dağıldı.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 33, text: `Biri konuştu, hamleyi kaçırdım.`, category: 'mistake', rarity: 'common', enabled: true },
  { id: 34, text: `Kahve almaya kalkmıştım.`, category: 'funny', rarity: 'rare', enabled: true },
  { id: 35, text: `Uykusuzum.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 36, text: `Çok yorgunum.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 37, text: `Kafam bugün tavlada değil.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 38, text: `Ben ciddi oynamıyorum zaten.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 39, text: `Eğlencesine oynuyorum.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 40, text: `Rating umurumda değil.`, category: 'pr', rarity: 'common', enabled: true },
  { id: 41, text: `Coin için oynamıyorum zaten.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 42, text: `Ben hızlı oynadım.`, category: 'time', rarity: 'common', enabled: true },
  { id: 43, text: `Biraz düşünsem kazanırdım.`, category: 'time', rarity: 'common', enabled: true },
  { id: 44, text: `Süre baskısı yüzünden oldu.`, category: 'time', rarity: 'common', enabled: true },
  { id: 45, text: `Saat olmasa görürdün.`, category: 'time', rarity: 'common', enabled: true },
  { id: 46, text: `Hızlı oyun bana göre değil.`, category: 'time', rarity: 'common', enabled: true },
  { id: 47, text: `Uzun maçta şansın kalmaz.`, category: 'time', rarity: 'rare', enabled: true },
  { id: 48, text: `11 puanlık oynayalım da görelim.`, category: 'time', rarity: 'rare', enabled: true },
  { id: 49, text: `Tek maçla tavlacı olunmaz.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 50, text: `Tavla uzun vadeli oyun.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 51, text: `Şans kısa vadede seni kurtardı.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 52, text: `Matematik benden yanaydı aslında.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 53, text: `Pozisyon bendeydi.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 54, text: `Oyun tamamen bendeydi.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 55, text: `Son anda döndü.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 56, text: `Marsa gidiyordun, farkında değilsin.`, category: 'funny', rarity: 'rare', enabled: true },
  { id: 57, text: `Küpü yanlış zamanda verdim.`, category: 'cube', rarity: 'common', enabled: true },
  { id: 58, text: `Küpü almasaydım zaten.`, category: 'cube', rarity: 'common', enabled: true },
  { id: 59, text: `O küp alınmazdı normalde.`, category: 'cube', rarity: 'common', enabled: true },
  { id: 60, text: `Küpü tamamen dalgınlığıma aldım.`, category: 'cube', rarity: 'common', enabled: true },
  { id: 61, text: `Sen de o küpü vermemeliydin.`, category: 'cube', rarity: 'rare', enabled: true },
  { id: 62, text: `XG'ye sok, görürsün.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 63, text: `Analizde kimin iyi oynadığı çıkar.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 64, text: `PR'a bakalım, sonra konuş.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 65, text: `Skor her şeyi anlatmaz.`, category: 'pr', rarity: 'common', enabled: true },
  { id: 66, text: `Kazandın ama kötü oynadın.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 67, text: `Ben daha düşük PR yapmışımdır.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 68, text: `Luck rate'e bak bir de.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 69, text: `Zar istatistiklerini aç bakalım.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 70, text: `Çift sayılarını karşılaştıralım.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 71, text: `Kaç kere kırdın, ona bak.`, category: 'pr', rarity: 'rare', enabled: true },
  { id: 72, text: `Kaç kere dans ettim, saydın mı?`, category: 'dice', rarity: 'rare', enabled: true },
  { id: 73, text: `Bardayken hiç zar gelmedi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 74, text: `Seni kıramadım ki.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 75, text: `Her açık verdiğimde vurdun.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 76, text: `Sen açık verdin, ben vuramadım.`, category: 'luck', rarity: 'common', enabled: true },
  { id: 77, text: `Bir tane 1 lazım, gelmedi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 78, text: `Bir tane 6 lazım, gelmedi.`, category: 'dice', rarity: 'common', enabled: true },
  { id: 79, text: `Ne lazımsa tersi geldi.`, category: 'dice', rarity: 'rare', enabled: true },
  { id: 80, text: `Tavla değil, piyango oynadık.`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 81, text: `Zarların sponsoru kim?`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 82, text: `Zar motoruyla akrabalığın mı var?`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 83, text: `Sunucu seni seviyor herhalde.`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 84, text: `Admin torpili mi var?`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 85, text: `RNG seni evlat edinmiş.`, category: 'funny', rarity: 'mythic', enabled: true },
  { id: 86, text: `Zarlar seni görünce hizaya giriyor.`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 87, text: `Ben oynuyorum, sen zar seyrediyorsun.`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 88, text: `Sen tavla değil zar oynadın.`, category: 'funny', rarity: 'rare', enabled: true },
  { id: 89, text: `Bugün taş değil, nazar taşı oynadım.`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 90, text: `Benim zarlar hâlâ yükleniyor.`, category: 'funny', rarity: 'legendary', enabled: true },
  { id: 91, text: `Şans kotam geçen maçta bitmiş.`, category: 'funny', rarity: 'legendary', enabled: true },
  { id: 92, text: `Zarlarım gümrükte kaldı.`, category: 'funny', rarity: 'legendary', enabled: true },
  { id: 93, text: `Çiftler yanlış adrese teslim edildi.`, category: 'funny', rarity: 'legendary', enabled: true },
  { id: 94, text: `Benim 6-6'yı sana göndermişler.`, category: 'funny', rarity: 'legendary', enabled: true },
  { id: 95, text: `Sistem bana "bugün olmaz" dedi.`, category: 'funny', rarity: 'epic', enabled: true },
  { id: 96, text: `Bu maçın tekrarını istiyorum.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 97, text: `Rövanşta konuşuruz.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 98, text: `Aynı zarlarla bir daha oynayalım.`, category: 'classic', rarity: 'rare', enabled: true },
  { id: 99, text: `Şimdi ısındım, bir daha gel.`, category: 'classic', rarity: 'common', enabled: true },
  { id: 100, text: `Kazandın diye iyi oynadığını sanma.`, category: 'classic', rarity: 'rare', enabled: true },
]

/** Aktif (enabled) bahaneler — çark ve seçim yalnızca bunları kullanır. */
export function getExcuses(): Excuse[] {
  return EXCUSES.filter((e) => e.enabled)
}

/**
 * Rastgele bir bahane seç. `prevId` verilirse aynı bahanenin ARKA ARKAYA çıkması engellenir.
 * Ağırlıklı seçim `weight` alanı ile ileride devreye girer (tanımsız = 1 -> şu an eşit olasılık).
 */
export function pickRandomExcuse(prevId?: number): Excuse {
  const pool = getExcuses()
  if (pool.length === 0) throw new Error('Bahane havuzu boş.')
  // Tek bahane varsa no-repeat uygulanamaz; onu döndür.
  const candidates = pool.length > 1 && prevId != null ? pool.filter((e) => e.id !== prevId) : pool
  const list = candidates.length > 0 ? candidates : pool
  const total = list.reduce((s, e) => s + (e.weight ?? 1), 0)
  let r = Math.random() * total
  for (const e of list) {
    r -= e.weight ?? 1
    if (r <= 0) return e
  }
  return list[list.length - 1]
}
