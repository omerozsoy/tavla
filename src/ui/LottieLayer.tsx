import { Lottie } from 'lottie-react'

// Lottie katmani — yalnizca cerceve config'inde `lottie` URL'si tanimliysa mount edilir.
// After Effects/Lottie JSON dosyasi eklenip FRAME_FX'te URL verilince otomatik yuklenir.
// v3 Lottie: src bir URL/yol veya cozumlenmis animasyon objesi olabilir (kendi fetch'ler).
export default function LottieLayer({ src }: { src: string }) {
  return <Lottie src={src} loop autoplay className="avf-lottie" />
}
