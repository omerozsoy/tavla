import type { ReactNode } from 'react'

// Lobi (giriş yapılmış "app lobby") sayfalarının TEK ortak iskeleti. Daha önce bu iskelet
// (mobil nav + üst bar + sol menü + <main> + Footer + trailing overlay'ler) App.tsx render'ında
// her sayfa dalında SATIR SATIR kopyalanıyordu; yeni bir dal eklerken <Footer> unutulunca o sayfa
// footer'sız kalıyordu (kök sebep). Artık footer + kabuk TEK YERDE burada; her lobi dalı bunu
// kullanır -> hiçbir sayfa footer'sız kalamaz.
//
// chrome (mobileNav/topbar/sideMenu/footer) App scope'unda bir kez kurulup prop olarak geçilir
// (closure'lu SideMenu/accountBar vs. tekrar tekrar inşa edilmesin). mainClassName ve trailing
// dala göre değişir (home dinamik has-page + özel trailing; online lobi has-page'siz).
export interface LobbyLayoutProps {
  mobileNav?: ReactNode
  topbar: ReactNode
  sideMenu: ReactNode
  footer: ReactNode
  /** <main> sınıfı; içerik sayfaları için varsayılan "has-page". Home dinamik geçer. */
  mainClassName?: string
  /** <main> içeriği. Sayfa dalları genelde <div className="page-host"> ile sarar. */
  children: ReactNode
  /** .app.lobby'den SONRA gelen overlay/modal katmanı (menuPages/authModal/… dala göre). */
  trailing?: ReactNode
}

export default function LobbyLayout({
  mobileNav,
  topbar,
  sideMenu,
  footer,
  mainClassName = 'main lobby-main has-page',
  children,
  trailing,
}: LobbyLayoutProps) {
  return (
    <>
      {mobileNav}
      <div className="app lobby">
        {topbar}
        {sideMenu}
        <main className={mainClassName}>{children}</main>
        {footer}
      </div>
      {trailing}
    </>
  )
}
