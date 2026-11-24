<?php

namespace Tests\Feature;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Apple ile Giriş (iOS native). Apple'in hazir "tokeninfo"su yok -> imzayi JWKS ile dogruluyoruz.
// Test gercek bir RSA cifti uretip idToken'i imzalar ve ayni public key'i sahte JWKS olarak dondurur,
// boylece imza yolu da test edilir (sadece claim mantigi degil).
class AppleLoginTest extends TestCase
{
    use RefreshDatabase;

    private const AUD = 'com.tavlatv.app';

    // Yalniz TEST icin sabit RSA ozel anahtari (gizli DEGIL, uretim degeri degil). Anahtar URETMEK
    // (openssl_pkey_new) Windows'ta openssl.cnf ister; PARSE/imzalama config istemez -> sabit PEM kullan.
    private const PRIV = <<<'PEM'
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDYF8TIhJorCrfs
jKLH2MGSpRClwLlT82Gg1oN203FdNZEceXUDdHy3FdImuCYp3i1T+Agn8puSyBtQ
xOS4VUmIHVbj++prMPuhvtdceZPt56eLYv7zhDftFF2PfpHT0abHjh1bPWTXuPGS
b1SmcAvEqQdZjrZy1u/GD7et8jo0CVZMgpA5gmYkTSKcZMWOq1v9jzLivO4QzWQP
ABf2oPsFf12mJd37JgDsVPJNB13a+9z6Xu7q+LN6y+jAyfTVEzffvKr1B8UnFX+D
fkztVJkkmI+oSYbGj37ot+qUyNtcSpxQHLsiMLCFA6Os011efetT/zJaiShFP8Uy
N4Ice0mhAgMBAAECggEAM/cDS3UX3eHl+OyY+JYXdrxbFIEUECwm/haX5qtSR6fq
DX7ntLz+gMiukMEX7FmRbO/ohjLBVrroVrQCjJF17VWg35Jk/QH6gRrzjzltaXib
wdk8ljLlgA21shwt1VJFWRfD130cEwRWk3BSWvP24IQFUHQRS+yEHI0LDrmBZaGo
DvejMoNxxz44ph6B1hENXewFPm9mrzoPoiiUZVtXb9208zxyeD6urejaxXrnu1ZY
RT2hYYj0v5TMoZz4Vw+PKFmKjoSF5k7pK2YXm3BSFIdsrMKsHeot5By+zifUPnDg
pPm7YN4PpqsJpCC87EdvKP0TZKht8n0IRKiQzWeTAQKBgQDtH7vDN9ta/xoFrT92
HRaWg9UhLraBMbQdMZFwSROhFSXwnmXyp1b2B3jGa2V8OFkBiRrYZ35hUFQT42ST
WciSrNI2iblKQbduzNe5SouRu7Go1OBAcqWEggv5fi03sKa+ZpdZhRLybk3SaaMV
AOshXGIJPU0uQV0+XymvQLAPJQKBgQDpS3MUDcKF51gFNoBnzMIypkbh+NKfUGcB
Rgm1OebO+JUf0zo9HoLHork0OaVOK+TQFCBf0YoSnKsX0IFJw+9R5yTifDcEd1os
3/yN5KuzYkAG/DnUOQrLIJYQGVvs3ChuD467Xc65l/dOjA0t54I6wZ29OmkoGYm5
/zkjVIK1zQKBgQDEqXb+V8sz0zNv1do2SbW8K6aOGMIAsIpjVAL9j34aMQIAaD7B
W4xCDLxcRCItPkaDgYSkSmGEsCyrOgLmOqahD3hhBySHs61A1d9sq6jJu1ODZNqA
WRVxqrHnwIAcGgSREWEhO78VFeqxQi+hcduRFZ+xbgge/tMosaBO22WpiQKBgAWY
jbYZbmUP24ikeggDXVUhr+mTslmn8BCTwX/bV7H3PHx68JauuKxZNuAN0e1CGEb1
dKFXwVwY7fGwSqmeTYtFZBkaqactxbf113T/2y5+WNLSEgEJLT0aFv9j3FSeI0og
jWfpJCBHiOMVcOt89h66rjHvyL3xfuA7Qv+Z81ixAoGBAJdGS87nSRZRBvc3/tJ+
n9cTaGQ+Du4rSS6QxB4ULmBEC0QChW5S+9MXfrN0uOArZQZkhLYFh06+YQv22Tih
IFKIq4AYwpAJ/zcoR4Ll3XtHdhfl84HuKOirIneB/IlC6QtCSP18xEb9Ty4osFV+
Lb0g/t3Lkq+NmMSJGZEYEqLw
-----END PRIVATE KEY-----
PEM;

    private array $jwks;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.apple.client_id' => self::AUD]);
        $d = openssl_pkey_get_details(openssl_pkey_get_private(self::PRIV));
        $b64 = fn ($bin) => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
        $this->jwks = ['keys' => [[
            'kty' => 'RSA', 'kid' => 'testkid', 'use' => 'sig', 'alg' => 'RS256',
            'n' => $b64($d['rsa']['n']), 'e' => $b64($d['rsa']['e']),
        ]]];
    }

    private function appleToken(array $claims): string
    {
        Cache::forget('apple_jwks'); // her token kendi anahtarini kullansin
        Http::fake(['appleid.apple.com/auth/keys' => Http::response($this->jwks, 200)]);

        return JWT::encode(array_merge([
            'iss' => 'https://appleid.apple.com',
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $claims), self::PRIV, 'RS256', 'testkid');
    }

    public function test_new_apple_user_creates_account(): void
    {
        $tok = $this->appleToken(['sub' => '000111.abc', 'email' => 'yeni@icloud.com', 'email_verified' => 'true']);
        $this->postJson('/api/auth/apple', ['identity_token' => $tok])
            ->assertOk()->assertJsonPath('isNew', true);
        $this->assertDatabaseHas('users', ['apple_user_id' => '000111.abc', 'email' => 'yeni@icloud.com']);
    }

    public function test_existing_apple_sub_logs_in_not_duplicated(): void
    {
        $u = User::factory()->create(['email' => 'eski@icloud.com']);
        $u->apple_user_id = '222333.xyz';
        $u->save();
        // Apple 2. giriste e-posta VERMEZ -> yalniz sub; yine de ayni hesaba girmeli.
        $tok = $this->appleToken(['sub' => '222333.xyz']);
        $this->postJson('/api/auth/apple', ['identity_token' => $tok])
            ->assertOk()->assertJsonPath('isNew', false)->assertJsonPath('user.id', $u->id);
    }

    public function test_links_to_existing_verified_email_account(): void
    {
        $u = User::factory()->create(['email' => 'sahip@gmail.com']); // dogrulanmis (factory)
        $tok = $this->appleToken(['sub' => '444.aaa', 'email' => 'sahip@gmail.com', 'email_verified' => 'true']);
        $this->postJson('/api/auth/apple', ['identity_token' => $tok])
            ->assertOk()->assertJsonPath('isNew', false)->assertJsonPath('user.id', $u->id);
        $this->assertSame('444.aaa', $u->fresh()->apple_user_id);
    }

    public function test_wrong_audience_rejected(): void
    {
        $tok = $this->appleToken(['sub' => '555.bbb', 'aud' => 'com.baska.app', 'email' => 'x@icloud.com']);
        $this->postJson('/api/auth/apple', ['identity_token' => $tok])->assertStatus(401);
    }
}
