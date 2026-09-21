# TavlaTV Security Migration Runbook

Bu runbook production migration çalıştırmaz. Migration öncesi inceleme ve kontrollü rollout sırasını tanımlar.

## 1. Deploy öncesi doğrulama

```bash
git pull origin main
git status --short
php artisan about
php artisan migrate:status
```

Çalışma ağacında beklenmeyen değişiklik varsa rollout durdurulmalıdır. Production `.env` içindeki DB host/name bilgileri doğrulanmalı; değerler rapora veya loga yazılmamalıdır.

## 2. Zorunlu yedek ve bakım planı

1. Plesk/DB sağlayıcısından doğrulanabilir full database backup alınır.
2. Backup restore testi veya en azından backup checksum/reference numarası kaydedilir.
3. Queue worker ve scheduler durdurma planı hazırlanır.
4. Rollback için uygulama release commit’i ve migration batch numarası kaydedilir.

Backup doğrulanmadan migration çalıştırılmamalıdır.

## 3. Migration sırası

Yeni migration’lar mevcut dosya sırasıyla uygulanır:

1. `2026_09_21_220000_create_room_commands_table.php`
2. `2026_09_21_230000_create_wallet_transactions_table.php`
3. `2026_09_21_235000_add_security_integrity_constraints.php`
4. `2026_09_22_000000_add_checkout_idempotency_key.php`

İlk çalıştırma tek bir bakım penceresinde ve tek worker ile yapılmalıdır. Migration komutu iki kez veya paralel worker’dan çalıştırılmamalıdır.

## 4. Migration sonrası doğrulama

```bash
php artisan migrate:status
php artisan wallet:reconcile
php artisan test --testsuite=Unit
```

`wallet:reconcile` yalnızca rapor üretir; balance düzeltmez. Herhangi bir drift, `reserved > balance`, duplicate reference veya constraint hatasında rollout durdurulup backup’tan inceleme yapılmalıdır.

## 5. Feature flag kontrolü

Migration tamamlanmadan şu güvenlik ayarları gevşetilmemelidir:

```dotenv
SERVER_AUTHORITATIVE=true
DICE_ENFORCE=true
WALLET_REQUIRE_LEDGER=true
```

`WALLET_REQUIRE_LEDGER=false` yalnızca kontrollü shadow/migration ortamında geçici olarak kullanılabilir; money production için kabul edilemez.

## 6. Rollout sonrası güvenli smoke test

Gerçek kullanıcı veya coin ile test yapılmaz. Test hesabı ve test DB kullanılarak şunlar doğrulanır:

- authoritative command, `command_id` ve `expected_version` olmadan reddediliyor;
- duplicate command ikinci kez ekonomik/game state değişimi yapmıyor;
- wallet transaction oluşuyor ve balance arithmetic doğru;
- aynı checkout key ikinci siparişi oluşturmuyor;
- `wallet:reconcile` temiz sonuç veriyor;
- validator secret/TLS ve admin diagnostic endpoint erişimi doğru.

## 7. Rollback sınırı

Uygulama release’i geri alınabilir; ancak wallet ledger ve room command kayıtları silinerek rollback yapılmamalıdır. Migration `down` komutları production’da otomatik rollback olarak kullanılmamalı, önce veri ve ledger bağımlılıkları incelenmelidir. Constraint ihlali mevcutsa migration’ın fail-closed durması beklenen davranıştır.

Bu runbook migration çalıştırıldığı anlamına gelmez. Bu audit oturumunda production migration, production veri değişikliği ve gerçek coin işlemi yapılmamıştır.
