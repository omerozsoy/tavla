// GİZLİ BOT (misafir deneyimi): Üye OLMAYAN ziyaretçi "Tek Oyun" / "Maç Oyunu" ile rakip arayınca
// gerçek eşleşme (auth gerekli) yerine SESSİZCE bir bota eşlenir. Bot insan gibi görünür: aşağıdaki
// 100 isimden rasgele biri + makul rasgele puan + seviye 6-10. Kullanıcı bot oynadığını BİLMEZ.
// (Üyeler etkilenmez; onlar gerçek matchmaking havuzuna gider — bkz App.tsx handleMatchmake guard.)
// Seviye 6-10 tarayıcıda (wildbg ONNX) hesaplanır -> misafir için premium/sunucu bağımlılığı yok.

const GUEST_BOT_NAMES = [
  'MuratAbi', 'ayse1976', 'serkanizm', 'Ege35', 'mavideniz', 'ali1964', 'Zeynep', 'geceninbiri',
  'HakanY', 'gulsum53', 'cemocan', 'Sibel', 'bostanli', 'mehmetusta', 'ozlem72', 'CanEr',
  'yagmurrr', 'oktay061', 'Derya', 'eskilerden', 'erol1958', 'selinn', 'yalnizgezgin', 'Ufuk34',
  'nermin', 'karatas', 'burakkk', 'Aylin78', 'sinanbey', 'egelikiz', 'Orhan67', 'yasemince',
  'muratcan', 'mavi', 'Levent', 'ayten1969', 'gokhan16', 'SadeceBen', 'filiz35', 'tuncay',
  'Melis', 'ahmet1903', 'denizzz', 'KemalAbi', 'bahar71', 'selcukizmir', 'gunes', 'Cengiz54',
  'esraaa', 'birkahve', 'OmerFaruk', 'semra', 'volkan1982', 'Kumru', 'halilusta', 'nalan66',
  'emrecan7', 'ozgur', 'Sevda', 'kadikoylu', 'hasan1955', 'duyguuu', 'KeremC', 'canan74',
  'alper35', 'Yakamoz', 'erdinc', 'ebru1979', 'sakinadam', 'DenizK', 'suat61', 'gonul',
  'arda1907', 'papatya', 'MetinAbi', 'asuman', 'taner34', 'gececi', 'Elifim', 'necdet1960',
  'serappp', 'bora', 'izmirli49', 'Hulya', 'yusufcan', 'nesrin68', 'Kaan06', 'soner',
  'dildora', 'mustafaemekli', 'Eylul', 'ismail57', 'cansuu', 'TarikB', 'feride', 'bekirusta',
  'meltemce', 'Yolda', 'riza1959', 'oylesine',
]

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))

export interface GuestBotIdentity {
  name: string
  level: number // 6-10 (kullanıcı isteği)
  rating: number // 1150-1650 — insan izlenimi veren makul puan (kozmetik, oyunu etkilemez)
}

export function pickGuestBot(): GuestBotIdentity {
  return {
    name: GUEST_BOT_NAMES[randInt(0, GUEST_BOT_NAMES.length - 1)],
    level: randInt(6, 10),
    rating: randInt(1150, 1650),
  }
}
