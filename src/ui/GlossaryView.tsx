import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import ArticleBoard from './ArticleBoard'
import { GLOSSARY, GLOSSARY_BY_SLUG, GLOSSARY_SOURCE, type GlossaryEntry } from '../data/glossary'

const ALPHABET = ['A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H', 'I', 'İ', 'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z']

function fold(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  return (
    <div className="glossary-view">
      <header className="glossary-hero">
        <div>
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
        <label className="glossary-search">
          <Icon name="search" size={18} />
          <span className="sr-only">Türkçe veya İngilizce terim ara</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Terim ara: çapa, anchor, pip..."
            autoComplete="off"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Aramayı temizle">×</button>}
        </label>
        <p className="glossary-result-count">{Array.from(groups.values()).flat().length} terim gösteriliyor</p>
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
          <Icon name="search" size={24} />
          <h2>Aramana uygun terim bulunamadı</h2>
          <p>Türkçe veya İngilizce yazımı kontrol edip yeniden dene.</p>
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
                    <article className="glossary-entry" id={`terim-${entry.slug}`} key={entry.slug}>
                      <div className="glossary-entry-copy">
                        <h2>{entry.title}</h2>
                        <p className="glossary-english">{entry.english}</p>
                        <p className="glossary-definition">{entry.definition}</p>
                        {entry.aliases && entry.aliases.length > 0 && (
                          <p className="glossary-aliases"><span>Diğer yazımlar:</span> {entry.aliases.join(', ')}</p>
                        )}
                        {related.length > 0 && (
                          <div className="glossary-related">
                            <span>İlgili:</span>
                            {related.map((item) => <a key={item.slug} href={`#terim-${item.slug}`}>{item.title}</a>)}
                          </div>
                        )}
                      </div>
                      {entry.board && (
                        <ArticleBoard state={entry.board} steps={[]} caption={entry.boardCaption ?? null} />
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
