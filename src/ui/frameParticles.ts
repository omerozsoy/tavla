import type { ISourceOptions } from '@tsparticles/engine'
import type { FrameParticle } from './avatarFrames'

// Cerceve partikul presetleri. Kurallar:
//  - Az sayida (6-14) parcacik; avatarin yuzunu KAPATMAZ (dis halkada/kenarda toplanir).
//  - Yalnizca transform/opacity animasyonu (GPU); link/cizgi yok.
//  - Mobil/az yer icin cagrildigi yerde sayi ayrica dusurulur (density prop).
// Not: tsParticles kendi canvasini yonetir; katman .avf-particles icinde mutlak konumlu.

const base = (extra: Partial<ISourceOptions> = {}): ISourceOptions => ({
  fullScreen: { enable: false },
  detectRetina: true,
  fpsLimit: 45,
  pauseOnBlur: true,
  pauseOnOutsideViewport: true,
  background: { color: 'transparent' },
  ...extra,
})

export const FRAME_PARTICLES: Record<FrameParticle, (n: number) => ISourceOptions> = {
  // Koz/kivilcim — alttan hafif yukari suzulur, kirmizi-turuncu, ustte soner
  ember: (n) =>
    base({
      particles: {
        number: { value: Math.round(6 * n) },
        color: { value: ['#fed7aa', '#fb923c', '#f97316', '#ef4444'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0, max: 0.9 }, animation: { enable: true, speed: 1.2, sync: false, startValue: 'max', destroy: 'min' } },
        size: { value: { min: 0.6, max: 2 } },
        move: {
          enable: true,
          direction: 'top',
          speed: { min: 0.4, max: 1.1 },
          straight: false,
          random: true,
          outModes: { default: 'destroy', bottom: 'none' },
          gravity: { enable: true, acceleration: -3 },
        },
      },
      emitters: {
        position: { x: 50, y: 96 },
        rate: { quantity: 1, delay: 0.3 },
        size: { width: 70, height: 0 },
      },
    }),

  // Altin tozu — cok yavas suzulen, seyrek parildayan altin zerreler
  gold: (n) =>
    base({
      particles: {
        number: { value: Math.round(7 * n) },
        color: { value: ['#fff8dc', '#fde68a', '#fbbf24'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.1, max: 0.85 }, animation: { enable: true, speed: 0.8, sync: false } },
        size: { value: { min: 0.5, max: 1.6 } },
        move: { enable: true, direction: 'none', speed: { min: 0.15, max: 0.5 }, random: true, straight: false, outModes: { default: 'out' } },
        shadow: { enable: true, color: '#fbbf24', blur: 3 },
      },
    }),

  // Kar/buz — yavas dusen soguk beyaz-mavi taneler
  snow: (n) =>
    base({
      particles: {
        number: { value: Math.round(8 * n) },
        color: { value: ['#ffffff', '#e0f2fe', '#bae6fd'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.2, max: 0.8 } },
        size: { value: { min: 0.5, max: 1.8 } },
        move: { enable: true, direction: 'bottom', speed: { min: 0.3, max: 0.8 }, straight: false, random: true, outModes: { default: 'out' }, drift: { min: -0.4, max: 0.4 } },
      },
    }),

  // Elektrik — kucuk, hizli, seyrek mavi-beyaz kivilcimlar
  spark: (n) =>
    base({
      particles: {
        number: { value: Math.round(5 * n) },
        color: { value: ['#ffffff', '#bfdbfe', '#60a5fa'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0, max: 1 }, animation: { enable: true, speed: 3, sync: false, startValue: 'max', destroy: 'min' } },
        size: { value: { min: 0.5, max: 1.4 } },
        move: { enable: true, direction: 'none', speed: { min: 1, max: 2.4 }, straight: true, random: true, outModes: { default: 'destroy' } },
      },
      emitters: { position: { x: 50, y: 50 }, rate: { quantity: 1, delay: 0.5 }, size: { width: 90, height: 90 } },
    }),

  // Kozmik — kucuk yildizlar + toz, cok yavas suzulur, parildar
  cosmic: (n) =>
    base({
      particles: {
        number: { value: Math.round(10 * n) },
        color: { value: ['#ffffff', '#a5f3fc', '#c4b5fd', '#818cf8'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.1, max: 0.9 }, animation: { enable: true, speed: 0.9, sync: false } },
        size: { value: { min: 0.4, max: 1.4 } },
        move: { enable: true, direction: 'none', speed: { min: 0.08, max: 0.35 }, random: true, straight: false, outModes: { default: 'out' } },
      },
    }),

  // Kara delik — dis kenarda beliren mor parcaciklar merkeze dogru kuculuр cekilir
  gravity: (n) =>
    base({
      particles: {
        number: { value: Math.round(9 * n) },
        color: { value: ['#ddd6fe', '#c4b5fd', '#a78bfa', '#7c3aed'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.15, max: 0.9 } },
        size: { value: { min: 0.4, max: 1.8 }, animation: { enable: true, speed: 2.2, sync: false, startValue: 'max', destroy: 'min' } },
        move: {
          enable: true,
          center: { x: 50, y: 50, radius: 4 },
          direction: 'none',
          speed: { min: 0.4, max: 1 },
          random: false,
          straight: false,
          outModes: { default: 'destroy' },
          spin: { enable: true, acceleration: 6 },
        },
      },
      emitters: { position: { x: 50, y: 50 }, rate: { quantity: 1, delay: 0.4 }, size: { width: 100, height: 100 }, life: { count: 0 } },
    }),

  // Duman — cok hafif, koyu-gri, yavas yukselen
  smoke: (n) =>
    base({
      particles: {
        number: { value: Math.round(4 * n) },
        color: { value: ['#57534e', '#78716c', '#44403c'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0, max: 0.35 }, animation: { enable: true, speed: 0.7, sync: false, startValue: 'max', destroy: 'min' } },
        size: { value: { min: 3, max: 7 }, animation: { enable: true, speed: 2, sync: false, startValue: 'min' } },
        move: { enable: true, direction: 'top', speed: { min: 0.2, max: 0.5 }, straight: false, random: true, outModes: { default: 'destroy' } },
      },
      emitters: { position: { x: 50, y: 20 }, rate: { quantity: 1, delay: 1.2 }, size: { width: 40, height: 0 } },
    }),
}
