/**
 * CustomInfoPage — admin panelden (İçerik › Bilgi Sayfaları) eklenen ÖZEL bilgi
 * sayfalarini /bilgi/<slug> altinda generic render eder. Sabit sekmeler (hakkinda,
 * hizmetler, sozluk, rutbeler...) Info modalinda; burada yalnizca katalog disi,
 * DB'den gelen yeni sayfalar. Govde + galeriler InfoPane ile cizilir (SeoContent/
 * ServiceLanding ile ayni page-host + seo-landing-card deseni). Bulunamazsa home'a doner.
 */

import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import Loading from './Loading'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { listInfoPages, type InfoPage } from '../api'
import { InfoPane } from './Info'
import Breadcrumb, { homeCrumb } from './Breadcrumb'

export default function CustomInfoPage({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [page, setPage] = useState<InfoPage | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    listInfoPages()
      .then((list) => {
        if (!alive) return
        setPage(list.find((p) => p.slug === slug) ?? null)
        setLoaded(true)
      })
      .catch(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [slug])

  // Sayfa basligini tarayici sekmesine yansit (currentSlug SEO efekti generic baslik verir;
  // DB basligi async yuklendigi icin bu efekt sonra calisip ustune yazar).
  useEffect(() => {
    if (page?.title) document.title = `${page.title} | TavlaTv`
  }, [page])

  if (!loaded) {
    return (
      <div className="register-card info-card seo-landing-card">
        <Loading />
      </div>
    )
  }

  if (!page) {
    // Bilinmeyen /bilgi/<slug> -> kullaniciyi ana sayfaya don.
    return (
      <div className="register-card info-card seo-landing-card service-landing">
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')} type="button">
          <Icon name="x" size={16} />
        </button>
        <Breadcrumb items={[homeCrumb(t)]} />
        <p className="rules-intro">{t('common.close')}</p>
      </div>
    )
  }

  return (
    <div className="register-card info-card seo-landing-card service-landing">
      <button className="modal-close" onClick={onClose} aria-label={t('common.close')} type="button">
        <Icon name="x" size={16} />
      </button>
      <Breadcrumb items={[homeCrumb(t), { name: page.title }]} />
      <header className="service-landing-head">
        <h1 className="info-title service-landing-title">{page.title}</h1>
      </header>
      <div className="info-tab-pane seo-landing-body-wrap">
        <div className="info-rich rich seo-landing-body">
          <InfoPane page={page} />
        </div>
      </div>
    </div>
  )
}
