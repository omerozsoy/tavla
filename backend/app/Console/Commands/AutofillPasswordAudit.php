<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Autofill parola-ezme olayinin KURBAN denetimi.
 *
 * Hata (commit 9af8b56c oncesi): Filament uye duzenleme formundaki "Yeni sifre" alanina
 * tarayici parola yoneticisi YONETICININ kayitli giris parolasini oto-dolduruyordu; Enter/Kaydet'te
 * filled() true olup o parola RE-HASH edilip HEDEF uyeye yaziliyordu. Yani duzenlenen uyelerin
 * parolasi sessizce "yoneticinin parolasi" ile ezilmis olabilir.
 *
 * bcrypt tek-yonludur: kurbanlari bulmanin TEK yolu her uyenin hash'ini yoneticinin DUZ parolasina
 * karsi test etmektir (Hash::check). Parola GIZLI prompt ile alinir -> ne log'a ne gecmise yazilir.
 *
 * Kullanim (sunucuda):  php artisan tavla:autofill-audit [--reset]
 *   --reset : eslesen uyelerin parolasini KULLANILAMAZ rastgele degere cevirir (girise "parolami
 *             unuttum" ile devam ederler). Yoneticinin kendisi (is_admin) DAIMA haric tutulur.
 */
class AutofillPasswordAudit extends Command
{
    protected $signature = 'tavla:autofill-audit {--reset : Eslesen uyelerin parolasini sifirla (unutma-akisi)}';

    protected $description = 'Autofill ile ezilmis uye parolalarini bulur (yonetici parolasina karsi test eder)';

    public function handle(): int
    {
        $pw = (string) $this->secret('Yonetici parolaniz (gizli; hicbir yere yazilmaz)');
        if ($pw === '') {
            $this->error('Parola bos; iptal edildi.');

            return self::FAILURE;
        }

        $reset = (bool) $this->option('reset');
        $victims = [];

        // ponytail: O(n) bcrypt dogrulama (uye basina ~cost-12 hash). Birkac bin uyede dakikalar
        // surer; tek-seferlik denetim icin kabul. Yonetici hesaplari (is_admin) atlanir -> hem
        // kendi parolasiyla eslesecekleri icin gurultu, hem reset'te yanlislikla kilitlenmesinler.
        User::query()
            ->whereNotNull('password')
            ->where('password', '!=', '')
            ->where('is_admin', false)
            ->orderBy('id')
            ->chunkById(500, function ($chunk) use ($pw, &$victims) {
                foreach ($chunk as $u) {
                    if (Hash::check($pw, $u->password)) {
                        $victims[] = $u;
                    }
                }
            });

        if (empty($victims)) {
            $this->info('Temiz: hicbir uye parolasi yoneticinin parolasiyla eslesmedi. Ezilen hesap yok.');

            return self::SUCCESS;
        }

        $this->warn(sprintf('%d uyenin parolasi YONETICI PAROLASIYLA ayni -> autofill ile ezilmis:', count($victims)));
        $this->table(
            ['id', 'nickname', 'email'],
            array_map(fn (User $u) => [$u->id, $u->nickname, $u->email], $victims),
        );

        if (! $reset) {
            $this->line('');
            $this->line('Sifirlamak icin tekrar --reset ile calistirin (parolalari unutma-akisina cevirir).');

            return self::SUCCESS;
        }

        foreach ($victims as $u) {
            // Kullanilamaz rastgele parola: kullanici "parolami unuttum" ile yeni parola kurar.
            $u->forceFill(['password' => Str::random(40)])->save();
        }
        $this->info(sprintf('%d uye parolasi sifirlandi; bu uyeler "parolami unuttum" ile giris kurmali.', count($victims)));

        return self::SUCCESS;
    }
}
