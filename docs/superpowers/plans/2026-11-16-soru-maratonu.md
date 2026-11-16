# Soru Maratonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Günün Sorusu"nu, zorluk-bazlı puanlı, ilk yanlışta biten, anonim takma-adlı global tabelalı sınırsız bir quiz moduna ("Soru Maratonu") çevir.

**Architecture:** Mevcut LessonView puzzle+puanlama motorunu `onAnswered` callback'i ile yeniden kullan; yeni `QuizMarathon.tsx` oyun döngüsünü (skor, streak, soru akışı, game-over) yönetir. Skorlar anonim (giriş yok) yeni `quiz_scores` tablosuna POST edilir; tabela 30sn cache'li GET ile okunur.

**Tech Stack:** React 19 + TS + Vite (kök), Laravel 12 API (backend/), vitest (src/**), PHPUnit (backend).

**Spec:** docs/superpowers/specs/2026-11-16-soru-maratonu-design.md

## Global Constraints
- Türkçe UI metinleri; motor adı (wildbg/gnubg) kullanıcıya DÖNÜK metinde GEÇMEZ.
- Puan tablosu SABİT: Çok Kolay/Kolay=25, Orta=50, Zor=75, Çok Zor=100 (tier çarpanı ×1/×2/×3/×4, taban 25).
- Anonim: skor `users`'a BAĞLANMAZ, giriş gerekmez.
- Puan istemci-güvenli DEĞİL (spoof mümkün) — kasıtlı; backend yalnız tip/aralık doğrular + throttle.
- Yeni SPA slug'ı `web.php` `$valid` allowlist'ine EKLENMELİ (yoksa F5'te 404).
- Frontend sunucuda derlenmez: `npm run deploy:build` → `backend/public` commit → push.

## Review Focus
- **Takma-ad kötüye kullanımı** (boş/çok uzun/HTML): backend 1–20 karakter trim + strip, boşsa "Oyuncu" → Task 2 testi.
- **Skor aralık dışı/negatif/ondalık** (spoof/hata): backend int + 0..100000 clamp/validate, reddet → Task 2 testi.
- **Aynı sorunun turda tekrarı:** seen-set ile havuz tükenirse zarif bitiş → Task 6 (seen-set + pool bitince oyunu kazanılmış say).
- **POST seli (spam):** `throttle` middleware → Task 2 (route throttle, test opsiyonel).
- **Boş tabela / fetch hatası:** game-over ekranı tabela boşsa/erişilemezse çökmesin → Task 6 (fallback render).

---

### Task 1: quiz_scores tablosu (migration + model)

**Files:**
- Create: `backend/database/migrations/2026_11_16_000000_create_quiz_scores_table.php`
- Create: `backend/app/Models/QuizScore.php`

**Interfaces:**
- Produces: `QuizScore` modeli; tablo kolonları `id, nickname (string 20), score (unsignedInteger), correct_count (unsignedInteger), ip_hash (string 64, nullable), created_at, updated_at`. Index: `score` (desc sorgu).

- [ ] **Step 1:** Migration yaz: `Schema::create('quiz_scores', ...)` yukarıdaki kolonlar + `$table->index('score')`.
- [ ] **Step 2:** `QuizScore` modeli: `protected $fillable = ['nickname','score','correct_count','ip_hash']`.
- [ ] **Step 3:** Çalıştır: `cd backend && php artisan migrate` (sqlite :memory: testte otomatik).
- [ ] **Step 4:** Commit: `git add backend/database/migrations backend/app/Models/QuizScore.php && git commit -m "feat(maraton): quiz_scores tablosu + model"`

---

### Task 2: QuizScoreController (submit + leaderboard) + routes

**Files:**
- Create: `backend/app/Http/Controllers/QuizScoreController.php`
- Modify: `backend/routes/api.php` (yeni iki route, LeaderboardController route'larının yanına)
- Test: `backend/tests/Feature/QuizScoreTest.php`

**Interfaces:**
- Consumes: `QuizScore` (Task 1).
- Produces:
  - `POST /api/quiz-marathon/score` body `{nickname, score, correct_count}` → `201 {ok:true, rank:int}` (gönderilen skorun tabeladaki sırası).
  - `GET /api/quiz-marathon/leaderboard?limit=` → `{players:[{rank,nickname,score,correct_count}], ...}` (score desc, limit≤100 varsayılan 20, 30sn cache).

- [ ] **Step 1: Failing test yaz** `QuizScoreTest`:
  - `test_submit_inserts_and_returns_rank`: POST `{nickname:'Ahmet', score:325, correct_count:12}` → 201, `ok=true`, `rank>=1`; DB'de 1 satır.
  - `test_leaderboard_orders_by_score_desc`: 3 skor ekle (100,300,200) → GET leaderboard players[0].score=300, rank=1.
  - `test_nickname_trimmed_and_capped`: nickname `'  <b>x'*10 '` → kayıtta ≤20 krk, HTML strip; boş nickname → 'Oyuncu'.
  - `test_invalid_score_rejected`: score `-5` veya `'abc'` veya `999999999` → 422.
- [ ] **Step 2:** Çalıştır `cd backend && php artisan test --filter QuizScoreTest` → FAIL (controller yok).
- [ ] **Step 3:** Controller yaz:
  - `submit(Request $r)`: validate `nickname: nullable|string|max:40`, `score: required|integer|min:0|max:100000`, `correct_count: required|integer|min:0|max:100000`. nickname = `Str::limit(strip_tags(trim($r->nickname)), 20, '')` boşsa `'Oyuncu'`. `ip_hash = hash('sha256', $r->ip())`. `QuizScore::create(...)`. rank = `QuizScore::where('score','>',$score)->count()+1`. 201.
  - `leaderboard(Request $r)`: `$limit=min(100,max(1,(int)$r->query('limit',20)))`. `Cache::remember("quiz_lb:$limit",30, fn()=> QuizScore::orderByDesc('score')->orderBy('created_at')->limit($limit)->get(['nickname','score','correct_count']))` → rank'le map. `{players}`.
- [ ] **Step 4:** Route ekle (api.php, public — auth YOK): `POST .../score` `->middleware('throttle:20,1')`, `GET .../leaderboard`.
- [ ] **Step 5:** Çalıştır test → PASS.
- [ ] **Step 6:** Commit: `git add backend/app/Http/Controllers/QuizScoreController.php backend/routes/api.php backend/tests/Feature/QuizScoreTest.php && git commit -m "feat(maraton): skor submit + tabela uclari (anonim, throttle)"`

---

### Task 3: Puan + maraton havuzu (trainingCurriculum export)

**Files:**
- Modify: `src/ui/trainingCurriculum.ts` (iki yeni export)
- Test: `src/ui/marathon.test.ts`

**Interfaces:**
- Consumes: mevcut `tierOf`, `hardnessText` (dosya içi), `CURRICULUM`.
- Produces:
  - `export function questionPoints(q: Question): number` → 25/50/75/100 (`tierOf(hardnessText(q))`: 0→25,1→25,2→50,3→75,4→100).
  - `export const MARATHON_POOL: Question[]` → CURRICULUM'un tüm lesson'larından (test HARİÇ `!l.isTest`) düzleştirilmiş sorular (zaten board+zar dedup'lı).

- [ ] **Step 1: Failing test** `marathon.test.ts`:
  - `test_questionPoints_tiers`: bilinen kolay/orta/zor başlıklı 4 soru (ya da hardnessText mock'u) → 25/50/75/100 döner. (Pratik: MARATHON_POOL'dan tierOf ile grupla, her gruptan birine questionPoints uygula → beklenen çarpan.)
  - `test_marathon_pool_nonempty_no_dupes`: `MARATHON_POOL.length > 500`; board+zar anahtarıyla 0 çift.
- [ ] **Step 2:** Çalıştır `npm test -- marathon` → FAIL.
- [ ] **Step 3:** İki export'u ekle. `questionPoints`: `const m=[1,1,2,3,4][tierOf(hardnessText(q))]; return 25*m`.
- [ ] **Step 4:** Çalıştır → PASS.
- [ ] **Step 5:** Commit: `git add src/ui/trainingCurriculum.ts src/ui/marathon.test.ts && git commit -m "feat(maraton): questionPoints + MARATHON_POOL export"`

---

### Task 4: LessonView onAnswered callback

**Files:**
- Modify: `src/ui/TrainingView.tsx` (LessonView props + 3 firstTryOk noktası: ~370 otoriter, ~393 motor, ~433 kup)

**Interfaces:**
- Produces: LessonView prop `onAnswered?: (correct: boolean, q: Question) => void`. Her `firstTryOk` hesabından HEMEN sonra, o sorunun ilk-deneme sonucu ile çağrılır (sadece ilk denemede; retry'de değil — mevcut `firstTryOk` zaten ilk-deneme).

- [ ] **Step 1:** Props imzasına `onAnswered?: (correct: boolean, q: Question) => void` ekle.
- [ ] **Step 2:** Üç `firstTryOk` noktasında `onAnswered?.(firstTryOk, q)` çağır (q = o anki soru). Davranış değişmez (opsiyonel callback).
- [ ] **Step 3:** `npm run typecheck` → temiz; mevcut `TrainingView.test.ts` + `curriculum.test.ts` yeşil.
- [ ] **Step 4:** Commit: `git add src/ui/TrainingView.tsx && git commit -m "feat(maraton): LessonView onAnswered callback (ilk-deneme sonucu)"`

---

### Task 5: api.ts — submit + leaderboard

**Files:**
- Modify: `src/api.ts`

**Interfaces:**
- Consumes: Task 2 uçları; mevcut `req<T>` helper.
- Produces:
  - `export interface QuizLeaderRow { rank: number; nickname: string; score: number; correct_count: number }`
  - `export async function submitQuizScore(nickname: string, score: number, correct_count: number): Promise<{ rank: number }>` → POST.
  - `export async function quizLeaderboard(limit = 20): Promise<QuizLeaderRow[]>` → GET, `data.players`.

- [ ] **Step 1:** Üç export'u ekle (mevcut POST/GET desenini izle; `req('/quiz-marathon/score',{method:'POST',body:JSON.stringify({nickname,score,correct_count})})`).
- [ ] **Step 2:** `npm run typecheck` → temiz.
- [ ] **Step 3:** Commit: `git add src/api.ts && git commit -m "feat(maraton): api submitQuizScore + quizLeaderboard"`

---

### Task 6: QuizMarathon.tsx (oyun döngüsü + game-over + tabela)

**Files:**
- Create: `src/ui/QuizMarathon.tsx`
- Test: `src/ui/quizMarathon.test.ts` (yalnız saf yardımcı: sıradaki soru seçimi/skor birikimi — render testi yok)

**Interfaces:**
- Consumes: `MARATHON_POOL`, `questionPoints` (Task 3); LessonView `onAnswered` (Task 4); `submitQuizScore`, `quizLeaderboard` (Task 5).
- Produces: `export function QuizMarathon({ onClose }: { onClose: () => void })`.

Davranış (state makinesi):
- Faz `playing` | `over`. `score`, `correctCount`, `seen:Set<string>` (questionId), `step` (remount anahtarı), `current: Question`.
- `pickNext()`: MARATHON_POOL'dan `seen`'de olmayan rastgele soru (deterministik değil — index'e göre varyasyon; Math.random YASAK değil runtime'da, ama tekrar-yok için seen yeterli). Havuz tükenirse `over` (kazanıldı).
- Render `playing`: `<LessonView key={step} lessonId={'maraton-'+step} fixed={{title:'Soru Maratonu', questions:[current]}} onBack={onClose} onAnswered={handle} />` + üstte **anlık skor** rozeti.
- `handle(correct, q)`: `correct` → `score += questionPoints(q); correctCount++`; kullanıcı LessonView geri-bildirimini görür, QuizMarathon "Sonraki Soru →" düğmesi gösterir → `seen.add(questionId(current)); current=pickNext(); step++`. `!correct` → `over`.
- Render `over`: büyük skor + `correctCount` doğru; takma-ad input (maxLength 20) + "Tabelaya Yaz" (`submitQuizScore` → rank göster, tekrar yazmayı kilitle) + `quizLeaderboard()` listesi (boş/hata → "Henüz skor yok / tabela yüklenemedi" fallback) + "Baştan Başla" (state sıfırla, `playing`).

- [ ] **Step 1: Failing test** `quizMarathon.test.ts`: saf yardımcıyı dışa aç ve test et — `scoreAfter(correctQsPoints:number[])` ya da `pickNext(pool,seen)` tekrar vermez. (Döngü/skor mantığı; UI değil.) Örn: `pickNext` seen'deki id'yi ASLA döndürmez; tüm havuz seen ise null.
- [ ] **Step 2:** `npm test -- quizMarathon` → FAIL.
- [ ] **Step 3:** `QuizMarathon.tsx` + saf yardımcıları yaz. Stil için mevcut `.bgx-*`/LessonView kapsayıcısı + basit tabela (Leaderboard.tsx deseninden ilham, ayrı hafif markup).
- [ ] **Step 4:** `npm test -- quizMarathon` → PASS; `npm run typecheck` temiz.
- [ ] **Step 5:** Commit: `git add src/ui/QuizMarathon.tsx src/ui/quizMarathon.test.ts && git commit -m "feat(maraton): QuizMarathon oyun dongusu + game-over + tabela"`

---

### Task 7: Entegrasyon — route, menü, allowlist, i18n

**Files:**
- Modify: `src/App.tsx` (route case `soru-maratonu` → QuizMarathon aç; eski `gunun-pozisyonu` menü/aç mantığını maratona yönlendir ya da koru)
- Modify: `src/i18n.tsx` (menü etiketi + ekran metinleri: `menu.quizMarathon`, skor/doğru/baştan-başla/tabela/takma-ad)
- Modify: `backend/routes/web.php` (`$valid` allowlist'e `soru-maratonu` ekle)
- (Menü öğesi: admin MenuItem dinamik mi yoksa App.tsx sabit mi — mevcut "Günün Pozisyonu" nasıl bağlandıysa aynı yol.)

**Interfaces:**
- Consumes: `QuizMarathon` (Task 6).

- [ ] **Step 1:** `web.php` `$valid`'e `'soru-maratonu'` ekle.
- [ ] **Step 2:** `App.tsx`: `case 'soru-maratonu': setQuizMarathonOpen(true)` + state + render `{quizMarathonOpen && <QuizMarathon onClose={...}/>}`; menüde "Soru Maratonu" öğesi (mevcut Günün Pozisyonu öğesinin yerini alır/yanına).
- [ ] **Step 3:** i18n anahtarlarını TR (gerekirse EN) ekle.
- [ ] **Step 4:** `npm run typecheck` temiz; `/soru-maratonu` F5 testi (allowlist) — backend route testi varsa `league and teams routes serve spa shell` benzeri.
- [ ] **Step 5:** Commit: `git add src/App.tsx src/i18n.tsx backend/routes/web.php && git commit -m "feat(maraton): route + menu + allowlist + i18n"`

---

### Task 8: Deploy

**Files:**
- Modify: `backend/public/*` (dist)

- [ ] **Step 1:** Backend testleri: `cd backend && php artisan test` yeşil.
- [ ] **Step 2:** Frontend: `npm run typecheck` + `npm test` yeşil.
- [ ] **Step 3:** `npm run deploy:build` (cache-temiz dahil) → `backend/public` güncellenir; wired chunk doğrula.
- [ ] **Step 4:** Commit `backend/public` + push; CI yeşil → QD deploy → canlı `/soru-maratonu` + entry 200 + tabela POST/GET çalışıyor doğrula.
- [ ] **Step 5:** Migration canlıda: Forge deploy `php artisan migrate` çalıştırmıyorsa kullanıcıya SÖYLE (panel/deploy script) — `quiz_scores` tablosu üretimde oluşmazsa submit 500 verir.

## Notlar
- **Migration üretim:** Forge deploy script'i `migrate --force` içermiyorsa tablo canlıda oluşmaz → Task 8 Step 5. Kullanıcıya teyit ettir.
- **LessonView bağımlılığı:** marathon LessonView'i remount-per-soru (`key={step}`) ile sürer; LessonView'in kendi "tamamlandı" ekranı onAnswered sonrası QuizMarathon view'ı değiştirdiği için görünmez.
- **Puan güveni:** istemci skoru → spoof mümkün (tasarım kabulü). Tabela "eğlence" amaçlı.
