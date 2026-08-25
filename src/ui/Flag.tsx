// SVG bayraklar (emoji bayraklar Windows'ta render olmadigindan). 5 dil.
export function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const h = Math.round((size * 5) / 7)
  const common = {
    width: size,
    height: h,
    viewBox: '0 0 21 15',
    className: 'flag',
    role: 'img' as const,
    'aria-hidden': true,
  }
  const star =
    'M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.8L12 17l-6.2 3.8 1.6-6.8L2.2 9.5l6.9-.6z'
  switch (code) {
    case 'tr':
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#E30A17" />
          <circle cx="8.3" cy="7.5" r="3.6" fill="#fff" />
          <circle cx="9.5" cy="7.5" r="2.9" fill="#E30A17" />
          <path transform="translate(11,5.4) scale(0.175)" d={star} fill="#fff" />
        </svg>
      )
    case 'en':
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#012169" />
          <path d="M0,0 21,15 M21,0 0,15" stroke="#fff" strokeWidth="3" />
          <path d="M0,0 21,15 M21,0 0,15" stroke="#C8102E" strokeWidth="1.4" />
          <rect x="8.4" width="4.2" height="15" fill="#fff" />
          <rect y="5.4" width="21" height="4.2" fill="#fff" />
          <rect x="9.4" width="2.2" height="15" fill="#C8102E" />
          <rect y="6.4" width="21" height="2.2" fill="#C8102E" />
        </svg>
      )
    case 'es':
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#AA151B" />
          <rect y="3.75" width="21" height="7.5" fill="#F1BF00" />
        </svg>
      )
    case 'de':
      return (
        <svg {...common}>
          <rect width="21" height="5" fill="#000" />
          <rect y="5" width="21" height="5" fill="#DD0000" />
          <rect y="10" width="21" height="5" fill="#FFCE00" />
        </svg>
      )
    case 'fr':
      return (
        <svg {...common}>
          <rect width="7" height="15" fill="#0055A4" />
          <rect x="7" width="7" height="15" fill="#fff" />
          <rect x="14" width="7" height="15" fill="#EF4135" />
        </svg>
      )
    default:
      return null
  }
}
