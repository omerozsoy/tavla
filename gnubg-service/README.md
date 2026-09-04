# GNU Backgammon Analiz Servisi (tavlai — ana motor)

gnubg ağır bir C programı; her istekte yeniden başlatmak pahalı. Bu servis gnubg'yi **açık tutar**
(gnubg'nin gömülü Python'unda çalışan küçük bir HTTP servisi) ve analizi hızlı sunar — validator
mikroservisinin gnubg karşılığı. Çok-motorlu analiz mimarisinde **birincil (deep) motorun evi**.

## Uçlar
- `GET /health` → `{ok:true, service:"gnubg"}` (secret'siz).
- `POST /hint` `{gnubgid, plies?}` → gnubg.hint() yapısal sonucu (aday hamleler + cubeful equity +
  eqdiff + 5'li olasılık). `gnubgid` = gnubg'nin `posID:matchID` kanonik kodu (konum + küp/skor/sıra/zar).
- `POST /evaluate` `{gnubgid}` → pozisyonun ham olasılık değerlendirmesi.

## Güvenlik
- **Yalnız 127.0.0.1** + `GNUBG_SECRET` başlığı (`x-gnubg-secret`). ASLA halka açık portta çalıştırma.
- Tek-thread: gnubg'nin geçerli konumu GLOBAL durum → istekler SIRAYLA işlenir (yarış yok).

## Kurulum (AlmaLinux 8 + root, Plesk sunucu)
```
# 1) Dosyayı sunucuya koy
mkdir -p /opt/gnubg-service
# gnubg_service.py'yi /opt/gnubg-service/ altına kopyala (repo'dan)

# 2) systemd servisi (kalıcı + otomatik-restart = self-healing)
cp gnubg-analysis.service /etc/systemd/system/gnubg-analysis.service
# GNUBG_SECRET'i UZUN-RASTGELE bir değerle düzenle:
nano /etc/systemd/system/gnubg-analysis.service

systemctl daemon-reload
systemctl enable --now gnubg-analysis
systemctl status gnubg-analysis --no-pager
```

## Test
```
# Sağlık
curl -s http://127.0.0.1:8092/health

# Bilinen bir pozisyonda hint (gnubgid = posID:matchID)
curl -s -X POST http://127.0.0.1:8092/hint \
  -H "x-gnubg-secret: <SECRET>" -H "content-type: application/json" \
  -d '{"gnubgid":"4HPwATCwZ/ABMA:MIEFAAAAAAAA"}' | head -c 800
```
`/hint` aday hamleleri equity'leriyle döndürüyorsa servis hazır.

## Backend bağlama (sonraki adım)
`backend/.env`: `GNUBG_URL=http://127.0.0.1:8092`, `GNUBG_SECRET=<aynı>`.
Orkestratör (deep analiz) hem validator (wildbg) hem bu servisi (gnubg) çağırır; disagreement +
selective rollout mantığı orada. PR **final otoriter** sonuçtan hesaplanır (bkz `src/analysis/pr.ts`).

## Notlar
- **gnubgid üretimi:** backend `GameState` → gnubg `posID:matchID` çevirir (adapter işi). Test için
  gnubg'den okunmuş hazır id kullanılır.
- **Semantik:** gnubg **cubeful + match-aware** equity verir; wildbg **cubeless money**. Checker
  kıyası için gnubg'nin 5'li olasılığından kübsüz equity türet (elma-elma); küp + maç-skoru için
  gnubg'nin cubeful/MWC'sini kullan. Cubeful/cubeless KARIŞTIRMA.
- **Rollout:** ileride `/rollout` ucu (adaptive stopping) eklenecek — yalnız çekişmeli pozisyonlar için.
