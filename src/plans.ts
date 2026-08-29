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
  yearly: number // $/yil
  monthly: number // $/ay
  features: Feature[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    nameKey: 'plan.free',
    color: 'var(--muted)',
    yearly: 0,
    monthly: 0,
    features: [
      { key: 'feat.lowAnalysis', on: true },
      { key: 'feat.lowBonus', on: true },
      { key: 'feat.basicModule', on: true },
      { key: 'feat.limitedLessons', on: true },
      { key: 'feat.limitedAi', on: true },
      { key: 'feat.chat', on: false },
      { key: 'feat.errorDb', on: false },
      { key: 'feat.customBoards', on: false },
    ],
  },
  {
    id: 'star',
    nameKey: 'plan.star',
    color: '#a06bd4',
    yearly: 499.9, // TL/yil
    monthly: 49.9, // TL/ay
    features: [
      { key: 'feat.analysis4ply', on: true },
      { key: 'feat.bonus800', on: true },
      { key: 'feat.detailedModule', on: true },
      { key: 'feat.unlimitedLessons', on: true },
      { key: 'feat.fullAiMatches', on: true },
      { key: 'feat.chat', on: true },
      { key: 'feat.errorDb4ply', on: true },
      { key: 'feat.customBoards', on: true },
    ],
  },
]
