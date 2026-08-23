<?php

namespace Database\Seeders;

use App\Models\Content;
use Illuminate\Database\Seeder;

// Turnuva takvimi (event) — Turkiye/KKTC gercek tavla turnuvalari.
// Kaynak afislerden derlendi. Idempotent: title+type ile updateOrCreate.
class TournamentCalendarSeeder extends Seeder
{
    public function run(): void
    {
        // [title, event_at, place, province, contact, organizer, dateText]
        $events = [
            ['ÇATALCA BELEDİYESİ 25. Erguvan Festivali Tavla Turnuvası', '2026-08-28 10:00', 'Emekliler Lokali - Çatalca', 'İstanbul', 'Çatalca Belediyesi 444 61 02', 'Çatalca Belediyesi', '28-29 Ağustos 2026'],
            ['Ekincik Backgammon Tavla Turnuvası', '2026-08-21 10:00', 'Ekincik Beach Hotel - Köyceğiz', 'Muğla', 'Murat AKBULUT 0530 094 48 00', 'Modern Tavla Derneği', '21-22-23 Ağustos 2026'],
            ['Modern Tavla Kulübü Tavla Turnuvası', '2026-09-05 11:00', 'Bostancı Green Park Hotel', 'İstanbul', 'Oğün SEVİNDİK 0534 728 99 99', 'Modern Tavla Kulübü', '5-6 Eylül 2026, Pazar 11:00'],
            ['FMBGT 2026 / 5. FMGammon Açık Tavla Turnuvası', '2026-09-11 10:00', 'Wow Hotels Yeşilköy', 'İstanbul', 'C. Cenk ÇORBACIOĞLU 0532 427 94 54', 'FM Gammon Organizasyon', '11-12-13 Eylül 2026'],
            ['Big Master Backgammon Modern Tavla Turnuvası', '2026-09-11 10:00', 'Dolce Çeşme Alaçatı Hotel', 'İzmir', 'Çağlayan ARAS 0538 094 28 25', 'Big Master Backgammon', '11-12-13 Eylül 2026'],
            ['Manisa Büyükşehir Belediyesi 1. Tavla Turnuvası', '2026-09-17 14:30', 'Yeni Han', 'Manisa', 'Caner ÇELİK 0537 389 19 07', 'Manisa Büyükşehir Belediyesi', '17 Eylül 2026, Perşembe 14:30'],
            ['TTB 4. Eskişehir Açık Tavla Turnuvası', '2026-09-18 10:00', 'Ramada by Wyndham', 'Eskişehir', 'Caner ÇELİK 0537 389 19 07', 'Türkiye Tavla Birliği', '18-19-20 Eylül 2026'],
            ['İzmir Modern Tavla Kulübü 2026 Teras Turnuvaları 3', '2026-09-25 10:00', 'Svalinn Hotel Gaziemir', 'İzmir', 'Cafer ÖZTÜRKLER 0532 597 77 52', 'İzmir Modern Tavla Kulübü', '25-26-27 Eylül 2026'],
            ['5th Grand Pasha Open Backgammon Tournament', '2026-10-01 10:00', 'Grand Pasha Hotel Lefkoşa', 'KKTC', 'C. Cenk ÇORBACIOĞLU 0532 427 94 54', 'FM Gammon Organizasyon', '1-2-3 Ekim 2026'],
            ['WBF Türkiye UTT 2026 Bodrum Bölge Tavla Turnuvası', '2026-10-02 10:00', 'Delfi Otel - Bodrum', 'Muğla', 'Funda DOĞAN 0533 235 25 55', 'WBF Türkiye', '2-3-4 Ekim 2026'],
            ['FMBGT 2026 / 6. FMGammon Açık Tavla Turnuvası', '2026-10-09 10:00', 'Wow Hotels Yeşilköy', 'İstanbul', 'C. Cenk ÇORBACIOĞLU 0532 427 94 54', 'FM Gammon Organizasyon', '9-10-11 Ekim 2026'],
            ['TTB 11. Bursa Açık Tavla Turnuvası', '2026-10-23 10:00', 'Euro Park Hotel', 'Bursa', 'Caner ÇELİK 0537 389 19 07', 'Türkiye Tavla Birliği', '23-24-25 Ekim 2026'],
            ['25th Cyprus Open Backgammon Tournament', '2026-10-28 10:00', 'Grand Pasha Hotels Lefkoşa', 'KKTC', 'C. Cenk ÇORBACIOĞLU 0532 427 94 54', 'FM Gammon Organizasyon', '28 Ekim - 1 Kasım 2026'],
            ['İzmir Modern Tavla Kulübü Cumhuriyet Kupası Tavla Şöleni', '2026-10-30 10:00', 'Svalinn Hotel Gaziemir', 'İzmir', 'Cafer ÖZTÜRKLER 0532 597 77 52', 'İzmir Modern Tavla Kulübü', '30-31 Ekim / 1 Kasım 2026'],
            ['13. Merit Açık Uluslararası Tavla Şampiyonası', '2026-11-03 10:00', 'Merit Park Hotel & Casino - Girne', 'KKTC', 'Funda DOĞAN 0533 235 25 55', 'WBF Türkiye', '3-8 Kasım 2026'],
            ['TTB 2026 1. Samsun Açık Tavla Turnuvası', '2026-11-06 10:00', 'Ramada Hotel Samsun', 'Samsun', 'Caner ÇELİK 0537 389 19 07', 'Türkiye Tavla Birliği', '6-7-8 Kasım 2026'],
            ['TTB 2026 Süper Final Tavla Turnuvası', '2026-12-18 10:00', 'Radisson Blu Hotel', 'Sakarya', 'Caner ÇELİK 0537 389 19 07', 'Türkiye Tavla Birliği', '18-19-20 Aralık 2026'],
            ['WBF Türkiye UTT 2026 İstanbul Kış Bölge Tavla Turnuvası', '2026-12-25 10:00', 'Akgün Otel', 'İstanbul', 'Funda DOĞAN 0533 235 25 55', 'WBF Türkiye', '25-26-27 Aralık 2026'],
            ['WBF Türkiye 2027 Uluslararası İstanbul Açık Tavla Turnuvası', '2027-01-15 10:00', 'Akgün Otel', 'İstanbul', 'Funda DOĞAN 0533 235 25 55', 'WBF Türkiye', '15-16-17 Ocak 2027'],
        ];

        foreach ($events as $e) {
            [$title, $eventAt, $place, $province, $contact, $organizer, $dateText] = $e;
            Content::updateOrCreate(
                ['type' => 'event', 'title' => $title],
                [
                    'body' => $dateText.' · '.$place.' · '.$province,
                    'organizer' => $organizer,
                    'place' => $place,
                    'province' => $province,
                    'contact' => $contact,
                    'event_at' => $eventAt,
                    'published' => true,
                    'sort' => 0,
                ]
            );
        }
    }
}
