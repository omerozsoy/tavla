import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { GLOSSARY, GLOSSARY_BY_SLUG, GLOSSARY_SOURCE, type GlossaryEntry } from '../data/glossary'

const ALPHABET = ['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H', 'I', 'İ', 'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z']

function fold(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
}

function firstLetter(value: string) {
  return value.toLocaleUpperCase('tr-TR').charAt(0)
}

const RELATED_LOOKUP = new Map(
  GLOSSARY.flatMap((item) => [
    [item.slug, item] as const,
    [fold(item.title), item] as const,
    [fold(item.english), item] as const,
    ...(item.aliases ?? []).map((alias) => [fold(alias), item] as const),
  ]),
)

function relatedEntries(entry: GlossaryEntry) {
  return (entry.related ?? [])
    .map((slug) => GLOSSARY_BY_SLUG.get(slug) ?? RELATED_LOOKUP.get(fold(slug)))
    .filter((item): item is GlossaryEntry => !!item)
}

export default function GlossaryView() {
  const [query, setQuery] = useState('')
  const [letter, setLetter] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  // "İlgili" tıklamasında hedefe kaydır. n sayacı aynı slug'a tekrar tıklamayı da tetikler.
  const [scrollTarget, setScrollTarget] = useState<{ slug: string; n: number } | null>(null)
  const nRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const q = fold(query.trim())
    const filtered = GLOSSARY.filter((entry) => {
      const haystack = fold([entry.title, entry.english, ...(entry.aliases ?? [])].join(' '))
      return (!q || haystack.includes(q)) && (!letter || firstLetter(entry.title) === letter)
    }).sort((a, b) => a.title.localeCompare(b.title, 'tr'))
    const grouped = new Map<string, GlossaryEntry[]>()
    for (const entry of filtered) {
      const key = firstLetter(entry.title)
      const list = grouped.get(key) ?? []
      list.push(entry)
      grouped.set(key, list)
    }
    return grouped
  }, [letter, query])

  const available = useMemo(() => new Set(GLOSSARY.map((entry) => firstLetter(entry.title))), [])
  const total = useMemo(() => Array.from(groups.values()).reduce((n, g) => n + g.length, 0), [groups])

  // "İlgili" bir terime git: filtreleri temizle (hedef gizliyse görünür olsun) + kaydır + vurgula.
  function goToTerm(slug: string) {
    setLetter(null)
    setQuery('')
    nRef.current += 1
    setScrollTarget({ slug, n: nRef.current })
  }

  useEffect(() => {
    if (!scrollTarget) return
    // Filtre temizliği sonrası DOM güncellensin diye bir frame bekle.
    const raf = requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`#terim-${CSS.escape(scrollTarget.slug)}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlight(scrollTarget.slug)
    })
    const clear = window.setTimeout(() => setHighlight(null), 1800)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(clear)
    }
  }, [scrollTarget])

  return (
    <div className="glossary-view" ref={rootRef}>
      <header className="glossary-hero">
        <div className="glossary-hero-text">
          <span className="seo-eyebrow">TAVLA SÖZLÜĞÜ</span>
          <h1 className="glossary-title">Tavla terimleri, açık ve anlaşılır</h1>
          <p className="glossary-lede">
            Hamle, pozisyon, küp ve turnuva dilini Türkçe karşılığıyla öğren. İngilizce terimleri de
            birlikte görerek analizleri ve kaynakları daha rahat takip et.
          </p>
        </div>
        <div className="glossary-stat" aria-label={`${GLOSSARY.length} terim`}>
          <strong>{GLOSSARY.length}</strong>
          <span>özgün açıklama</span>
        </div>
      </header>

      <div className="glossary-toolbar">
        <div className="glossary-search">
          <Icon name="search" size={18} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Terim ara: çapa, anchor, pip…"
            autoComplete="off"
            aria-label="Türkçe veya İngilizce terim ara"
          />
          {query && (
            <button type="button" className="glossary-search-clear" onClick={() => setQuery('')} aria-label="Aramayı temizle">
              <Icon name="x" size={15} />
            </button>
          )}
        </div>
        <p className="glossary-result-count">
          <strong>{total}</strong> terim gösteriliyor
        </p>
      </div>

      <nav className="glossary-alphabet" aria-label="Türkçe alfabede gezinme">
        <button type="button" className={!letter ? 'active' : ''} onClick={() => setLetter(null)}>Tümü</button>
        {ALPHABET.map((item) => (
          <button
            type="button"
            key={item}
            className={`${letter === item ? 'active' : ''} ${available.has(item) ? '' : 'empty'}`}
            disabled={!available.has(item)}
            onClick={() => setLetter(letter === item ? null : item)}
            aria-label={`${item} harfi${available.has(item) ? '' : ', içerik yok'}`}
          >
            {item}
          </button>
        ))}
      </nav>

      {groups.size === 0 ? (
        <div className="glossary-empty">
          <Icon name="search" size={26} />
          <h2>Aramana uygun terim bulunamadı</h2>
          <p>Türkçe veya İngilizce yazımı kontrol edip yeniden dene.</p>
          {(query || letter) && (
            <button type="button" className="glossary-empty-reset" onClick={() => { setQuery(''); setLetter(null) }}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="glossary-groups">
          {Array.from(groups.entries()).map(([group, entries]) => (
            <section key={group} className="glossary-group" id={`harf-${group.toLocaleLowerCase('tr-TR')}`}>
              <div className="glossary-group-heading"><span>{group}</span><i /></div>
              <div className="glossary-entries">
                {entries.map((entry) => {
                  const related = relatedEntries(entry)
                  return (
                    <article
                      className={`glossary-entry${highlight === entry.slug ? ' is-highlight' : ''}`}
                      id={`terim-${entry.slug}`}
                      key={entry.slug}
                    >
                      <h2>{entry.title}</h2>
                      <p className="glossary-english">{entry.english}</p>
                      <p className="glossary-definition">{entry.definition}</p>
                      {entry.aliases && entry.aliases.length > 0 && (
                        <p className="glossary-aliases"><span>Diğer yazımlar:</span> {entry.aliases.join(', ')}</p>
                      )}
                      {related.length > 0 && (
                        <div className="glossary-related">
                          <span>İlgili:</span>
                          <span className="glossary-related-chips">
                            {related.map((item) => (
                              <button
                                type="button"
                                key={item.slug}
                                className="glossary-related-link"
                                onClick={() => goToTerm(item.slug)}
                              >
                                {item.title}
                              </button>
                            ))}
                          </span>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="glossary-source">
        <span>Terim envanteri için başvurulan kaynak:</span>{' '}
        <a href={GLOSSARY_SOURCE} target="_blank" rel="noreferrer">Backgammon Galore Glossary</a>
        <span>. Açıklamalar TavlaTV için özgün olarak yazılmıştır.</span>
      </footer>
    </div>
  )
}
