import { useT } from '../i18n'
import { Icon } from './Icon'
import RoleBadge from './RoleBadge'
import type { RoomViewer } from '../api'

// İzleyenler rozeti: kaç kişi izliyor + kimler (isim/avatar). Hem Spectate (izleyiciler)
// hem oyun ekranı (oynayan oyuncular kimlerin izlediğini görsün) tarafından kullanılır.
// Salt-gösterim; konumlandırma sarmalayıcıya (ör. .spectate-side) bırakılır.
// Mobil (dar/portre) ekran mı? Oyun portre düzeniyle aynı eşik (max-width:900px).
const isMobile = (): boolean =>
  window.matchMedia?.('(max-width: 900px)').matches === true

export default function ViewersBadge({ viewers, count }: { viewers: RoomViewer[]; count: number }) {
  const { t } = useT()
  // Masaüstünde isimleri göster; mobilde dar ekran için YALNIZ sayı.
  const showList = viewers.length > 0 && !isMobile()
  return (
    <div className="sp-viewers">
      <div className="sp-viewers-head">
        <Icon name="eye" size={14} /> {t('live.watchCount', { n: count })}
      </div>
      {showList && (
        <div className="sp-viewers-list">
          {viewers.map((v, i) => (
            <span key={i} className="sp-viewer" title={v.name}>
              {v.avatar ? (
                <img className="sp-viewer-av" src={v.avatar} alt="" />
              ) : (
                <span className="sp-viewer-av sp-viewer-init">
                  {(v.name || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              {/* Yonetici/Destek izleyici: isim onunde rol kalkani (site geneli roller). */}
              <RoleBadge userId={v.id} size={14} style={{ marginRight: 2 }} />
              <span className="sp-viewer-name">{v.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
