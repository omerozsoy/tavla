// ============================================================================
// TavlaTV — Design System Showcase (Coastal Club)
// DEV/ADMIN harness'i. Ayri Vite entry (showcase.html) -> production build'ine
// DAHIL DEGIL (frame-tiers gibi). Ana uygulamaya DOKUNMAZ.
// AMAC: projede GERCEKTEN kullanilan tum UI parcalarini (gercek App.css siniflari
// + gercek React componentleri) tek sayfada, ISIMLERIYLE gostermek.
// Buradaki hicbir sey kopya DEGIL: gercek componentler import edilir, gercek
// class'lar render edilir. "Showcase'deki X'i kullan" dendiginde birebir calisir.
// Erisim (dev): npm run dev -> http://localhost:5173/showcase.html
// ============================================================================
import { StrictMode, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import { LangProvider } from './i18n'
import { ToastProvider, useToast } from './ui/Toast'
import { Icon, ICON_NAMES } from './ui/Icon'
import { TavlaTvLogo, TavlaTvMark } from './ui/TavlaTvLogo'
import AvatarFrame from './ui/AvatarFrame'
import { DivisionChip, BadgeList } from './ui/Badges'
import { RankBadge } from './ui/RankBadge'
import { RANKS } from './ranks'
import DatePicker from './ui/DatePicker'
import { RARITY_COLORS, type RarityKey } from './ui/rarityColors'
import { AVATAR_FRAMES } from './ui/avatarFrames'

// ---- Terracotta (krem/kiremit) token tablolari (Colors / Typography / Spacing / Radius) ----
const COLORS: { name: string; token: string; hex: string; use: string }[] = [
  { name: 'Krem', token: '--med-ivory', hex: '#F4EFE6', use: 'Ana sayfa zemini / koyu üzeri açık metin' },
  { name: 'Beyaz', token: '--med-porcelain', hex: '#FFFFFF', use: 'Kart / yüzey' },
  { name: 'Ink', token: '--navy-brand', hex: '#1C1A17', use: 'PRIMARY/yapısal koyu + metin' },
  { name: 'Ink Deep', token: '--med-blue-deep', hex: '#100E0C', use: 'Primary hover' },
  { name: 'Kiremit (brick)', token: '--coral', hex: '#C9563F', use: 'ACCENT — sıcak vurgu' },
  { name: 'Brick Deep', token: '--coral-hover', hex: '#A83A2B', use: 'Açık zeminde accent + hover' },
  { name: 'Amber-gold', token: '--sky', hex: '#D99A3F', use: 'İkincil sıcak aksan / dekor' },
  { name: 'Soft Krem', token: '--powder', hex: '#EFE7D9', use: 'Soft yüzey / tint' },
  { name: 'Amber', token: '--orange', hex: '#D98B3A', use: 'Sıcak tersiyer (coin/puan)' },
  { name: 'Krem (warm)', token: '--cream', hex: '#F4EFE6', use: 'Sıcak soft yüzey' },
  { name: 'Ink Muted', token: '--slate', hex: '#5E574C', use: 'İkincil / muted metin' },
  { name: 'Line', token: '--med-sand', hex: '#DED7CA', use: 'Kenarlık' },
  { name: 'Success', token: '--color-success', hex: '#2E9E5B', use: 'Başarı / online' },
  { name: 'Warning', token: '--color-warning', hex: '#D98B3A', use: 'Uyarı (amber)' },
  { name: 'Destructive', token: '--color-error', hex: '#E0455E', use: 'Hata / tehlike' },
  { name: 'Info', token: '--color-info', hex: '#6B9BCC', use: 'Bilgi (muted blue)' },
]
const CHROME_TOKENS: { token: string; use: string }[] = [
  { token: '--bg', use: 'Sayfa zemini (Ice White)' },
  { token: '--card-bg', use: 'Kart / panel (near-white)' },
  { token: '--accent', use: 'Aksan (Coral)' },
  { token: '--on-accent', use: 'Coral zemin üzeri metin (ice)' },
  { token: '--text', use: 'Ana metin (Dark Navy)' },
  { token: '--muted', use: 'İkincil metin (Slate)' },
  { token: '--border', use: 'Kenarlık (soft ice)' },
  { token: '--input-bg', use: 'Form input zemini' },
]
const TYPO: { label: string; cls: string; note: string }[] = [
  { label: 'Display · Outfit 800', cls: 'sc-t-display', note: '--tv-font-display · clamp' },
  { label: 'H1 · başlık (serif)', cls: 'sc-t-h1', note: 'h1 · --fs-3xl 2.25rem' },
  { label: 'H2 · bölüm başlığı', cls: 'sc-t-h2', note: 'h2 · --fs-2xl 1.75rem' },
  { label: 'H3 · alt başlık', cls: 'sc-t-h3', note: 'h3 · --fs-xl 1.375rem' },
  { label: 'H4 · küçük başlık', cls: 'sc-t-h4', note: 'h4 · --fs-lg 1.125rem' },
  { label: 'Body · gövde metni (Outfit). Ciddi tavla için okunabilir, temiz.', cls: 'sc-t-body', note: 'body · --fs-md 1rem' },
  { label: 'Small · ikincil metin', cls: 'sc-t-small', note: '--fs-sm 0.875rem' },
  { label: 'Caption · etiket / açıklama', cls: 'sc-t-caption', note: '--fs-xs 0.8rem · muted' },
  { label: 'BUTON METNİ', cls: 'sc-t-btn', note: '--fw-semibold 600' },
  { label: '1487 · 2.35 PR', cls: 'sc-t-num', note: 'Numeric · Outfit (tabular-nums)' },
]
const SPACE = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-10']
const RADII = ['--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-pill']
const SECTIONS = [
  ['colors', '01 · Colors'],
  ['type', '02 · Typography'],
  ['buttons', '03 · Buttons'],
  ['cards', '04 · Cards'],
  ['nav', '05 · Navigation'],
  ['forms', '06 · Forms'],
  ['badges', '07 · Badges & Status'],
  ['tables', '08 · Tables'],
  ['modals', '09 · Modals & Overlays'],
  ['game', '10 · Game Components'],
  ['profile', '11 · Profile Components'],
  ['tokens', '12 · Spacing · Radius · Shadow'],
  ['icons', '13 · Icons'],
  ['ranks', '14 · Player Ranks'],
]

// ---- Kucuk yardimcilar (SADECE showcase duzeni; component kopyasi DEGIL) ----
function Item({ name, code, children }: { name: string; code?: string; children: ReactNode }) {
  return (
    <div className="sc-item">
      <div className="sc-item-demo">{children}</div>
      <div className="sc-item-meta">
        <span className="sc-item-name">{name}</span>
        {code && <code className="sc-item-code">{code}</code>}
      </div>
    </div>
  )
}
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="sc-section">
      <h2 className="sc-section-title">{title}</h2>
      <div className="sc-grid">{children}</div>
    </section>
  )
}
const Spin = () => <span className="sc-spin" aria-hidden />

// ============================== SHOWCASE ====================================
function Showcase() {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [slider, setSlider] = useState(6)
  const [checked, setChecked] = useState(true)
  const [radio, setRadio] = useState('a')
  const [toggle, setToggle] = useState(true)
  const [modal, setModal] = useState<null | 'basic' | 'confirm' | 'danger' | 'premium'>(null)
  const demoAvatar = '/icon-512.png'
  const frames = AVATAR_FRAMES.slice(0, 5)

  return (
    <div className="sc-root">
      {/* Sticky bolum menusu */}
      <header className="sc-topbar">
        <div className="sc-brand">
          <TavlaTvLogo size={22} />
          <span className="sc-brand-sub">Design System · Coastal Club</span>
        </div>
        <nav className="sc-nav">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="sc-nav-link">{label}</a>
          ))}
        </nav>
      </header>

      <main className="sc-main">
        <div className="sc-hero">
          <h1 className="sc-hero-title">UI Component Showcase</h1>
          <p className="sc-hero-sub">
            Projede <strong>gerçekten kullanılan</strong> componentler ve Coastal Club token'ları.
            Her parça gerçek App.css sınıfı ya da gerçek React component'idir — kopya değil.
            Etiketlerdeki <code>className</code> / <code>&lt;Component/&gt;</code> birebir kullanılabilir.
          </p>
        </div>

        {/* 01 COLORS */}
        <Section id="colors" title="01 · Colors — Coastal Club">
          <div className="sc-swatches">
            {COLORS.map((c) => (
              <div key={c.token} className="sc-swatch">
                <div className="sc-swatch-chip" style={{ background: c.hex }} />
                <div className="sc-swatch-info">
                  <strong>{c.name}</strong>
                  <code>{c.token}</code>
                  <code>{c.hex}</code>
                  <span>{c.use}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="sc-note">Semantik chrome token'ları (tema ile değişir):</div>
          <div className="sc-swatches">
            {CHROME_TOKENS.map((c) => (
              <div key={c.token} className="sc-swatch">
                <div className="sc-swatch-chip" style={{ background: `var(${c.token})` }} />
                <div className="sc-swatch-info">
                  <code>{c.token}</code>
                  <span>{c.use}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 02 TYPOGRAPHY */}
        <Section id="type" title="02 · Typography">
          <div className="sc-typo">
            {TYPO.map((t) => (
              <div key={t.cls} className="sc-typo-row">
                <div className={t.cls}>{t.label}</div>
                <code className="sc-item-code">{t.note}</code>
              </div>
            ))}
          </div>
        </Section>

        {/* 03 BUTTONS */}
        <Section id="buttons" title="03 · Buttons">
          <Item name="Primary (Gold)" code='class="galaxy-btn"'>
            <button className="galaxy-btn"><Icon name="robot" size={16} /> Yapay Zekaya Karşı</button>
          </Item>
          <Item name="Primary · disabled" code="disabled">
            <button className="galaxy-btn" disabled><Icon name="robot" size={16} /> Başla</button>
          </Item>
          <Item name="Primary · loading" code="disabled + spinner">
            <button className="galaxy-btn" disabled><Spin /> Yükleniyor…</button>
          </Item>
          <Item name="Secondary" code='class="btn-secondary"'>
            <button className="btn-secondary"><Icon name="users" size={16} /> Online Oyun</button>
          </Item>
          <Item name="Menu / Sidebar" code='class="menu-btn"'>
            <button className="menu-btn"><Icon name="trophy" size={18} /> Turnuvalar</button>
          </Item>
          <Item name="Menu · upgrade (gold)" code='class="menu-btn menu-upgrade"'>
            <button className="menu-btn menu-upgrade"><Icon name="crown" size={18} /> Üyelik</button>
          </Item>
          <Item name="Danger" code='class="danger-btn"'>
            <button className="danger-btn"><Icon name="trash" size={15} /> Hesabı Sil</button>
          </Item>
          <Item name="Danger · disabled" code="disabled">
            <button className="danger-btn" disabled><Icon name="flag" size={15} /> Terk Et</button>
          </Item>
          <Item name="Google (OAuth)" code='class="google-btn"'>
            <button className="google-btn">Google ile devam edin</button>
          </Item>
          <Item name="Icon button" code='class="menu-btn" (ikon-only)'>
            <button className="menu-btn" style={{ width: 'auto' }} aria-label="Ayarlar"><Icon name="settings" size={18} /></button>
          </Item>
          <Item name="Chip / Toggle chip" code='class="chip" · .chip.active'>
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button className="chip">Puan</button>
              <button className="chip active">Coin</button>
            </span>
          </Item>
          <Item name="Full width (form)" code='class="galaxy-btn" (100%)'>
            <button className="galaxy-btn" style={{ width: 260, justifyContent: 'center' }}>Giriş Yap</button>
          </Item>
          <div className="sc-note">Hover · Active · Focus canlıdır — üzerine gel, tıkla ya da Tab ile odaklan.</div>
          <div className="sc-note">
            Not: Proje CSS-sınıf tabanlıdır (ayrı <code>&lt;Button variant/&gt;</code> yok). Outline/Ghost ≈ <code>.btn-secondary</code>/<code>.menu-btn</code>,
            Text ≈ link-buton, Success buton ≈ <code>.galaxy-btn</code> + success tag. Boyut context'e göre padding ile verilir.
          </div>
        </Section>

        {/* 04 CARDS */}
        <Section id="cards" title="04 · Cards">
          <Item name="Basic / Home Card" code='class="home-card"'>
            <div className="home-card" style={{ maxWidth: 320 }}>
              <div className="home-panel-head"><Icon name="live" size={16} /> Canlı Maçlar</div>
              <p style={{ color: 'var(--muted)', margin: '8px 0 0' }}>Şu an canlı maç yok.</p>
            </div>
          </Item>
          <Item name="Player Card" code='class="player-card"'>
            <div className="player-card" style={{ maxWidth: 300 }}>
              <AvatarFrame src={demoAvatar} name="Ömer" size={44} />
              <div style={{ display: 'grid' }}>
                <strong>Ömer Özsoy</strong>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>1487 · 2.35 PR</span>
              </div>
            </div>
          </Item>
          <Item name="Premium / VIP Card" code='class="mem-card"'>
            <div className="mem-card" style={{ maxWidth: 300 }}>
              <div className="mem-card-head"><Icon name="crown" size={18} /> Premium</div>
              <p style={{ color: 'var(--muted)', margin: '8px 0' }}>Reklamsız · sınırsız analiz · özel çerçeveler.</p>
              <button className="galaxy-btn" style={{ width: '100%', justifyContent: 'center' }}>Yükselt</button>
            </div>
          </Item>
          <Item name="Stats / Profile Card" code='class="pp-card"'>
            <div className="pp-card" style={{ maxWidth: 300 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <AvatarFrame src={demoAvatar} name="Ömer" size={56} />
                <div>
                  <strong>Ömer</strong>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kazanma: %62 · 148 maç</div>
                </div>
              </div>
            </div>
          </Item>
          <Item name="Notification Card" code='class="notif-panel"'>
            <div className="notif-panel" style={{ maxWidth: 300 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="bell" size={16} /> <strong>Turnuva başladı</strong>
              </div>
              <p style={{ color: 'var(--muted)', margin: '6px 0 0', fontSize: 13 }}>Haftalık turnuva 2. tur eşleşmen hazır.</p>
            </div>
          </Item>
          <Item name="Invite Card" code='class="invite-card"'>
            <div className="invite-card" style={{ maxWidth: 300 }}>
              <strong>Oyun daveti</strong>
              <p style={{ color: 'var(--muted)', margin: '6px 0', fontSize: 13 }}>Kaan seni 5 puanlık maça davet etti.</p>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="galaxy-btn" style={{ padding: '6px 14px' }}>Kabul</button>
                <button className="btn-secondary" style={{ minHeight: 34 }}>Reddet</button>
              </span>
            </div>
          </Item>
          <Item name="Match Result Card" code='class="mr-card"'>
            <div className="mr-card" style={{ maxWidth: 300 }}>
              <h2>Maç Sonucu</h2>
              <p style={{ color: 'var(--muted)', margin: '4px 0' }}>Ömer <strong style={{ color: 'var(--text)' }}>7</strong> — <strong style={{ color: 'var(--text)' }}>4</strong> Kaan</p>
              <span className="sc-tag success">Kazandın · +12 puan</span>
            </div>
          </Item>
          <Item name="Tournament Card" code='class="tourn-card"'>
            <div className="tourn-card" style={{ maxWidth: 300 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="trophy" size={16} /> <strong>Haftalık Turnuva</strong></div>
              <p style={{ color: 'var(--muted)', margin: '6px 0', fontSize: 13 }}>16 oyuncu · 5 puan · Ödül 5.000 coin</p>
              <button className="galaxy-btn" style={{ padding: '6px 14px' }}>Katıl</button>
            </div>
          </Item>
          <Item name="Ranking Card" code='class="leaderboard-card"'>
            <div className="leaderboard-card" style={{ maxWidth: 300 }}>
              <div className="home-panel-head"><Icon name="chart" size={16} /> Liderlik</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span><span className="lb-rank top">1</span> Ömer</span>
                <span style={{ fontFamily: 'var(--tv-font-mono)' }}>2140</span>
              </div>
            </div>
          </Item>
        </Section>

        {/* 05 NAVIGATION */}
        <Section id="nav" title="05 · Navigation">
          <Item name="Sidebar (menu-btn)" code='class="game-menu" > .menu-btn'>
            <div className="game-menu" style={{ maxWidth: 220, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
              <button className="menu-btn"><Icon name="play" size={18} /> Tek Oyun</button>
              <button className="menu-btn" style={{ background: 'var(--rn-navy-muted)' }}><Icon name="dice" size={18} /> AI ile Oyna</button>
              <button className="menu-btn"><Icon name="trophy" size={18} /> Turnuvalar</button>
            </div>
          </Item>
          <Item name="Tabs" code='class="auth-tabs"'>
            <div className="auth-tabs">
              <button className="active">Giriş</button>
              <button>Kayıt</button>
            </div>
          </Item>
          <Item name="Segmented (rank-tabs)" code='class="rank-tabs"'>
            <div className="rank-tabs">
              <button className="active">Puan</button>
              <button>Coin</button>
              <button>WXP</button>
            </div>
          </Item>
          <Item name="Pagination" code='class="admin-pager"'>
            <div className="admin-pager">
              <button className="menu-btn" style={{ width: 'auto' }}><Icon name="chevron" size={14} /></button>
              <span style={{ padding: '0 10px', color: 'var(--muted)' }}>Sayfa 2 / 9</span>
              <button className="menu-btn" style={{ width: 'auto' }}><Icon name="chevron" size={14} /></button>
            </div>
          </Item>
          <Item name="Dropdown / User menu" code='class="lang-menu"'>
            <div className="lang-menu" style={{ position: 'static', maxWidth: 180 }}>
              <button className="active"><Icon name="user" size={15} /> Profil</button>
              <button><Icon name="settings" size={15} /> Ayarlar</button>
              <button><Icon name="logout" size={15} /> Çıkış</button>
            </div>
          </Item>
        </Section>

        {/* 06 FORMS */}
        <Section id="forms" title="06 · Forms">
          <Item name="Text Input" code='<input> (global :where net)'>
            <input placeholder="Takma isim" defaultValue="omer" />
          </Item>
          <Item name="Email Input" code='<input type="email">'>
            <input type="email" placeholder="ornek@eposta.com" />
          </Item>
          <Item name="Password + toggle" code='class="pw-field" + .pw-toggle'>
            <div className="pw-field">
              <input type="password" defaultValue="secret123" />
              <button className="pw-toggle" aria-label="Göster"><Icon name="eye" size={16} /></button>
            </div>
          </Item>
          <Item name="Search Input" code='<input type="search">'>
            <input type="search" placeholder="Oyuncu ara…" />
          </Item>
          <Item name="Textarea" code="<textarea>">
            <textarea rows={3} placeholder="Mesajın…" defaultValue="İyi oyunlar!" />
          </Item>
          <Item name="Select" code='class="lang-select"'>
            <select className="lang-select" defaultValue="5">
              <option value="1">1 Puan</option>
              <option value="5">5 Puan</option>
              <option value="7">7 Puan</option>
            </select>
          </Item>
          <Item name="Checkbox" code="<input type=checkbox>">
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> Beni hatırla
            </label>
          </Item>
          <Item name="Radio" code="<input type=radio>">
            <span style={{ display: 'inline-flex', gap: 14 }}>
              <label style={{ display: 'inline-flex', gap: 6 }}><input type="radio" name="r" checked={radio === 'a'} onChange={() => setRadio('a')} /> Beyaz</label>
              <label style={{ display: 'inline-flex', gap: 6 }}><input type="radio" name="r" checked={radio === 'b'} onChange={() => setRadio('b')} /> Siyah</label>
            </span>
          </Item>
          <Item name="Toggle / Switch" code='class="fg-switch"'>
            <button className="fg-switch" role="switch" aria-checked={toggle} onClick={() => setToggle((v) => !v)}>
              <span className={`fg-switch-track${toggle ? ' on' : ''}`}><span className="fg-switch-thumb" /></span>
            </button>
          </Item>
          <Item name="Slider" code='class="level-slider"'>
            <input className="level-slider" type="range" min={1} max={10} value={slider} onChange={(e) => setSlider(+e.target.value)} />
          </Item>
          <Item name="Date Input" code="<DatePicker />">
            <DatePicker value={date} onChange={setDate} placeholder="GG.AA.YYYY" />
          </Item>
          <Item name="Input · error" code=':invalid / .error'>
            <input defaultValue="ab" aria-invalid style={{ borderColor: 'var(--color-error)' }} />
          </Item>
          <Item name="Input · disabled" code="disabled">
            <input placeholder="Düzenlenemez" disabled />
          </Item>
        </Section>

        {/* 07 BADGES */}
        <Section id="badges" title="07 · Badges & Status">
          <Item name="Division / Rank" code="<DivisionChip rating />">
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <DivisionChip rating={1487} />
              <DivisionChip rating={2050} />
              <DivisionChip rating={900} />
            </span>
          </Item>
          <Item name="Coin chip" code='class="coin-chip"'>
            <span className="coin-chip"><Icon name="coin" size={14} /> 1.250</span>
          </Item>
          <Item name="PR chip" code='class="pr-chip"'>
            <span className="pr-chip">2.35 PR</span>
          </Item>
          <Item name="Premium / VIP" code='class="admin-badge"'>
            <span className="admin-badge" style={{ background: 'var(--gold)', color: 'var(--on-accent)' }}><Icon name="crown" size={13} /> Premium</span>
          </Item>
          <Item name="Rarity tiers" code="RARITY_COLORS">
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(Object.keys(RARITY_COLORS) as RarityKey[]).slice(0, 6).map((k) => (
                <span key={k} className="level-chip" style={{ color: RARITY_COLORS[k], borderColor: RARITY_COLORS[k] }}>{k}</span>
              ))}
            </span>
          </Item>
          <Item name="Status · online/offline" code=".sc-dot (muted emerald)">
            <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span className="sc-status"><span className="sc-dot on" /> Online</span>
              <span className="sc-status"><span className="sc-dot off" /> Çevrimdışı</span>
              <span className="sc-status"><span className="sc-dot play" /> Oynuyor</span>
              <span className="sc-status"><span className="sc-dot wait" /> Bekliyor</span>
            </span>
          </Item>
          <Item name="Semantic tags" code=".sc-tag variants">
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="sc-tag success">Kazandı</span>
              <span className="sc-tag warning">Uyarı</span>
              <span className="sc-tag danger">Kaybetti</span>
              <span className="sc-tag info">Bilgi</span>
              <span className="sc-tag gold"><Icon name="trophy" size={12} /> Şampiyon</span>
            </span>
          </Item>
          <Item name="Notification badge" code='class="notif-badge"'>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <button className="menu-btn" style={{ width: 'auto' }} aria-label="Bildirimler"><Icon name="bell" size={18} /></button>
              <span className="notif-badge">3</span>
            </span>
          </Item>
        </Section>

        {/* 08 TABLES */}
        <Section id="tables" title="08 · Tables">
          <Item name="Leaderboard" code='class="lb-table" > .lb-row (top-3 gold)'>
            <table className="lb-table" style={{ minWidth: 360 }}>
              <thead><tr><th>#</th><th>Oyuncu</th><th>Puan</th><th>Durum</th></tr></thead>
              <tbody>
                {[
                  [1, 'Ömer', 2140, 'on'],
                  [2, 'Kaan', 2015, 'play'],
                  [3, 'Deniz', 1980, 'off'],
                  [4, 'Ece', 1720, 'on'],
                ].map(([r, n, p, s], i) => (
                  <tr key={i} className={`lb-row${i === 0 ? ' selected' : ''}`}>
                    <td><span className={`lb-rank${(r as number) <= 3 ? ' top' : ''}`}>{r as number}</span></td>
                    <td>{n as string}</td>
                    <td style={{ fontFamily: 'var(--tv-font-mono)' }}>{p as number}</td>
                    <td><span className={`sc-dot ${s as string}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Item>
          <Item name="Match history" code='class="mh-table" > .mh-row'>
            <table className="mh-table" style={{ minWidth: 320 }}>
              <thead><tr><th>Rakip</th><th>Sonuç</th><th>PR</th></tr></thead>
              <tbody>
                <tr className="mh-row"><td>Kaan</td><td><span className="sc-tag success">7–4</span></td><td>2.1</td></tr>
                <tr className="mh-row"><td>Deniz</td><td><span className="sc-tag danger">3–7</span></td><td>4.8</td></tr>
              </tbody>
            </table>
          </Item>
          <div className="sc-note">Satır hover · seçili satır (1. sıra) · top-3 gold rank canlıdır.</div>
        </Section>

        {/* 09 MODALS */}
        <Section id="modals" title="09 · Modals & Overlays">
          <Item name="Basic Modal" code="overlay + .sc-modal">
            <button className="btn-secondary" onClick={() => setModal('basic')}>Aç: Basic</button>
          </Item>
          <Item name="Confirmation" code="onay modalı">
            <button className="btn-secondary" onClick={() => setModal('confirm')}>Aç: Onay</button>
          </Item>
          <Item name="Danger Confirmation" code="tehlike onayı">
            <button className="danger-btn" onClick={() => setModal('danger')}>Aç: Tehlike</button>
          </Item>
          <Item name="Premium Modal" code="premium">
            <button className="galaxy-btn" onClick={() => setModal('premium')}>Aç: Premium</button>
          </Item>
          <Item name="Toast · success" code="useToast().success()">
            <button className="btn-secondary" onClick={() => toast.success('Kaydedildi.')}>Toast: başarı</button>
          </Item>
          <Item name="Toast · error" code="useToast().error()">
            <button className="btn-secondary" onClick={() => toast.error('Bir hata oluştu.')}>Toast: hata</button>
          </Item>
          <Item name="Toast · info" code="useToast().info()">
            <button className="btn-secondary" onClick={() => toast.info('Turnuva 5 dk sonra.')}>Toast: bilgi</button>
          </Item>
          <Item name="Tooltip" code="title / .sc-tooltip">
            <span className="sc-tooltip" data-tip="Performans Reytingi (düşük iyi)">PR nedir? <Icon name="bulb" size={14} /></span>
          </Item>
        </Section>

        {/* 10 GAME COMPONENTS */}
        <Section id="game" title="10 · Game Components">
          <Item name="Player panel" code='class="player-card" (oyun)'>
            <div className="player-card" style={{ maxWidth: 280 }}>
              <AvatarFrame src={demoAvatar} name="Ömer" size={40} />
              <div style={{ display: 'grid' }}>
                <strong>Ömer</strong>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>1487 · beyaz</span>
              </div>
              <span className="score-badge" style={{ marginLeft: 'auto' }}>3</span>
            </div>
          </Item>
          <Item name="Match score" code='class="score-badge"'>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="score-badge">3</span><span style={{ color: 'var(--muted)' }}>/ 5</span><span className="score-badge">2</span>
            </span>
          </Item>
          <Item name="Timer / Clock" code=".sc-clock (ClockStack stili)">
            <span className="sc-clock" style={{ fontFamily: 'var(--tv-font-mono)' }}>02:14</span>
          </Item>
          <Item name="Cube control" code=".sc-cube">
            <span style={{ display: 'flex', gap: 10 }}>
              <span className="sc-cube">64</span>
              <span className="sc-cube gold">2</span>
            </span>
          </Item>
          <Item name="Double / Take / Pass" code="galaxy-btn / btn-secondary / danger-btn">
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="galaxy-btn" style={{ padding: '6px 14px' }}>Double</button>
              <button className="btn-secondary" style={{ minHeight: 34 }}>Take</button>
              <button className="danger-btn">Pass</button>
            </span>
          </Item>
          <Item name="Resign / Undo" code='class="resign-btn" / menu-btn'>
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="menu-btn resign-btn" style={{ width: 'auto' }}><Icon name="flag" size={15} /> Terk</button>
              <button className="menu-btn" style={{ width: 'auto' }}><Icon name="refresh" size={15} /> Geri Al</button>
            </span>
          </Item>
          <Item name="Match length selector" code='class="target-chip"'>
            <span style={{ display: 'flex', gap: 6 }}>
              {[1, 3, 5, 7].map((n) => (
                <button key={n} className={`target-chip${n === 5 ? ' active' : ''}`}>{n}</button>
              ))}
            </span>
          </Item>
          <Item name="Stake / Entry selector" code='class="setup-tile"'>
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="setup-tile">100</button>
              <button className="setup-tile active">500</button>
              <button className="setup-tile">1000</button>
            </span>
          </Item>
          <Item name="Spectator badge" code=".sc-tag info">
            <span className="sc-tag info"><Icon name="eye" size={12} /> 12 izleyici</span>
          </Item>
        </Section>

        {/* 11 PROFILE COMPONENTS */}
        <Section id="profile" title="11 · Profile Components">
          <Item name="Avatar (frame'siz)" code="<AvatarFrame />">
            <span style={{ display: 'flex', gap: 12 }}>
              <AvatarFrame src={demoAvatar} name="Ömer" size={56} />
              <AvatarFrame src={null} name="Kaan" size={56} />
            </span>
          </Item>
          <Item name="Avatar + frame (rarity)" code='<AvatarFrame frame="…" />'>
            <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {frames.map((f) => (
                <span key={f.id} style={{ textAlign: 'center' }}>
                  <AvatarFrame src={demoAvatar} name="Ö" size={56} frame={f.id} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{f.rarity}</div>
                </span>
              ))}
            </span>
          </Item>
          <Item name="Logo / Mark" code="<TavlaTvLogo /> · <TavlaTvMark />">
            <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <TavlaTvLogo size={26} />
              <TavlaTvMark size={40} />
            </span>
          </Item>
          <Item name="Rating / PR / WXP" code="score-badge · pr-chip · coin-chip">
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pr-chip">1487 puan</span>
              <span className="pr-chip">2.35 PR</span>
              <span className="coin-chip"><Icon name="star" size={13} /> 8.4k WXP</span>
            </span>
          </Item>
          <Item name="Win rate / Stats" code=".sc-stat">
            <span style={{ display: 'flex', gap: 18 }}>
              <span className="sc-stat"><strong>%62</strong><span>Kazanma</span></span>
              <span className="sc-stat"><strong>148</strong><span>Maç</span></span>
              <span className="sc-stat"><strong>2.4</strong><span>Ort. PR</span></span>
            </span>
          </Item>
          <Item name="Badge collection" code="<BadgeList ids />">
            <BadgeList ids={['first_win', 'streak_5', 'tourney_win']} />
          </Item>
          <Item name="Follow / Friend" code='class="friend-btn"'>
            <span style={{ display: 'flex', gap: 8 }}>
              <button className="friend-btn"><Icon name="users" size={15} /> Arkadaş Ekle</button>
            </span>
          </Item>
        </Section>

        {/* 12 SPACING / RADIUS / SHADOW */}
        <Section id="tokens" title="12 · Spacing · Radius · Shadow">
          <Item name="Spacing scale" code="--space-1 … --space-10">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {SPACE.map((s) => (
                <div key={s} style={{ textAlign: 'center' }}>
                  <div style={{ width: `var(${s})`, height: `var(${s})`, background: 'var(--gold)', borderRadius: 3 }} />
                  <code style={{ fontSize: 10, color: 'var(--muted)' }}>{s.replace('--space-', '')}</code>
                </div>
              ))}
            </div>
          </Item>
          <Item name="Radius scale" code="--radius-xs … --radius-pill">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {RADII.map((r) => (
                <div key={r} style={{ textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, background: 'var(--rn-navy-muted)', border: '1px solid var(--border)', borderRadius: `var(${r})` }} />
                  <code style={{ fontSize: 10, color: 'var(--muted)' }}>{r.replace('--radius-', '')}</code>
                </div>
              ))}
            </div>
          </Item>
          <Item name="Border & flat" code="--shadow-* = none (flat)">
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 90, height: 52, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10 }} />
              <span style={{ color: 'var(--muted)', fontSize: 13, alignSelf: 'center' }}>Flat: derinlik 1px border + boşlukla verilir (gölge yok).</span>
            </div>
          </Item>
        </Section>

        {/* 13 ICONS — tum ikon seti (Icon.tsx / Lucide tarzi inline SVG) */}
        <section id="icons" className="sc-section">
          <h2 className="sc-section-title">13 · Icons — {ICON_NAMES.length} adet</h2>
          <p className="sc-note" style={{ marginTop: 0 }}>
            Tek ikon seti: <code>src/ui/Icon.tsx</code> — Lucide tarzı inline SVG, stroke 1.75,{' '}
            <code>currentColor</code>. Kullanım: <code>&lt;Icon name="…" size={'{20}'} /&gt;</code>.
            Bir ikona tıkla → kullanım kodu panoya kopyalanır.
          </p>
          <div className="sc-icons-grid">
            {ICON_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                className="sc-icon-cell"
                title={`<Icon name="${n}" />  ·  kopyalamak için tıkla`}
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(`<Icon name="${n}" size={20} />`)
                    .then(() => toast.show(`Kopyalandı: <Icon name="${n}" />`, 'success'))
                    .catch(() => toast.show('Kopyalanamadı', 'error'))
                }}
              >
                <Icon name={n} size={22} />
                <code className="sc-icon-name">{n}</code>
              </button>
            ))}
          </div>
        </section>

        {/* 14 PLAYER RANKS — 20 kademe, aile aile. compact/standard/featured */}
        <section id="ranks" className="sc-section">
          <h2 className="sc-section-title">14 · Player Ranks — {RANKS.length} kademe</h2>
          <p className="sc-note" style={{ marginTop: 0 }}>
            Rütbe sistemi: <code>src/ranks.ts</code> (tek konfig) + <code>&lt;RankBadge/&gt;</code>.
            İkonlar SADECE Phosphor. Renkler <code>--rank-*</code> token'ları. Rütbe yükseldikçe
            kontrast/weight kontrollü artar. Kullanım:{' '}
            <code>&lt;RankBadge rating={'{1550}'} variant="standard" /&gt;</code>.
          </p>
          <div className="sc-rank-list">
            <div className="sc-rank-head">
              <span>Eşik</span>
              <span>Phosphor ikon</span>
              <span>Compact</span>
              <span>Standard</span>
              <span>Featured</span>
            </div>
            {RANKS.map((r) => (
              <div className="sc-rank-row" key={r.divKey} data-family={r.family}>
                <span className="sc-rank-th">{r.min}+</span>
                <code className="sc-rank-icon">
                  {r.iconName}
                  <span className="sc-rank-weight">{r.weight}</span>
                </code>
                <span className="sc-rank-cell">
                  <RankBadge rank={r.family} level={r.code} variant="compact" />
                </span>
                <span className="sc-rank-cell">
                  <RankBadge rank={r.family} level={r.code} variant="standard" />
                </span>
                <span className="sc-rank-cell">
                  <RankBadge rank={r.family} level={r.code} variant="featured" />
                </span>
              </div>
            ))}
          </div>
          <p className="sc-note">
            Not: Grandmaster <strong>G0</strong> için brief'te istenen <code>LaurelWreath</code>{' '}
            Phosphor pakedinde yok → en yakın semantik <code>Certificate</code> (tevcih edilmiş onur)
            kullanıldı. Zirve <strong>S1</strong> yalnızca featured'da çok hafif statik highlight alır.
          </p>
        </section>

        <footer className="sc-footer">
          TavlaTV Design System · Coastal Club · Gerçek componentler — dev/admin harness (production'a dahil değil).
        </footer>
      </main>

      {/* ---- Modaller ---- */}
      {modal && (
        <div className="sc-overlay" onClick={() => setModal(null)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="sc-modal-x" onClick={() => setModal(null)} aria-label="Kapat"><Icon name="x" size={16} /></button>
            {modal === 'basic' && (<><h3>Bilgi</h3><p>Bu temel bir modal örneğidir. Porcelain yüzey + ince Coastal detay.</p><button className="galaxy-btn" onClick={() => setModal(null)}>Tamam</button></>)}
            {modal === 'confirm' && (<><h3>Emin misin?</h3><p>Bu işlemi onaylıyor musun?</p><div style={{ display: 'flex', gap: 8 }}><button className="galaxy-btn" onClick={() => setModal(null)}>Onayla</button><button className="btn-secondary" onClick={() => setModal(null)}>Vazgeç</button></div></>)}
            {modal === 'danger' && (<><h3 style={{ color: 'var(--danger-fg)' }}>Hesabı sil</h3><p>Bu işlem geri alınamaz.</p><div style={{ display: 'flex', gap: 8 }}><button className="danger-btn" onClick={() => setModal(null)}>Evet, sil</button><button className="btn-secondary" onClick={() => setModal(null)}>Vazgeç</button></div></>)}
            {modal === 'premium' && (<><h3><Icon name="crown" size={18} /> Premium</h3><p>Reklamsız oyun, sınırsız analiz ve özel çerçeveler.</p><button className="galaxy-btn" onClick={() => setModal(null)}>Yükselt</button></>)}
          </div>
        </div>
      )}

      <style>{SC_CSS}</style>
    </div>
  )
}

// Showcase'e OZEL duzen CSS'i (component kopyasi DEGIL; yalnizca sayfa iskeleti,
// swatch/grid/sticky-nav + gercek componentlerin olmadigi kucuk gostergeler:
// durum noktalari, cube/clock/tag/stat mini gostergeleri).
const SC_CSS = `
.sc-root{min-height:100vh;background:var(--bg);color:var(--text);font-family:var(--tv-font-ui)}
.sc-topbar{position:sticky;top:0;z-index:50;display:flex;flex-direction:column;gap:8px;
  background:color-mix(in srgb,var(--rn-bg) 88%,transparent);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--gold);padding:12px 20px}
.sc-brand{display:flex;align-items:center;gap:12px}
.sc-brand-sub{color:var(--muted);font-size:13px;letter-spacing:.04em}
.sc-nav{display:flex;gap:4px;flex-wrap:wrap}
.sc-nav-link{color:var(--muted);text-decoration:none;font-size:12.5px;font-weight:600;
  padding:5px 10px;border-radius:var(--radius-pill);border:1px solid transparent}
.sc-nav-link:hover{color:var(--text);border-color:var(--border);background:var(--rn-navy)}
.sc-main{max-width:1080px;margin:0 auto;padding:28px 20px 80px}
.sc-hero{padding:24px 0 8px}
.sc-hero-title{font-family:var(--tv-font-display);font-size:clamp(2rem,5vw,3rem);margin:0 0 10px;color:var(--text)}
.sc-hero-sub{color:var(--muted);max-width:70ch;line-height:1.6}
.sc-hero-sub code{color:var(--gold);background:var(--rn-navy);padding:1px 6px;border-radius:5px;font-size:.85em}
.sc-section{margin-top:44px;scroll-margin-top:120px}
.sc-section-title{font-family:var(--tv-font-display);font-size:1.5rem;color:var(--text);
  padding-bottom:10px;margin:0 0 20px;border-bottom:1px solid var(--gold)}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.sc-item{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-lg);
  padding:16px;display:flex;flex-direction:column;gap:12px}
.sc-item-demo{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-height:44px}
.sc-item-meta{display:flex;flex-direction:column;gap:3px;border-top:1px solid var(--border);padding-top:8px}
.sc-item-name{font-weight:600;font-size:13px;color:var(--text)}
.sc-item-code{font-family:var(--tv-font-mono);font-size:11.5px;color:var(--gold);word-break:break-word}
.sc-note{grid-column:1/-1;color:var(--muted);font-size:13px;font-style:italic;margin-top:4px}
/* swatches */
.sc-swatches{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.sc-swatch{display:flex;gap:12px;align-items:center;background:var(--card-bg);border:1px solid var(--border);
  border-radius:var(--radius-md);padding:10px}
.sc-swatch-chip{width:44px;height:44px;border-radius:var(--radius-sm);border:1px solid var(--rn-line);flex:none}
.sc-swatch-info{display:flex;flex-direction:column;gap:1px;min-width:0}
.sc-swatch-info strong{font-size:13px}
.sc-swatch-info code{font-family:var(--tv-font-mono);font-size:11px;color:var(--muted)}
.sc-swatch-info span{font-size:11px;color:var(--muted)}
/* typography samples */
.sc-typo{grid-column:1/-1;display:flex;flex-direction:column;gap:14px}
.sc-typo-row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;
  border-bottom:1px dashed var(--border);padding-bottom:12px}
.sc-t-display{font-family:var(--tv-font-display);font-size:2.6rem;font-weight:800;line-height:1.05}
.sc-t-h1{font-family:var(--tv-font-display);font-size:var(--fs-3xl);font-weight:700}
.sc-t-h2{font-family:var(--tv-font-display);font-size:var(--fs-2xl);font-weight:700}
.sc-t-h3{font-family:var(--tv-font-display);font-size:var(--fs-xl);font-weight:600}
.sc-t-h4{font-family:var(--tv-font-display);font-size:var(--fs-lg);font-weight:600}
.sc-t-body{font-size:var(--fs-md);line-height:1.6;max-width:60ch}
.sc-t-small{font-size:var(--fs-sm);color:var(--text)}
.sc-t-caption{font-size:var(--fs-xs);color:var(--muted)}
.sc-t-btn{font-size:var(--fs-md);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.sc-t-num{font-family:var(--tv-font-mono);font-size:1.6rem;font-weight:500;color:var(--gold)}
/* mini gostergeler */
.sc-spin{width:15px;height:15px;border:2px solid color-mix(in srgb,var(--on-accent) 40%,transparent);
  border-top-color:var(--on-accent);border-radius:50%;display:inline-block;animation:sc-rot .7s linear infinite}
@keyframes sc-rot{to{transform:rotate(360deg)}}
.sc-status{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--text)}
.sc-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
.sc-dot.on{background:var(--color-success)}
.sc-dot.off{background:var(--rn-muted)}
.sc-dot.play{background:var(--gold)}
.sc-dot.wait{background:var(--color-warning)}
.sc-tag{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
  padding:3px 10px;border-radius:var(--radius-pill);border:1px solid}
.sc-tag.success{color:var(--success-fg);border-color:var(--color-success);background:color-mix(in srgb,var(--color-success) 14%,transparent)}
.sc-tag.warning{color:var(--color-warning);border-color:var(--color-warning);background:color-mix(in srgb,var(--color-warning) 14%,transparent)}
.sc-tag.danger{color:var(--danger-fg);border-color:var(--color-error);background:color-mix(in srgb,var(--color-error) 14%,transparent)}
.sc-tag.info{color:var(--color-info);border-color:var(--color-info);background:color-mix(in srgb,var(--color-info) 14%,transparent)}
.sc-tag.gold{color:var(--on-accent);background:var(--gold);border-color:var(--gold)}
.sc-clock{background:var(--rn-navy-muted);border:1px solid var(--border);border-radius:var(--radius-md);
  padding:6px 12px;font-size:18px;font-weight:600;letter-spacing:.05em}
.sc-cube{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;
  background:var(--ivory);color:var(--rn-bg);border-radius:var(--radius-sm);font-weight:800;font-size:18px}
.sc-cube.gold{background:var(--gold);color:var(--on-accent)}
.sc-stat{display:inline-flex;flex-direction:column}
.sc-stat strong{font-family:var(--tv-font-mono);font-size:20px;color:var(--gold)}
.sc-stat span{font-size:11px;color:var(--muted)}
.sc-tooltip{position:relative;display:inline-flex;align-items:center;gap:6px;color:var(--text);cursor:help;
  border-bottom:1px dotted var(--gold)}
.sc-tooltip::after{content:attr(data-tip);position:absolute;bottom:130%;left:0;white-space:nowrap;
  background:var(--rn-navy);color:var(--text);border:1px solid var(--gold);border-radius:8px;
  padding:6px 10px;font-size:12px;opacity:0;pointer-events:none;transition:opacity .15s}
.sc-tooltip:hover::after{opacity:1}
/* overlay + modal */
.sc-overlay{position:fixed;inset:0;z-index:100;background:color-mix(in srgb,var(--rn-bg) 82%,transparent);
  display:flex;align-items:center;justify-content:center;padding:20px}
.sc-modal{position:relative;background:var(--card-bg);border:1px solid var(--rn-line);border-top:2px solid var(--gold);
  border-radius:var(--radius-xl);padding:26px;max-width:400px;width:100%;display:flex;flex-direction:column;gap:12px}
.sc-modal h3{font-family:var(--tv-font-display);margin:0}
.sc-modal p{color:var(--muted);margin:0;line-height:1.55}
.sc-modal-x{position:absolute;top:12px;right:12px;background:transparent;border:none;color:var(--muted);cursor:pointer}
.sc-footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:12.5px;text-align:center}
/* icons gallery */
.sc-icons-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.sc-icon-cell{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 8px;
  background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-md);
  color:var(--text);cursor:pointer;transition:border-color .15s,transform .15s,color .15s}
.sc-icon-cell:hover{border-color:var(--gold);color:var(--gold);transform:translateY(-2px)}
.sc-icon-name{font-family:var(--tv-font-mono);font-size:11px;color:var(--muted);word-break:break-word;text-align:center}
.sc-icon-cell:hover .sc-icon-name{color:var(--text)}
`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <ToastProvider>
        <Showcase />
      </ToastProvider>
    </LangProvider>
  </StrictMode>,
)
