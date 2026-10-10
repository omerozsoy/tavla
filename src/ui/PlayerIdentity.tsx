import AvatarFrame from './AvatarFrame'
import PremiumCrown from './PremiumCrown'
import { CountryFlag } from './Flag'
import { DivisionChip } from './Badges'
import TopRankBadge from './TopRankBadge'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { useOnline } from '../presence'

/**
 * PlayerIdentity — site geneli tek oyuncu kimlik blogu: avatar + isim (ustte) +
 * rutbe (isim ALTINDA, ince/kibar altbaslik). Liderlik, canli maclar, profil vb.
 * her yerde ayni gorunum icin tek kaynak. Rutbe rozeti stili .player-id .rank-badge
 * ile sadelestirilir (Emil: renk yalniz aksan, ad koyu, rutbe muted).
 */
export default function PlayerIdentity({
  name,
  userId,
  rating,
  avatar,
  frame,
  country,
  flagInline = false,
  size = 30,
  rankSize = 'md',
  animated = false,
  lg = false,
  premium = false,
  admin = false,
  support = false,
  hidePresence = false,
  statusDot,
  className,
}: {
  name: string
  /** Oyuncu id — verilirse isim yanında site geneli top-3 rozeti (PR madalya / Rating kupa). */
  userId?: number | null
  rating?: number | null
  avatar?: string | null
  frame?: string | null
  country?: string | null
  /** true: ulke bayragini ismin YANINDA (satir-ici, dikdortgen) goster. Avatar
   *  uzerine rozet KONMAZ. Profil basliklarinda kullanilir. */
  flagInline?: boolean
  size?: number
  rankSize?: 'sm' | 'md'
  animated?: boolean
  lg?: boolean
  /** true: premium uye -> avatar ustunde altin tac. */
  premium?: boolean
  /** true: yonetici hesabi -> isim yaninda dolu kirmizi kalkan rozeti (hover "Yonetici"). */
  admin?: boolean
  /** true: destek personeli -> isim yaninda dolu krem kalkan rozeti (hover "Destek"). */
  support?: boolean
  /** true: isim onundeki cevrimici/cevrimdisi presence noktasini CIZME. */
  hidePresence?: boolean
  /** Verilirse: isim BASINDA (presence noktasi yerine) DURUM rengi nokta cizilir
   *  (available yesil / ready mavi / busy sari). Cevrimici oyuncular panelinde
   *  durum noktasini ismin onune tasimak icin. */
  statusDot?: 'available' | 'ready' | 'busy' | 'offline' | null
  className?: string
}) {
  // Site geneli çevrimiçi durumu: userId verilirse isim BAŞINA yeşil (online, yanıp sönen)
  // veya kırmızı (offline) nokta. İlk fetch tamamlanana kadar (known=false) çizilmez.
  const { online, known } = useOnline(userId)
  const { t } = useT()
  return (
    <span className={`player-id${lg ? ' lg' : ''}${className ? ' ' + className : ''}`}>
      <AvatarFrame src={avatar} frame={frame} size={size} name={name} animated={animated} />
      <span className="player-id-col">
        <span className="player-id-name">
          {/* Durum noktasi verildiyse (Cevrimici panel): isim basinda DURUM rengi nokta. */}
          {statusDot ? (
            <span className={`presence-dot status-dot--${statusDot}`} role="img" aria-hidden="true" />
          ) : (
            userId != null &&
            known &&
            !hidePresence && (
              <span
                className={`presence-dot ${online ? 'is-online' : 'is-offline'}`}
                role="img"
                aria-label={online ? 'Çevrimiçi' : 'Çevrimdışı'}
                title={online ? 'Çevrimiçi' : 'Çevrimdışı'}
              />
            )
          )}
          <span className="player-id-name-text">{name}</span>
          {/* Premium: ismin SONUNDA altın taç (pill yerine). */}
          {premium && <PremiumCrown size={20} style={{ marginLeft: 4 }} />}
          {/* Yönetici: dolu kırmızı kalkan rozeti (hover "Yönetici"). */}
          {admin && (
            <span
              className="player-id-admin"
              role="img"
              aria-label={t('role.admin')}
              title={t('role.admin')}
              style={{ color: '#A83A2B', display: 'inline-flex', marginLeft: 4 }}
            >
              <Icon name="shield-check" size={18} weight="fill" />
            </span>
          )}
          {/* Destek: dolu krem kalkan rozeti (hover "Destek"). Krem açık zeminde kaybolmasın
              diye ince koyu dış hat (drop-shadow) verilir. */}
          {support && (
            <span
              className="player-id-support"
              role="img"
              aria-label={t('role.support')}
              title={t('role.support')}
              style={{
                color: '#F4EFE6',
                display: 'inline-flex',
                marginLeft: 4,
                filter: 'drop-shadow(0 0 0.5px rgba(28,26,23,0.9)) drop-shadow(0 1px 1px rgba(28,26,23,0.35))',
              }}
            >
              <Icon name="shield-check" size={18} weight="fill" />
            </span>
          )}
          {/* Site geneli top-3 rozeti: PR sıralaması (madalya) + Rating sıralaması (kupa). */}
          {userId != null && <TopRankBadge userId={userId} size={20} />}
          {flagInline && country && (
            <CountryFlag
              code={country}
              size={lg ? 32 : 26}
              className="player-id-name-flag"
            />
          )}
        </span>
        {/* Rütbe isim altında. */}
        {rating != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
            <DivisionChip rating={rating} size={rankSize} />
          </span>
        )}
      </span>
    </span>
  )
}
