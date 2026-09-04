import { execSync } from 'node:child_process'

// E2E öncesi: TEMİZ test DB + 2 kullanıcı (id 1,2) + token (storage/app/e2e-users.json).
// artisan DOĞRUDAN çağrılır (HTTP gerekmez) -> webServer sırasından bağımsız. APP_ENV=e2e ->
// .env.e2e (ayrı sqlite) -> prod/dev verisine DOKUNMAZ.
export default async function globalSetup() {
  execSync('php artisan e2e:seed', {
    cwd: 'backend',
    env: { ...process.env, APP_ENV: 'e2e' },
    stdio: 'inherit',
  })
}
