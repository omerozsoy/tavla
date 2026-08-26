import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'

// Rive katmani — yalnizca cerceve config'inde `rive` URL'si tanimliysa mount edilir.
// Su an hicbir cerceve dosya tanimlamiyor; mimari hazir. .riv dosyasi eklenip
// FRAME_FX'te URL verilince bu katman otomatik devreye girer (foto ustunde, seffaf).
export default function RiveLayer({ src, stateMachine }: { src: string; stateMachine?: string }) {
  const { RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  })
  return <RiveComponent className="avf-rive" />
}
