<?php

namespace Database\Seeders;

use App\Models\Content;
use Illuminate\Database\Seeder;

// Tavla kulupleri rehberi (content type=club) — tavlatv.com/tavla-kulupleri'nden derlendi.
// Il'e gore gruplanip gosterilir. Idempotent: type+title ile updateOrCreate.
class ClubDirectorySeeder extends Seeder
{
    public function run(): void
    {
        // [title, province, contact]
        $clubs = [
            // İstanbul
            ['İstanbul Tavla Derneği (İstavder)', 'İstanbul', 'Caner Cenk Çorbacıoğlu 0532 427 94 54'],
            ['Elite Tavla Spor Kulübü Derneği', 'İstanbul', 'WBF Türkiye 0533 235 25 55'],
            ['Silivri Tavla Grubu', 'İstanbul', 'Tunç Çelik 0532 586 34 81'],
            ['Beylikdüzü Tavla Grubu', 'İstanbul', 'Şenol Yüksel 0532 335 02 54'],
            ['Kartal Tavla Grubu', 'İstanbul', 'Doğan Sunar 0532 335 02 54'],
            ['Tesadüf Tavla Grubu', 'İstanbul', 'Atilla İnanlı 0544 578 50 36'],
            ['Almondhill Tavla Grubu', 'İstanbul', 'Emrullah Coşar 0532 618 33 99'],
            ['Adalar Tavla Grubu', 'İstanbul', 'Benan Müsselim 0505 802 23 73'],

            // İzmir
            ['İzmir Tavla Derneği', 'İzmir', 'Hilmi Göçhan 0532 432 77 77'],
            ['İzmir Modern Tavla Derneği', 'İzmir', 'Cafer Öztürker'],
            ['Alsancak Tavla Derneği', 'İzmir', 'Kadri Almaç 0533 724 ...'],

            // Ankara
            ['Ankara Tavla Kulübü', 'Ankara', 'Onur Vurur 0533 663 08 50'],
            ['Başkent Tavla Derneği', 'Ankara', 'Ozan Gündoğdu 0532 696 46 11'],
            ['Ankara WBF Tavla Grubu', 'Ankara', 'Cemalettin Karakütük 0506 700 64 81 / Zafer Önder 0533 526 21 38'],

            // Bursa
            ['Bursa Tavla Derneği', 'Bursa', 'İbrahim Terzi 0541 446 07 10'],
            ['Bursa Modern Tavla', 'Bursa', 'Aysel Güzel 0532 798 98 79'],

            // Sakarya
            ['Sakarya Tavla Spor Kulübü', 'Sakarya', 'Ufuk Aksak 0533 532 85 15 / Burhan Yılmazer 0532 293 46 66'],

            // Kocaeli
            ['Kocaeli WBF Tavla Grubu', 'Kocaeli', 'Güral Bulut 0541 880 40 01'],
            ['Kocaeli Tavla Grubu', 'Kocaeli', 'Caner Çelik 0537 389 19 07'],

            // Eskişehir
            ['Eskişehir Modern Tavla Kulübü', 'Eskişehir', 'Mehmet Ali Yaşar 0544 281 15 88'],

            // Muğla
            ['Marmaris Tavla Derneği', 'Muğla', 'Ayla Karmen Aydın 0532 332 67 25'],
            ['Marmaris VIP Backgammon Grubu', 'Muğla', 'Levent Postoğlu 0537 724 28 58'],
            ['Bodrum Tavla Kulübü', 'Muğla', 'Zafer Taş 0506 179 90 88'],
            ['Bodrum Modern Tavla Derneği', 'Muğla', 'Erdoğan Kılıç 0532 433 87 20'],
            ['Fethiye Tavla Spor Kulübü', 'Muğla', 'Hüseyin Özdağ 0535 210 03 55'],
            ['Ortaca Modern Tavla Spor Kulübü', 'Muğla', 'İzzettin Gülşen 0505 236 37 99'],
            ['Köyceğiz Modern Tavla Derneği', 'Muğla', 'Murat Akbulut 0530 094 48 00'],

            // Tekirdağ
            ['Tekirdağ Tavla Kulübü', 'Tekirdağ', 'Bülent Yorulmaz 0554 829 38 02'],

            // Hatay
            ['Hatay Tavla Spor Kulübü', 'Hatay', 'Hüseyin Güler 0532 221 57 58 / Hüseyin Güzel 0545 507 05 86'],
            ['Hatay Modern Tavla Spor Kulübü Derneği', 'Hatay', 'Sinan Kırıkçı 0537 385 37 45 / Ekrem Şakir'],

            // Edirne
            ['Edirne Tavla Derneği', 'Edirne', 'Mehmet Başkut 0542 847 26 99'],

            // Aydın
            ['Kuşadası WBF Tavla Grubu', 'Aydın', 'Ümit Bata 0539 211 21 11'],

            // Samsun
            ['Samsun Modern Tavla', 'Samsun', 'Berdiya Özgenç 0542 574 05 57 / M. Amin Shafiei 0543 947 17 56'],

            // Rize
            ['Rize Tavla Topluluğu', 'Rize', 'Saliha Nur Yılmaz 0552 856 53 06'],

            // Adana
            ['Adana Tavla Grubu', 'Adana', 'Berkant Bilgi 0533 925 13 29'],

            // Antalya
            ['Antalya Tavla Grubu', 'Antalya', 'Emre Edip Akduman 0532 391 88 64'],

            // Gaziantep
            ['Gaziantep Tavla Grubu', 'Gaziantep', 'Fuat Hakan Uncuoğlu 0532 449 64 94'],

            // Şırnak
            ['Şırnak Tavla Grubu', 'Şırnak', 'Hüseyin Moran 0541 749 52 90'],
        ];

        foreach ($clubs as $c) {
            [$title, $province, $contact] = $c;
            Content::updateOrCreate(
                ['type' => 'club', 'title' => $title],
                [
                    'province' => $province,
                    'contact' => $contact,
                    'published' => true,
                    'sort' => 0,
                ]
            );
        }
    }
}
