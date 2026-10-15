<?php

namespace Tests\Feature;

use App\Models\FooterLink;
use App\Models\InfoPage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// CMS (Bilgi Sayfaları) footer sayfalarının footer_links'e materyalize edilmesi:
// section=footer:<kolon> -> cms-<slug> satırı oluşur; section kalkınca budanır; defaultLabel=başlık.
class FooterCmsSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_cms_footer_page_materializes_as_footer_link_row(): void
    {
        $page = InfoPage::create(['slug' => 'sure-nasil-isler', 'title' => 'Süre Nasıl İşler', 'section' => 'footer:info']);

        FooterLink::syncCmsRows();

        $row = FooterLink::where('item_key', 'cms-sure-nasil-isler')->first();
        $this->assertNotNull($row);
        $this->assertSame('info', $row->column_key);
        $this->assertTrue((bool) $row->visible);
        $this->assertSame('Süre Nasıl İşler', $row->defaultLabel()); // başlıktan çözülür

        // İkinci senkron -> yeni satır oluşmaz (idempotent).
        FooterLink::syncCmsRows();
        $this->assertSame(1, FooterLink::where('item_key', 'cms-sure-nasil-isler')->count());

        // Admin footer-links'ten kolonu/sırayı değiştirdi -> senkron EZMEMELİ.
        $row->update(['column_key' => 'guide', 'sort' => 2]);
        FooterLink::syncCmsRows();
        $this->assertSame('guide', FooterLink::where('item_key', 'cms-sure-nasil-isler')->first()->column_key);

        // Üst başlık kaldırıldı -> satır budanır.
        $page->update(['section' => null]);
        FooterLink::syncCmsRows();
        $this->assertNull(FooterLink::where('item_key', 'cms-sure-nasil-isler')->first());
    }
}
