import { useId, useMemo } from 'react'
import Particles, { ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { Engine } from '@tsparticles/engine'
import { FRAME_PARTICLES } from './frameParticles'
import type { FrameParticle } from './avatarFrames'

// tsParticles motoru bir kez yuklenir (slim preset). Lazy: bu dosya yalnizca
// buyuk/tekil baglamda (profil/vitrin/oyun) import edilir; listelerde asla.
const init = async (engine: Engine) => {
  await loadSlim(engine)
}

export default function ParticleLayer({
  particle,
  density = 1,
}: {
  particle: FrameParticle
  density?: number
}) {
  const id = useId().replace(/:/g, '')
  const options = useMemo(() => FRAME_PARTICLES[particle](density), [particle, density])
  return (
    <ParticlesProvider init={init}>
      <Particles id={`avfp-${id}`} className="avf-particles-canvas" options={options} />
    </ParticlesProvider>
  )
}
