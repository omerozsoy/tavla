// İKİNCİ-EKRAN (second-screen) HİLE SİNYALİ (destekleyici — kanıt değil).
//
// Oyuncu KENDİ turunda (zar attıktan sonra, hamlesini göndermeden önce) pencereyi gizler / odağı
// kaybederse = motor uygulamasına geçiş şüphesi. `/move` POST'una `blurred` bayrağı olarak gider;
// sunucu match_moves.blurred'a yazar; CheatScan::focusSignal kullanıcı-başına oranı toplar.
//
// Pencere: turnStarted() zar atılınca sıfırlar → noteBlur() blur/visibility-hidden'da işaretler →
// consumeBlur() hamle gönderilirken okunur+sıfırlanır. Böylece yalnız "zar-ile-hamle arası" blur
// sayılır (rakip turundaki masum uygulama değiştirme değil).
//
// ⚠ DESTEKLEYİCİ: ikinci FİZİKSEL cihaz (telefon kamerası) blur YARATMAZ; dikkatli hileci bayrağı
// göndermeyebilir → düşük oran masumiyet kanıtı DEĞİL, yüksek oran PR sinyalini güçlendirir.

let blurred = false
let wired = false

/** Oyuncunun turu başladı (zar atıldı) — birikmiş blur'u sıfırla. */
export function turnStarted(): void {
  blurred = false
}

/** Pencere gizlendi / odak kaybedildi. */
export function noteBlur(): void {
  blurred = true
}

/** Hamle gönderilirken: bu turda blur oldu mu? Oku ve sıfırla. */
export function consumeBlur(): boolean {
  const b = blurred
  blurred = false
  return b
}

/** blur + visibility dinleyicilerini BİR KEZ kur (idempotent; SSR-güvenli). */
export function setupSecondScreen(): void {
  if (wired || typeof window === 'undefined') return
  wired = true
  window.addEventListener('blur', noteBlur)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') noteBlur()
  })
}

setupSecondScreen()
