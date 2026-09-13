import { useT } from '../i18n'
import { Icon } from './Icon'
import type { RoomViewer } from '../api'

// İzleyenler rozeti: kaç kişi izliyor + kimler (isim/avatar). Hem Spectate (izleyiciler)
// hem oyun ekranı (oynayan oyuncular kimlerin izlediğini görsün) tarafından kullanılır.
// Salt-gösterim; konumlandırma sarmalayıcıya (ör. .spectate-side) bırakılır.
export default function ViewersBadge({ viewers, count }: { viewers: RoomViewer[]; count: number }) {
  const { t } = useT()
  return (
    <div className="sp-viewers">
      <div className="sp-viewers-head">
        <Icon name="eye" size={14} /> {t('live.watchCount', { n: count })}
      </div>
      {viewers.length > 0 && (
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
              <span className="sp-viewer-name">{v.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
