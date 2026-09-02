import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import { listContents, type Content, type ContentType } from '../api'
import TurkeyMap, { normProvince } from './TurkeyMap'
import { CountryFlag } from './Flag'

const HEAD: Record<ContentType, { icon: IconName; titleKey: string }> = {
  service: { icon: 'star', titleKey: 'menu.services' },
  blog: { icon: 'book', titleKey: 'menu.blog' },
  news: { icon: 'chat', titleKey: 'menu.news' },
  event: { icon: 'calendar', titleKey: 'menu.calendar' },
  club: { icon: 'pin', titleKey: 'menu.clubs' },
  ad: { icon: 'star', titleKey: 'menu.services' }, // reklamlar ContentView'de gosterilmez
  quiz: { icon: 'book', titleKey: 'menu.quiz' }, // quiz QuizPlay ile oynatilir
  magazine: { icon: 'play', titleKey: 'menu.magazine' }, // Tavla Magazin (YouTube videolari)
  kurum: { icon: 'pin', titleKey: 'menu.clubs' }, // Kurumlar ContentView'de gosterilmez (turnuva duzenleyeni)
  otel: { icon: 'building-office', titleKey: 'menu.calendar' }, // Oteller ContentView'de gosterilmez (etkinlik mekani)
}

const paras = (body?: string | null) =>
  (body ?? '')
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter(Boolean)

function fmtDate(s?: string | null, withTime = false): string {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
const monthKey = (s?: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

// Baslik -> URL slug (Turkce karakter donusumlu). Detay linkleri + eslestirme icin.
const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
}
export function slugify(s: string): string {
  return s
    .replace(/[çğıöşüİÇĞÖŞÜ]/g, (c) => TR_MAP[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function ContentView({
  type,
  onClose,
  slug = null,
  onOpenDetail,
  onCloseDetail,
  embed = false,
}: {
  type: ContentType
  onClose: () => void
  slug?: string | null
  onOpenDetail?: (slug: string) => void
  onCloseDetail?: () => void
  embed?: boolean // Bilgi sayfasi sekmesine gomulu (overlay/kart/kapat/baslik yok)
}) {
  const { t } = useT()
  const [items, setItems] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  // Haber detayi acik mi (slug bir habere denk geliyorsa)
  const newsItem =
    type === 'news' && slug ? (items.find((i) => slugify(i.title) === slug) ?? null) : null
  // Detaydaki tum gorseller (kapak + galeri) - lightbox bunlar arasinda gezer
  const detailImgs = newsItem
    ? [newsItem.image, ...(newsItem.gallery ?? [])].filter((x): x is string => !!x)
    : []
  const [lightbox, setLightbox] = useState<number | null>(null) // acik gorsel indeksi
  const [playVideo, setPlayVideo] = useState<string | null>(null) // oynatilan YouTube video id
  // Esc onceligi: once video oynatici/lightbox, sonra detaydan listeye, sonra sayfayi kapat
  useEscape(
    playVideo
      ? () => setPlayVideo(null)
      : lightbox !== null
        ? () => setLightbox(null)
        : newsItem && onCloseDetail
          ? onCloseDetail
          : onClose,
  )

  const load = () => {
    setLoading(true)
    setError(false)
    listContents(type)
      .then(setItems)
      .catch(() => setError(true)) // sessizce yutma: ag hatasi "bos icerik" gibi gorunmesin
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  // Takvim (etkinlik): kurum -> logo eslemesi. organizer adi = kurum basligi.
  // Logosu olan kurumun logosu etkinlik satirinda en basa konur; logosu yoksa hic konmaz.
  const [kurumLogos, setKurumLogos] = useState<Record<string, string>>({})
  useEffect(() => {
    if (type !== 'event') return
    listContents('kurum')
      .then((ks) => {
        const map: Record<string, string> = {}
        for (const k of ks) if (k.title && k.image) map[k.title] = k.image
        setKurumLogos(map)
      })
      .catch(() => {})
  }, [type])

  // Takvim (etkinlik): otel adi -> otel bilgisi (gorsel + adres). hotel adi = otel basligi.
  // Resimler otel kaydina yuklenir; etkinlik takviminde secili otelin gorseli gosterilir.
  const [hotels, setHotels] = useState<
    Record<string, { image?: string; place?: string; province?: string; country?: string; maps?: string }>
  >({})
  useEffect(() => {
    if (type !== 'event') return
    listContents('otel')
      .then((hs) => {
        const map: Record<string, { image?: string; place?: string; province?: string; country?: string; maps?: string }> = {}
        for (const h of hs)
          if (h.title)
            map[h.title] = {
              image: h.image ?? undefined,
              place: h.place ?? undefined,
              province: h.province ?? undefined,
              country: h.country ?? undefined,
              maps: h.links?.maps ?? undefined,
            }
        setHotels(map)
      })
      .catch(() => {})
  }, [type])

  // Magazin: videolari seriye gore grupla (organizer), playlist sirasi korunur
  const magSections = useMemo(() => {
    if (type !== 'magazine') return [] as [string, Content[]][]
    const groups: [string, Content[]][] = []
    for (const it of items) {
      const key = it.organizer || 'Videolar'
      let g = groups.find((x) => x[0] === key)
      if (!g) {
        g = [key, []]
        groups.push(g)
      }
      g[1].push(it)
    }
    return groups
  }, [items, type])

  const head = HEAD[type]

  // Etkinlik: yaklasan / gecmis ayrimi + aya gore grupla
  const eventGroups = useMemo(() => {
    if (type !== 'event') return null
    const now = Date.now()
    const upcoming = items.filter((i) => new Date(i.event_at ?? 0).getTime() >= now)
    const past = items
      .filter((i) => new Date(i.event_at ?? 0).getTime() < now)
      .sort((a, b) => new Date(b.event_at ?? 0).getTime() - new Date(a.event_at ?? 0).getTime())
    const byMonth: { month: string; list: Content[] }[] = []
    for (const ev of upcoming) {
      const m = monthKey(ev.event_at)
      const g = byMonth.find((x) => x.month === m)
      if (g) g.list.push(ev)
      else byMonth.push({ month: m, list: [ev] })
    }
    return { byMonth, past }
  }, [items, type])

  // Kulup: ile gore grupla
  const clubGroups = useMemo(() => {
    if (type !== 'club') return null
    const map: Record<string, Content[]> = {}
    for (const c of items) {
      const p = (c.province || '—').trim()
      ;(map[p] ||= []).push(c)
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [items, type])

  // Harita için il-başına kulüp sayısı (normalize anahtar). Seçili il (harita/filtre).
  const clubCounts = useMemo(() => {
    const m: Record<string, number> = {}
    if (clubGroups)
      for (const [prov, list] of clubGroups) {
        const k = normProvince(prov)
        m[k] = (m[k] ?? 0) + list.length
      }
    return m
  }, [clubGroups])
  // Harita balonu için il-başına kulüp adları (normalize anahtar)
  const clubNames = useMemo(() => {
    const m: Record<string, string[]> = {}
    if (clubGroups)
      for (const [prov, list] of clubGroups) {
        const k = normProvince(prov)
        ;(m[k] ||= []).push(...list.map((c) => c.title))
      }
    return m
  }, [clubGroups])
  const [selProvince, setSelProvince] = useState<string | null>(null)

  // Bilgi sayfasi "Hizmetler" sekmesi: overlay/kart/baslik olmadan yalniz liste.
  if (embed) {
    return (
      <div className="content-embed">
        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : error ? (
          <div className="admin-empty">
            {t('common.loadError')}{' '}
            <Button variant="outline" onClick={load}>
              {t('common.retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="admin-empty">{t('content.empty')}</div>
        ) : (
          <div className="content-services">
            {items.map((s) => (
              <section key={s.id} className="content-service">
                <h3>{s.title}</h3>
                {paras(s.body).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div
        className={`register-card content-card${
          (type === 'news' && !newsItem) || type === 'magazine' ? ' content-card-wide' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name={head.icon} size={20} /> {t(head.titleKey)}
        </h2>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : error ? (
          <div className="admin-empty">
            {t('common.loadError')}{' '}
            <Button variant="outline" onClick={load}>
              {t('common.retry')}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="admin-empty">{t('content.empty')}</div>
        ) : type === 'service' ? (
          <div className="content-services">
            {items.map((s) => (
              <section key={s.id} className="content-service">
                <h3>{s.title}</h3>
                {paras(s.body).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </section>
            ))}
          </div>
        ) : type === 'news' ? (
          newsItem ? (
            <NewsDetail
              item={newsItem}
              onBack={onCloseDetail ?? onClose}
              backLabel={t(head.titleKey)}
              onOpenImage={setLightbox}
            />
          ) : (
            <div className="news-grid">
              {items.map((p) => (
                <button
                  key={p.id}
                  className="news-card"
                  onClick={() => onOpenDetail?.(slugify(p.title))}
                >
                  {p.image && (
                    <img className="news-card-img" src={p.image} alt="" loading="lazy" />
                  )}
                  <div className="news-card-info">
                    <span className="news-card-title">{p.title}</span>
                    <span className="news-card-date">{fmtDate(p.event_at ?? null)}</span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : type === 'magazine' ? (
          <div className="mag-sections">
            {magSections.map(([section, vids]) => (
              <section key={section} className="mag-section">
                <h3 className="mag-section-title">
                  {section}
                  <span className="mag-section-count">{vids.length}</span>
                </h3>
                <div className="mag-grid">
                  {vids.map((v) => (
                    <button
                      key={v.id}
                      className="mag-card"
                      onClick={() => v.video_id && setPlayVideo(v.video_id)}
                    >
                      <div className="mag-thumb">
                        {v.image && <img src={v.image} alt="" loading="lazy" />}
                        <span className="mag-play">
                          <Icon name="play" size={22} />
                        </span>
                      </div>
                      <div className="mag-info">
                        <span className="mag-title">{v.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : type === 'blog' ? (
          <div className="content-posts">
            {items.map((p) => {
              const open = openId === p.id
              return (
                <article key={p.id} className={`content-post ${open ? 'open' : ''}`}>
                  <button className="content-post-head" onClick={() => setOpenId(open ? null : p.id)}>
                    <span className="cp-title">{p.title}</span>
                    <span className="cp-date">{fmtDate(p.event_at ?? null)}</span>
                  </button>
                  {open && (
                    <div className="content-post-body">
                      {p.image && <img className="content-img" src={p.image} alt="" />}
                      {paras(p.body).map((x, i) => (
                        <p key={i}>{x}</p>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : type === 'event' && eventGroups ? (
          <div className="content-events">
            {eventGroups.byMonth.length === 0 && (
              <div className="admin-empty small">{t('content.noUpcoming')}</div>
            )}
            {eventGroups.byMonth.map((g) => (
              <div key={g.month} className="event-month">
                <div className="event-month-title">{g.month}</div>
                {g.list.map((ev) => (
                  <EventRow key={ev.id} ev={ev} upcoming logo={kurumLogos[ev.organizer ?? '']} hotel={hotels[ev.hotel ?? '']} />
                ))}
              </div>
            ))}
            {eventGroups.past.length > 0 && (
              <div className="event-past">
                <div className="event-month-title past">{t('content.past')}</div>
                {eventGroups.past.map((ev) => (
                  <EventRow key={ev.id} ev={ev} upcoming={false} logo={kurumLogos[ev.organizer ?? '']} hotel={hotels[ev.hotel ?? '']} />
                ))}
              </div>
            )}
          </div>
        ) : type === 'club' && clubGroups ? (
          <div className="content-clubs">
            <TurkeyMap
              clubCounts={clubCounts}
              clubNames={clubNames}
              selected={selProvince}
              onSelect={setSelProvince}
              countLabel={(n) => t('clubs.count', { n })}
            />
            {selProvince && (
              <div className="club-filter-bar">
                <span className="club-filter-cur">
                  <Icon name="pin" size={14} /> {selProvince}
                </span>
                <Button variant="ghost" className="club-filter-clear" onClick={() => setSelProvince(null)}>
                  <Icon name="x" size={14} /> {t('clubs.showAll')}
                </Button>
              </div>
            )}
            {clubGroups
              .filter(([prov]) => !selProvince || normProvince(prov) === normProvince(selProvince))
              .map(([prov, list]) => (
              <div key={prov} className="club-province">
                <div className="club-province-title">
                  <Icon name="pin" size={14} /> {prov}
                </div>
                {list.map((c) => (
                  <div key={c.id} className="club-row">
                    <div className="club-row-head">
                      {c.image ? (
                        <img className="club-logo" src={mediaSrc(c.image)} alt="" loading="lazy" />
                      ) : (
                        <div className="club-logo club-logo-ph">
                          {c.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="club-row-head-text">
                        <span className="club-name">{c.title}</span>
                        {(c.contacts ?? [])
                          .filter((p) => p && (p.name || p.phone))
                          .map((p, i) => (
                            <span key={i} className="club-person">
                              <Icon name="phone" size={12} /> {p.name}
                              {p.name && p.phone ? ' · ' : ''}
                              {p.phone}
                            </span>
                          ))}
                        {c.contact && !c.contacts?.length && (
                          <span className="club-person">
                            <Icon name="phone" size={12} /> {c.contact}
                          </span>
                        )}
                        {(c.links?.website || c.links?.instagram || c.links?.youtube || c.links?.email) && (
                          <div className="club-links">
                            {c.links?.email && (
                              <a
                                className="club-link"
                                href={`mailto:${c.links.email}`}
                                aria-label="E-posta"
                              >
                                <Icon name="mail" size={18} />
                              </a>
                            )}
                            {c.links?.website && (
                              <a
                                className="club-link"
                                href={c.links.website}
                                target="_blank"
                                rel="noreferrer noopener"
                                aria-label="Web sitesi"
                              >
                                <Icon name="globe" size={18} />
                              </a>
                            )}
                            {c.links?.instagram && (
                              <a
                                className="club-link ig"
                                href={c.links.instagram}
                                target="_blank"
                                rel="noreferrer noopener"
                                aria-label="Instagram"
                              >
                                <Icon name="instagram" size={18} />
                              </a>
                            )}
                            {c.links?.youtube && (
                              <a
                                className="club-link yt"
                                href={c.links.youtube}
                                target="_blank"
                                rel="noreferrer noopener"
                                aria-label="YouTube"
                              >
                                <Icon name="youtube" size={18} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {c.place && (
                      <div className="club-row-meta">
                        <span className="club-addr">{c.place}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
      {lightbox !== null && detailImgs.length > 0 && (
        <Lightbox
          images={detailImgs}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
      {playVideo && <VideoPlayer videoId={playVideo} onClose={() => setPlayVideo(null)} />}
    </>
  )
}

// YouTube video oynatici (tam ekran overlay, arka plana/carpiya tikla kapat)
function VideoPlayer({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const { t } = useT()
  return (
    <div className="videobox" onClick={onClose}>
      <Button variant="ghost" size="icon" className="videobox-close" onClick={onClose} aria-label={t('common.close')}>
        <Icon name="x" size={22} />
      </Button>
      <div className="videobox-frame" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title="Tavla Magazin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  )
}

// Haber detay sayfasi: kapak + tam metin + galeri gorselleri
function NewsDetail({
  item,
  onBack,
  backLabel,
  onOpenImage,
}: {
  item: Content
  onBack: () => void
  backLabel: string
  onOpenImage: (index: number) => void
}) {
  const { t } = useT()
  const gallery = (item.gallery ?? []).filter(Boolean)
  return (
    <article className="news-detail">
      <Button variant="secondary" className="news-back" onClick={onBack}>
        <span className="news-back-chev">
          <Icon name="chevron" size={16} />
        </span>{' '}
        {backLabel}
      </Button>
      <h3 className="news-detail-title">{item.title}</h3>
      <div className="news-detail-date">
        <Icon name="calendar" size={13} /> {fmtDate(item.event_at ?? null)}
      </div>
      {item.image && (
        <img
          className="news-detail-hero"
          src={item.image}
          alt={item.title}
          onClick={() => onOpenImage(0)}
        />
      )}
      <div className="news-detail-body">
        {paras(item.body).map((x, i) => (
          <p key={i}>{x}</p>
        ))}
      </div>
      {gallery.length > 0 && (
        <div className="news-gallery">
          {gallery.map((g, i) => (
            <button
              key={i}
              className="news-gallery-thumb"
              onClick={() => onOpenImage(i + 1)}
              aria-label={t('content.image', { n: i + 2 })}
            >
              <img src={g} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

// Tam ekran gorsel gosterici (lightbox): oklarla gezinme, arka plana/carpiya tikla kapat
function Lightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: string[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
}) {
  const { t } = useT()
  const many = images.length > 1
  const go = (delta: number) => onIndex((index + delta + images.length) % images.length)
  // Sol/sag ok tuslariyla gezinme (Esc ust bilesende yonetiliyor)
  useEffect(() => {
    if (!many) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, many, images.length])

  return (
    <div className="lightbox" onClick={onClose}>
      <Button variant="ghost" size="icon" className="lightbox-close" onClick={onClose} aria-label={t('common.close')}>
        <Icon name="x" size={22} />
      </Button>
      {many && (
        <Button
          variant="ghost"
          size="icon"
          className="lightbox-nav prev"
          onClick={(e) => {
            e.stopPropagation()
            go(-1)
          }}
          aria-label={t('content.prev')}
        >
          <span className="lightbox-chev left">
            <Icon name="chevron" size={26} />
          </span>
        </Button>
      )}
      <img
        className="lightbox-img"
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
      {many && (
        <Button
          variant="ghost"
          size="icon"
          className="lightbox-nav next"
          onClick={(e) => {
            e.stopPropagation()
            go(1)
          }}
          aria-label="Sonraki"
        >
          <span className="lightbox-chev right">
            <Icon name="chevron" size={26} />
          </span>
        </Button>
      )}
      {many && (
        <div className="lightbox-count">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  )
}

// Gorsel yolu: tam URL veya /... ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
const mediaSrc = (img?: string | null): string | undefined => {
  if (!img) return undefined
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

function EventRow({
  ev,
  upcoming,
  logo,
  hotel,
}: {
  ev: Content
  upcoming: boolean
  logo?: string
  hotel?: { image?: string; place?: string; province?: string; country?: string; maps?: string }
}) {
  const contacts = (ev.contacts ?? []).filter((c) => c && (c.name || c.phone))
  // Etkinlik gorseli: once kendi resmi, yoksa secili otelin resmi.
  const img = ev.image || hotel?.image
  // Otelin adresi (varsa) place bos ise gosterilebilir.
  const hotelPlace = hotel?.place
  // Harita: otel secili ise goster. Gomulu harita otel adi+konum aramasiyla; "Haritada Gor"
  // butonu otelin yapistirilan Maps linkiyle (yoksa arama URL'i) acilir.
  const mapQuery = ev.hotel
    ? [ev.hotel, hotel?.place, hotel?.province, hotel?.country].filter(Boolean).join(', ')
    : ''
  const mapEmbed = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
    : ''
  const mapHref = hotel?.maps || (mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : '')
  return (
    <div className={`event-row ${upcoming ? '' : 'past'} ${logo ? 'has-logo' : ''} ${img || mapEmbed ? 'has-map' : ''}`}>
      {/* Sag ust kose kurdelesi (SALE tarzi): ulkeye gore bayrak. Turkiye=TR, KKTC=KKTC. */}
      {ev.country && (
        <span className="event-ribbon" aria-hidden="true">
          <span className="event-ribbon-band">
            <CountryFlag code={ev.country} size={15} className="event-ribbon-flag" />
          </span>
        </span>
      )}
      {/* Sol: duzenleyen kurumun BUYUK logosu (varsa). Yoksa sutun render edilmez,
          bilgiler tam genislik alir. */}
      {logo && (
        <div className="event-logo-col">
          <img className="event-kurum-logo" src={mediaSrc(logo)} alt={ev.organizer ?? ''} />
        </div>
      )}
      {/* Orta: turnuva bilgileri (gorsel ve harita sag sutuna tasindi) */}
      <div className="event-main">
        <div className="event-date">
          <Icon name="calendar" size={13} /> {fmtDate(ev.event_at ?? null, true)}
        </div>
        <div className="event-title">{ev.title}</div>
        <div className="event-meta">
          {ev.organizer && (
            <span>
              <Icon name="star" size={12} /> {ev.organizer}
            </span>
          )}
          {ev.hotel && (
            <span>
              <Icon name="building-office" size={12} /> {ev.hotel}
            </span>
          )}
          {ev.province && (
            <span>
              <Icon name="pin" size={12} /> {ev.province}
            </span>
          )}
          {/* Adres: otel seciliyse OTELIN adresi onceliklidir; yoksa eski 'place' metni.
              (place alani formdan kaldirildi; eski kayitlarda kalan deger oteli EZMESIN.) */}
          {(hotelPlace || ev.place) && (
            <span>
              <Icon name="pin" size={12} /> {hotelPlace || ev.place}
            </span>
          )}
          {/* Tek alan iletisim (eski kayitlar) */}
          {ev.contact && !contacts.length && (
            <span>
              <Icon name="phone" size={12} /> {ev.contact}
            </span>
          )}
        </div>
        {contacts.length > 0 && (
          <div className="event-contacts">
            {contacts.map((c, i) => (
              <a key={i} className="event-contact" href={c.phone ? `tel:${c.phone}` : undefined}>
                <Icon name="phone" size={12} /> {c.name}
                {c.name && c.phone ? ' · ' : ''}
                {c.phone}
              </a>
            ))}
          </div>
        )}
        {/* Aciklama SADECE kurum (organizer) secilmemis etkinliklerde gosterilir.
            Kurum secilince logo + yapisal bilgiler (otel/il) yeterli -> tekrarli metin gizli. */}
        {!ev.organizer && ev.body && <p className="event-body">{ev.body}</p>}
      </div>
      {/* Sag: otel gorseli + konum haritasi YAN YANA; altta "Haritada Gör" butonu. */}
      {(img || mapEmbed) && (
        <div className="event-map-col">
          <div className="event-side-media">
            {img && <img className="event-side-img" src={mediaSrc(img)} alt="" />}
            {mapEmbed && (
              <iframe
                className="event-map"
                src={mapEmbed}
                title={`${ev.hotel ?? ''} harita`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            )}
          </div>
          {mapHref && (
            <a className="event-map-link" href={mapHref} target="_blank" rel="noreferrer">
              <Icon name="pin" size={13} /> Haritada Gör
            </a>
          )}
        </div>
      )}
    </div>
  )
}
