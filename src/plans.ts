// Uyelik kademeleri (Ucretsiz / Star / StarPRO). Backend plan id'leriyle ayni.
export type PlanId = 'free' | 'star' | 'starpro'

export interface Feature {
  key: string // i18n anahtari
  on: boolean // bu kademede var mi
}

export interface Plan {
  id: PlanId
  nameKey: string
  color: string
  yearly: number // $/yil (yalnız yıllık üyelik)
  features: Feature[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    nameKey: 'plan.free',
    color: 'var(--muted)',
    yearly: 0,
    features: [
      { key: 'feat.surfaceAnalysis', on: true }, // yuzeysel analiz
      { key: 'feat.bonus25', on: true }, // gunluk 25 bonus
      { key: 'feat.limitedLessons', on: true },
      { key: 'feat.chat', on: false },
      { key: 'feat.errorDb', on: false },
      { key: 'feat.errorJournal', on: false },
      { key: 'feat.premiumTournaments', on: false },
    ],
  },
  {
    id: 'star',
    nameKey: 'plan.star',
    color: '#a06bd4',
    yearly: 499, // TL/yil
    features: [
      { key: 'feat.deepAnalysis', on: true }, // derin analiz
      { key: 'feat.bonus50', on: true }, // gunluk 50 bonus
      { key: 'feat.unlimitedLessons', on: true },
      { key: 'feat.chat', on: true },
      { key: 'feat.errorDb', on: true },
      { key: 'feat.errorJournal', on: true },
      { key: 'feat.premiumTournaments', on: true },
    ],
  },
]
