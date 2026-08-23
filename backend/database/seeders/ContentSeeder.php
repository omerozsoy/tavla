<?php

namespace Database\Seeders;

use App\Models\Content;
use Illuminate\Database\Seeder;

class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $body = <<<'TXT'
17 yıllık organizasyon deneyimimizle; kurumlara, şirketlere, derneklere, belediyelere, alışveriş merkezlerine ve özel gruplara yönelik profesyonel tavla turnuvası organizasyonu hizmeti sunuyoruz.

Her organizasyonu, katılımcı profili ve kurumun beklentileri doğrultusunda özel olarak planlıyor; geleneksel tavla takımlarından profesyonel turnuva ekipmanlarına kadar farklı seçeneklerle eksiksiz bir etkinlik deneyimi oluşturuyoruz.

Turnuvalarımız; katılımcı sayısı, etkinlik süresi ve organizasyonun yapısına göre farklı formatlarda kurgulanabilmektedir. Amacımız, rekabetin ve sosyal etkileşimin dengeli biçimde bir araya geldiği, tüm katılımcılar için keyifli ve yüksek standartlarda bir turnuva deneyimi sunmaktır.

Organizasyon sürecinde geleneksel torba kura sistemi veya dijital turnuva yönetim altyapısı kullanılabilmekte; eşleşmeler ve turnuva ilerleyişi dijital ortamda takip edilebilmektedir. Talep doğrultusunda seçili karşılaşmaların canlı yayınlanması, profesyonel tavla ekipmanlarının kullanılması ve turnuva programına özel yan etkinlikler ve sürpriz uygulamalar da organizasyona dahil edilebilmektedir.

Planlamadan turnuva yönetimine, ekipmanlardan sonuçlandırma sürecine kadar tüm aşamaları deneyimli ekibimizle yönetiyor; kurumunuza ve katılımcılarınıza özel, profesyonel ve unutulmaz bir organizasyon gerçekleştiriyoruz.

Tavlayı, profesyonel organizasyon deneyimiyle buluşturuyoruz.
TXT;

        Content::updateOrCreate(
            ['type' => 'service', 'title' => 'Tavla Turnuvası Organizasyonu'],
            ['body' => $body, 'published' => true, 'sort' => 0],
        );
    }
}
