import { useT, type Lang } from '../i18n'

interface Props {
  isUser: boolean
  rating: number | null
  onVsBot: () => void
  onOnline: () => void
  onLogin: () => void
  onEditProfile: () => void
  onLogout?: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  lang: Lang
  onToggleLang: () => void
  playerName: string
}

export default function Home({
  isUser,
  rating,
  onVsBot,
  onOnline,
  onLogin,
  onEditProfile,
  onLogout,
  theme,
  onToggleTheme,
  lang,
  onToggleLang,
  playerName,
}: Props) {
  const { t } = useT()
  return (
    <div className="home-screen">
      <div className="home-card">
        <div className="home-brand">
          <span className="brand-badge">{t('brand.short')}</span>
          <h1 className="brand-full">{t('brand.name')}</h1>
        </div>
        <p className="home-tagline">{t('home.tagline')}</p>

        {playerName && (
          <div className="home-hello">
            {t('home.hello', { name: playerName })}
            {rating != null && <span className="account-rating">⭐ {rating}</span>}
          </div>
        )}

        <div className="home-actions">
          <button className="home-btn primary" onClick={onVsBot}>
            <span className="home-btn-ico">🤖</span>
            <span className="home-btn-text">
              <b>{t('home.vsBot')}</b>
              <small>{t('home.vsBotSub')}</small>
            </span>
          </button>
          <button className="home-btn" onClick={onOnline}>
            <span className="home-btn-ico">🌐</span>
            <span className="home-btn-text">
              <b>{t('home.online')}</b>
              <small>{t('home.onlineSub')}</small>
            </span>
          </button>
        </div>

        <div className="home-footer">
          <button className="menu-btn" onClick={onToggleLang}>
            {lang === 'tr' ? 'EN' : 'TR'}
          </button>
          <button className="menu-btn" onClick={onToggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {isUser ? (
            <>
              <button className="menu-btn" onClick={onEditProfile}>
                {t('home.profile')}
              </button>
              {onLogout && (
                <button className="menu-btn" onClick={onLogout}>
                  {t('auth.logout')}
                </button>
              )}
            </>
          ) : (
            <button className="menu-btn active" onClick={onLogin}>
              {t('account.auth')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
