// Rive binary sahne dosyalari (.riv) Vite tarafindan URL asset olarak servis edilir
// (bkz. vite.config.ts assetsInclude). Bu bildirim olmadan tsc `import x from './y.riv'`
// ifadesini cozemez. Modul degeri, cozumlenmis URL string'idir.
declare module '*.riv' {
  const src: string
  export default src
}
