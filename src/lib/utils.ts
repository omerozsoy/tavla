import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn/ui standart yardimcisi: kosullu sinif birlestirme + Tailwind cakisma cozumu.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
