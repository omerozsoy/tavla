import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import ArticleBoard from './ArticleBoard'
import type { GameState } from '../engine/types'
import Breadcrumb, { homeCrumb } from './Breadcrumb'
import { useT } from '../i18n'

type FaqItem = {
  id: string
  question: string
  answer: string
  keywords?: string
}

type FaqVisual = { kind: 'image'; src: string; alt: string; caption?: string } | { kind: 'images'; src: string[]; alt: string; caption?: string } | { kind: 'board'; state: GameState; caption: string }

type FaqSection = {
  id: string
  label: string
  intro: string
  items: FaqItem[]
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'temel-kurallar',
    label: 'Temel kurallar',
    intro: 'Oyunun amacı, tahta düzeni, zarlar ve taşların hareketiyle ilgili hızlı cevaplar.',
    items: [
      { id: 'tavla-nedir', question: 'Tavla nedir ve nasıl kazanılır?', answer: 'Tavla iki oyuncunun on beşer taşı, iki zar ve yirmi dört haneden oluşan tahta üzerinde oynadığı bir yarış ve pozisyon oyunudur. Amaç bütün taşlarını kendi iç tahtana getirip rakibinden önce toplamaktır. Rakibin açık taşlarını vurmak ve kapılar kurmak ilerlemeyi zorlaştırır.', keywords: 'backgammon amaç oyun' },
      { id: 'tavla-icin-ne-gerekir', question: 'Tavla oynamak için hangi ekipman gerekir?', answer: 'Standart oyun için bir tavla tahtası, iki renkte toplam otuz taş ve iki zar yeterlidir. Fiziksel oyunda zar kabı ve katlama küpü de kullanılabilir. TavlaTV’de tahta, taşlar, zarlar ve küp oyun arayüzünde hazırdır; fiziksel ekipmana ihtiyaç yoktur.', keywords: 'ekipman taş zar küp' },
      { id: 'tavla-taslari-nasil-dizilir', question: 'Tavla taşları başlangıçta nasıl dizilir?', answer: 'Her oyuncunun başlangıç dizilişi 24 hanedeki 2, 5, 3 ve 5 taşlık dört yığından oluşur. Oyuncular birbirine zıt yönde ilerler ve kendi iç tahtalarında taş toplamaya çalışır. Tahtanın yönü değişse de iki oyuncunun diziliş mantığı aynıdır.', keywords: 'başlangıç dizilişi setup' },
      { id: 'kim-baslar', question: 'Tavlada kim başlar?', answer: 'İki oyuncu birer zar atar. Büyük atan ilk turu başlatır ve atılan iki sayıyı kullanır. Zarlar eşitse yeniden atılır. Bu yüzden ilk turu başlatan oyuncu, başlangıç atışında çift zar kullanmaz.', keywords: 'ilk hamle başlangıç zarı' },
      { id: 'tavlada-amac', question: 'Tavlada oyunun amacı nedir?', answer: 'On beş taşını önce kendi iç tahtana taşımak, ardından hepsini tahtadan toplamaktır. Son taşını da çıkaran oyuncu oyunu kazanır. Maç formatında ise tek oyunun puanı, maçın hedef skoruna eklenir.', keywords: 'amaç taş toplama' },
      { id: 'mars-ve-backgammon', question: 'Mars ve backgammon arasındaki fark nedir?', answer: 'Rakip hiç taş toplamadan bütün taşlarını çıkarırsan mars kazanırsın ve sonuç iki oyun değerindedir. Rakibin hâlâ senin iç tahtanda veya barda taşı varsa sonuç backgammon sayılır ve üç oyun değerindedir. Küp kullanılıyorsa bu değerler küp katsayısıyla çarpılır.', keywords: 'gammon mars backgammon' },
      { id: 'bar-nedir', question: 'Tavlada bar nedir?', answer: 'Bar, tahtanın ortasındaki yükseltilmiş bölmedir. Vurulan taşlar geçici olarak buraya konur. Barda taşın varsa başka bir taşını oynatmadan önce onu rakibin iç tahtasındaki uygun haneye sokman gerekir.', keywords: 'bar vurulan taş' },
      { id: 'ic-dis-tahta', question: 'İç tahta ve dış tahta nedir?', answer: 'Barın iki tarafındaki tahtalar iç ve dış tahta olarak adlandırılır. İç tahta, taşların toplandığı son bölgedir; dış tahta ise taşların oraya ulaşmadan geçtiği alandır. Hangi tarafın iç tahta olduğu, oyuncunun ilerleme yönüne göre değişir.', keywords: 'inner board outer board' },
      { id: 'orta-nokta', question: 'Orta nokta ve bar noktası ne demektir?', answer: 'Orta nokta, başlangıçta beş taş bulunan 13. hanedir. Bar noktası ise bara komşu 7. hanedir ve başlangıçta boş olur. Bu adlar analizlerde ve hamle notasyonunda sık kullanılır.', keywords: 'midpoint bar point 13 nokta 7 nokta' },
      { id: 'ace-point', question: 'Ace point hangi hanedir?', answer: 'Ace point, oyuncunun iç tahtasındaki 1. hanedir. Taş toplamadan önce ulaşabileceği son hanedir. Türkçe konuşmada genellikle bir noktası veya bir hanesi olarak da ifade edilir.', keywords: 'one point 1 noktası' },
      { id: 'zarlar-nasil-oynanir', question: 'İki zar nasıl oynanır?', answer: 'Zarlardaki iki sayı iki ayrı hamle olarak kullanılır. Bir taşı iki zarın toplamı kadar oynatmak mümkündür; ancak ara durak da açık olmalıdır. Çift zar gelirse sayı dört kez oynanır. Her iki sayıyı yasal olarak kullanabiliyorsan ikisini de oynamalısın.', keywords: 'zar çift zar hamle' },
      { id: 'tek-sayi-oynanirsa', question: 'Sadece tek zar oynanabiliyorsa hangi sayı kullanılır?', answer: 'İki sayıdan yalnızca biri oynanabiliyorsa büyük sayı kullanılır. Daha küçük sayı yasal, büyük sayı oynanamaz durumdaysa küçük sayı oynanır. Dört sayıdan yalnızca iki veya üçü oynanabiliyorsa mümkün olan en fazla sayıda hamle yapılır.', keywords: 'tek zar yüksek sayı' },
      { id: 'pas-gecilebilir-mi', question: 'Tavlada pas geçilebilir mi?', answer: 'Yasal bir hamle yapabiliyorsan pas geçemezsin. Zarların tamamını kullanamıyorsan kullanılabilen sayıları oynaman gerekir. Hiçbir yasal hamle yoksa sıra otomatik olarak rakibe geçer.', keywords: 'pas geçmek zorunlu hamle' },
      { id: 'taslar-ne-zaman-toplanir', question: 'Taşlar ne zaman toplanabilir?', answer: 'On beş taşının tamamı kendi iç tahtana geldiğinde toplamaya başlayabilirsin. Bir taşın bulunmadığı haneye gelen zar, daha uzakta taşın yoksa uygun en uzaktaki taşı çıkarmak için kullanılabilir. Rakip taşı iç tahtanda bırakırsa toplama geçici olarak durur.', keywords: 'bearing off taş toplama' },
      { id: 'hanede-kac-tas-olabilir', question: 'Bir hanede beşten fazla taş olabilir mi?', answer: 'Evet. Standart tavlada bir hanedeki taş sayısı beşle sınırlı değildir. Görsel olarak yığılması gerekse de kurallar açısından aynı hanede daha fazla taş bulunabilir.', keywords: 'kapı taş sayısı' },
    ],
  },
  {
    id: 'hamle-ve-pozisyon',
    label: 'Hamle ve pozisyon',
    intro: 'Açık taş, kapı, prime ve güvenli hamle gibi oyunun temel pozisyon kavramları.',
    items: [
      { id: 'acik-tas-blot', question: 'Açık taş veya blot nedir?', answer: 'Bir hanede tek başına duran taş blot olarak adlandırılır. Rakip o haneye tam bir zarla ulaşabiliyorsa taş vurulabilir ve bara gönderilir. Blot bazen risk, bazen de rakibin ilerlemesini kesmek için bilinçli bir yem olarak kullanılır.', keywords: 'blot açık taş' },
      { id: 'kapi-yapmak', question: 'Bir kapı yapmak ne demektir?', answer: 'Bir hanede aynı renkten en az iki taş bulundurarak rakibin o haneye inmesini engellemeye kapı yapmak denir. Kapılar savunma hattı kurar, rakibin seçeneklerini azaltır ve vurulan taşın oyuna dönmesini zorlaştırır.', keywords: 'make a point kapı' },
      { id: 'prime-nedir', question: 'Prime nedir?', answer: 'Arka arkaya kurulmuş kapılardan oluşan kesintisiz duvara prime denir. Altı kapılık bir prime rakibin taşını tamamen hapsedebilir. Daha kısa primeler de ilerlemeyi yavaşlatmak ve güvenli hamle alanı yaratmak için değerlidir.', keywords: 'prime blok duvar' },
      { id: 'ev-tahtasi', question: 'Ev tahtası veya home board nedir?', answer: 'Her oyuncunun taşlarını topladığı son altı hane kendi ev tahtasıdır. Rakibin vurulan taşını oyuna sokması gereken bölge de senin ev tahtandır. Bu nedenle ev tahtasındaki kapılar saldırı ve savunmada ayrı önem taşır.', keywords: 'home board iç tahta' },
      { id: 'kapali-tahta', question: 'Kapalı tahta ne demektir?', answer: 'Bir oyuncunun iç tahtasındaki altı hanenin tamamında en az iki taş bulunmasına kapalı tahta denir. Rakibin barda taşı varsa bu yapı, rakibin tekrar oyuna girmesini engelleyebilir.', keywords: 'closed board kapalı tahta' },
      { id: 'vur-ve-kac', question: 'Vurup aynı taşı güvenli yere kaçırabilir miyim?', answer: 'Standart tavlada evet. Bir taşı vurduktan sonra ikinci zarla aynı taşı güvenli bir haneye götürebilirsin; buna hit-and-run veya pick-and-pass denir. Bazı bölgesel tavla türlerinde farklı kurallar olabilir.', keywords: 'hit and run pick and pass' },
      { id: 'zar-kapali-gelirse', question: 'Zar tahtanın üzerine düzgün düşmezse ne olur?', answer: 'Zar eğik durur, taşın üzerine gelir veya tahtadan çıkarsa atış geçersiz sayılabilir; buna cocked dice denir. Fiziksel oyunda zarlar yeniden atılır. TavlaTV’de zar atışının geçerliliğini uygulama kuralları belirler.', keywords: 'cocked dice eğik zar' },
      { id: 'yasa-disi-hamle', question: 'Yasa dışı hamle yaparsam ne olur?', answer: 'Fiziksel oyunda durum fark edildiğinde hamle, oyunun kurallarına ve turnuva düzenine göre geri alınır veya hakem kararıyla düzeltilir. TavlaTV’de hamle motoru yalnızca yasal hamlelere izin verir; geçersiz hamle sunucuya işlenmez.', keywords: 'illegal move geçersiz hamle' },
      { id: 'hamle-notasyonu', question: 'Tavla hamleleri nasıl yazılır?', answer: 'Yaygın notasyonda haneler 24’ten 1’e doğru numaralanır ve taşın çıktığı hane ile vardığı hane eğik çizgiyle gösterilir. Örneğin 13/8, 13. haneden 8. haneye hareketi anlatır. Çıkış için genellikle “off” kullanılır.', keywords: 'notasyon hamle yazımı' },
    ],
  },
  {
    id: 'kupu-ve-oyun-formatlari',
    label: 'Katlama küpü ve oyun formatları',
    intro: 'Genel tavla kuralları ile TavlaTV’deki küp, bahis ve oyun türlerini birbirinden ayıran açıklamalar.',
    items: [
      { id: 'katlama-kupu-nedir', question: 'Katlama küpü nedir?', answer: 'Katlama küpü, oyunun başlangıç değerini ve teklif edilen puanı gösteren üzeri 2’nin kuvvetleriyle numaralanmış küptür. Bir oyuncu değer önerdiğinde rakip kabul edebilir veya oyunu bırakabilir. Küpün kullanımı, oynanan formatın kural setine bağlıdır.', keywords: 'doubling cube küp katlama' },
      { id: 'kupu-ne-zaman-kullanilir', question: 'Katlama küpü nasıl kullanılır?', answer: 'Sırası gelen oyuncu zar atmadan önce oyunun değerini iki katına çıkarmayı teklif eder. Rakip kabul ederse küp rakibe geçer ve ileride yeniden katlanabilir; reddederse teklif eden mevcut değer üzerinden oyunu kazanır. Küp kararı pozisyon, kazanma olasılığı ve skorla birlikte değerlendirilir.', keywords: 'double take pass redouble' },
      { id: 'bara-kapaliysa-kup', question: 'Bardayken veya kapalı tahtaya karşı küp teklif edilebilir mi?', answer: 'Genel kurallarda küp teklifinin zamanı ve kimin teklif edebileceği oynanan kurallara göre değerlendirilir; kritik ölçüt, oyuncunun o turda teklif hakkına sahip olmasıdır. TavlaTV’de küp akışı oyunun sunucu tarafından yönetilen kurallarıyla sınırlandırılır ve uygunsuz teklif gönderilemez.', keywords: 'bar closed out cube' },
      { id: 'otomatik-katlama', question: 'Otomatik double nedir?', answer: 'Bazı para oyunu kurallarında açılış zarları çift geldiğinde değer otomatik olarak iki katına çıkar. Bu, standart tavlanın her formatında zorunlu değildir. TavlaTV’de otomatik katlama veya benzeri kuralın geçerli olup olmadığı maç ekranındaki format tarafından belirlenir; sitede olmayan bir kural varsayılmamalıdır.', keywords: 'automatic double' },
      { id: 'jacoby-ve-beaver', question: 'Jacoby kuralı ve beaver nedir?', answer: 'Jacoby kuralı, para oyununda mars ve backgammon değerlerinin ancak küp kullanıldıktan sonra sayılmasını öngören isteğe bağlı bir kuraldır. Beaver ise bazı para oyunu çevrelerinde kabul edilen, rakibin katlamasına hemen yeniden katlama teklifidir. Bunlar standart her oyunun zorunlu parçası değildir ve TavlaTV’nin maç kurallarıyla karıştırılmamalıdır.', keywords: 'Jacoby beaver para oyunu' },
      { id: 'para-oyunu-mac-oyunu', question: 'Para oyunu ile maç oyunu arasındaki fark nedir?', answer: 'Para oyununda her oyun kendi puan değeriyle değerlendirilir ve taraflar belirli bir hedef skora ulaşmaya çalışmaz. Maç oyununda önceden belirlenen hedef puana ilk ulaşan kazanır; skor, Crawford gibi maç kuralları ve küp kararlarını etkiler. TavlaTV’de maç ve tek oyun seçenekleri ayrı akışlardır.', keywords: 'money play match play' },
      { id: 'bahis-tavla-tv', question: 'TavlaTV’de bahis ve oyun değeri nasıl çalışır?', answer: 'TavlaTV’de bahisli oyun ile ratingli oyun aynı şey değildir. Oda kurulumunda desteklenen sabit coin bahsi veya bakiye yüzdesi varsa bu, eşleşme ve sonuç hesaplamasına göre sunulur. Arkadaş davetli oyunlar ve puansız oyunlar rating yarışması olarak anlatılmamalıdır; ekranda sunulmayan bir bahis özelliği yoktur.', keywords: 'bahis coin stake rating' },
      { id: 'chouette-nedir', question: 'Chouette nedir?', answer: 'Chouette, birden fazla oyuncunun sırayla tek bir oyuncuya veya kaptana karşı oynadığı sosyal tavla formatıdır. Sıra ve küp yönetimi masa kurallarına göre değişebilir. TavlaTV’nin bire bir oyun akışında chouette masası bulunmuyorsa bu yalnızca genel tavla bilgisidir.', keywords: 'chouette çok oyunculu' },
    ],
  },
  {
    id: 'farkli-tavla-turleri',
    label: 'Farklı tavla türleri',
    intro: 'Kaynak FAQ’da geçen, standart tavladan farklı başlangıç veya hamle kuralları kullanan oyunlar.',
    items: [
      { id: 'tavli-nedir', question: 'Tavli nedir?', answer: 'Tavli, özellikle Yunanistan’da kullanılan ve birden fazla oyunun aynı gelenek içinde oynandığı tavla ailesinin genel adıdır. Portes, plakoto ve fevga bu geleneğin yaygın oyunlarındandır. Kuralları standart backgammon ile bire bir aynı değildir.', keywords: 'tavli yunan tavlası' },
      { id: 'nackgammon', question: 'Nackgammon nedir?', answer: 'Nackgammon, standart başlangıç dizilişinin değiştirilmiş bir varyantıdır. Bazı taşlar daha geride veya farklı noktalarda başlar; bu da açılış kararlarını ve oyun planını değiştirir. Temel hareket ve toplama mantığı yine tavlaya dayanır.', keywords: 'nackgammon varyant' },
      { id: 'hyper-backgammon', question: 'Hyper-backgammon nedir?', answer: 'Hyper-backgammon’da her oyuncu daha az sayıda taşla ve genellikle daha kısa bir başlangıç düzeniyle oynar. Oyun çok hızlı ilerler ve tek bir vuruşun etkisi büyür. Standart tavla stratejilerini aynen aktarmak doğru değildir.', keywords: 'hyper backgammon hızlı' },
      { id: 'acey-deucey', question: 'Acey-deucey nedir?', answer: 'Acey-deucey, tavlanın zar ve ilerleme fikrini kullanan, ancak başlangıç, çift zar ve ek hamle kuralları değişebilen bir varyant ailesidir. Amerikan ve Avrupa uygulamaları arasında bile farklar bulunur; oynanmadan önce masa kuralı netleştirilmelidir.', keywords: 'acey deucey varyant' },
      { id: 'long-gammon', question: 'Long-gammon nedir?', answer: 'Long-gammon, başlangıç dizilişinde iki oyuncunun taşlarının daha uzun bir hat oluşturduğu varyantlardan biridir. Taşların ilk yerleri standart oyundan farklı olduğu için açılış stratejisi ve temas noktaları değişir.', keywords: 'long gammon' },
      { id: 'roll-over-ve-kaybetme', question: 'Roll-over ve backgammon-to-lose ne demektir?', answer: 'Roll-over bazı varyantlarda çift zarın yeniden zar atma veya ek hareket üretmesi gibi özel bir kuralı ifade eder. Backgammon-to-lose ise amaç sırasının ters çevrildiği, rakibin önce taşlarını çıkarmasının avantaj sağladığı bir oyundur. Bunlar TavlaTV standart maçının kuralları değildir.', keywords: 'roll over backgammon to lose' },
    ],
  },
  {
    id: 'mac-oyunu',
    label: 'Maç oyunu',
    intro: 'Hedef skor, Crawford kuralı, maç eşitliği ve küp kararlarının temel çerçevesi.',
    items: [
      { id: 'mac-oyunu-nedir', question: 'Maç oyunu nedir?', answer: 'Maç oyununda oyuncular tek bir oyunun değil, önceden belirlenen hedef puana ilk ulaşmanın peşindedir. Mars, backgammon ve küp sonucu skora farklı miktarlarda eklenebilir. TavlaTV’de bir maçın hedefi ve skor durumu oyun ekranında gösterilir.', keywords: 'match play maç skoru' },
      { id: 'kazanma-farki-onemli-mi', question: 'Maçı kaç puan farkla kazandığım önemli mi?', answer: 'Maç oyununda belirleyici olan hedef skora kimin önce ulaştığıdır. Ancak tek oyunun mars veya backgammon olması skorun daha hızlı ilerlemesini sağlar. Kazanma farkı rating veya sonuç ekranında ayrıca kullanılıyorsa bu, TavlaTV’nin kendi hesaplama kuralıdır; genel maç kuralı olarak düşünülmemelidir.', keywords: 'maç fark puan' },
      { id: 'crawford-kurali', question: 'Crawford kuralı nedir?', answer: 'Bir oyuncu maçın kazanma skoruna bir puan kala, oynanan sonraki oyuna Crawford oyunu denir. Bu oyunda katlama küpü kullanılmaz. Bu kuralın uygulanıp uygulanmadığı turnuva veya maç formatına bağlıdır; TavlaTV’de ilgili format destekliyorsa oyun ekranı bunu yönetir.', keywords: 'Crawford kuralı son bir puan' },
      { id: 'holland-kurali', question: 'Holland kuralı nedir?', answer: 'Holland kuralı, Crawford sonrasındaki bazı maç durumlarında küp kullanım zamanını değiştiren isteğe bağlı bir turnuva kuralıdır. Standart her maçın parçası değildir; TavlaTV’de açıkça belirtilmeyen bir maçta kendiliğinden uygulanmaz.', keywords: 'Holland rule' },
      { id: 'mac-esitlik-tablosu', question: 'Match equity table ne işe yarar?', answer: 'Maç eşitlik tablosu, belirli bir skor durumunda iki oyuncunun maçı kazanma olasılığını tahmin etmek için kullanılır. Taş pozisyonundan bağımsız, skor ve hedefe kalan puan üzerinden stratejik bir çerçeve sağlar. TavlaTV bu tabloyu oyuncuya doğrudan göstermiyorsa, bu gelişmiş bir analiz kavramıdır.', keywords: 'match equity table MET' },
      { id: 'bir-uzak', question: '1-away ne demektir?', answer: '1-away, oyuncunun maçı kazanmak için yalnızca bir puana ihtiyaç duyduğu skor durumudur. Bu konumda rakibin küp teklifini kabul edip etmeme kararı ve mars ihtimali normal oyundan farklı değerlendirilir.', keywords: '1-away skor' },
      { id: 'iki-uzak', question: '2-away 2-away ne demektir?', answer: 'Her iki oyuncunun da kazanmak için iki puana ihtiyaç duyduğu maç skorudur. Tek oyun galibiyeti hedefe ulaşmaya yetmeyebileceği için küp ve mars kararları skorun etkisiyle değişir.', keywords: '2-away 2-away skor' },
      { id: 'take-point', question: 'Take point nedir?', answer: 'Take point, bir küp teklifini kabul etmenin uzun vadede pas geçmekten daha iyi hale geldiği yaklaşık eşiktir. Maç skoru, mars olasılığı, küp değeri ve pozisyon bu eşiği değiştirir. Tek bir sabit yüzde her pozisyona uygulanamaz.', keywords: 'take point kabul eşiği' },
      { id: 'zorunlu-double', question: 'Mandatory double veya zorunlu double nedir?', answer: 'Bazı maç skorlarında küpü kullanmamak stratejik olarak büyük kayıp yaratır; bu nedenle oyuncular böyle bir teklife zorunlu double der. Bu bir yazılım komutu değil, skor ve olasılık temelli bir strateji ifadesidir.', keywords: 'mandatory double zorunlu katlama' },
    ],
  },
  {
    id: 'rating-ve-tavlatv',
    label: 'Rating ve TavlaTV',
    intro: 'Kaynak rating başlıklarını, TavlaTV’nin gerçek puanlı ve puansız oyun akışıyla birlikte okuyun.',
    items: [
      { id: 'rating-nasil-calisir', question: 'Rating nasıl çalışır?', answer: 'Rating, oyuncuların göreli oyun gücünü sonuçlara göre karşılaştıran bir puandır. Güçlü bir rakibe karşı beklenenden iyi sonuç almak puanı artırabilir; daha düşük ratingli rakibe kaybetmek daha büyük düşüşe yol açabilir. TavlaTV’de bu puan yalnız ratingli oyun akışlarının sonucunda güncellenir.', keywords: 'Elo rating puan' },
      { id: 'rating-nasil-kazanilir', question: 'TavlaTV’de rating nasıl kazanılır?', answer: 'Rating kazanmak için TavlaTV’nin puanlı/ranked oyun akışında oynayıp maç sonucunu tamamlaman gerekir. Arkadaş davetli veya friendly oyunlar eğlence ve pratik içindir; rating yarışına dahil edilmez. Misafir oyununun ratinge etkisi de kullanıcı oturumuna ve maç türüne bağlıdır.', keywords: 'rating ranked puanlı oyun' },
      { id: 'rating-ne-anlatir', question: 'Ratingim neyi gösterir?', answer: 'Rating, uzun vadede rakiplere karşı beklenen performansını özetleyen göreli bir göstergedir; tek bir maçın veya tek bir zar serisinin kesin ölçüsü değildir. Daha yüksek rating her pozisyonda otomatik olarak daha iyi hamle anlamına gelmez.', keywords: 'rating anlamı seviye' },
      { id: 'ratingi-ne-etkiler', question: 'Ratingi hangi faktörler etkiler?', answer: 'TavlaTV’de puanlı oyunun sonucu, rakibin ratingi ve oynanan maç/oyun formatı puan değişiminin temel girdileridir. Maçın kazanılması, kaybedilmesi veya sunucu tarafından tamamlanma biçimi de sonuç kaydını etkiler.', keywords: 'rating rakip sonuç maç uzunluğu' },
      { id: 'ratingi-ne-etkilemez', question: 'Ratingi neler etkilemez?', answer: 'Bir oyunda atılan tek bir zar, gösterişli bir hamle, PR analiz puanı veya coin bakiyesi doğrudan rating değildir. PR, hamle kalitesini analiz eder; rating ise oyuncuların sonuçlara dayalı göreli sıralamasıdır. Bu iki sayıyı aynı ölçek gibi okumamak gerekir.', keywords: 'PR rating farkı zar coin' },
      { id: 'friendly-ve-ranked', question: 'Friendly oyun ile ranked oyun arasındaki fark nedir?', answer: 'Ranked oyun, ratinge dayalı rekabetçi eşleşme akışıdır. Friendly oyun, arkadaş daveti veya puansız özel oyun gibi rating dışında kalan akıştır. TavlaTV’nin oda verisindeki oyun modu bu ayrımı belirler; kullanıcı arayüzünde görünmeyen bir özelliği varsaymamak gerekir.', keywords: 'friendly ranked özel oyun' },
      { id: 'rating-ve-pr', question: 'Rating ile PR arasındaki fark nedir?', answer: 'Rating, sonuçlardan ve rakip gücünden türeyen uzun dönemli göreli puandır. PR ise maç analizinde hamle ve küp kararlarının motor değerlendirmesine ne kadar yakın olduğunu anlatan performans ölçüsüdür. İyi PR tek maçta rating artışını garanti etmez.', keywords: 'performance rating PR analiz' },
      { id: 'rating-dususleri', question: 'Ratingim neden bir maçta düşebilir?', answer: 'Rating sistemi sonucu olasılıksal olarak değerlendirir; senden daha düşük ratingli bir rakibe kaybetmek beklenmedik sonuç sayılabilir. Zar şansı tek maçın sonucunu etkileyebilir, ancak ratingin amacı uzun serilerde göreli gücü dengelemektir.', keywords: 'rating kaybı düşüş' },
    ],
  },
]

// Kaynak FAQ'daki tüm başlıklar için tamamlayıcı maddeler. Ana listede zaten
// bulunan başlıklar tekrar edilmez; burada kalan niş maddeler de özgün, kısa
// Türkçe cevaplarla aynı soru-cevap modeline alınır.
const SOURCE_COVERAGE: Record<string, FaqItem[]> = {
  'temel-kurallar': [
    { id: 'tam-kurallar-nerede', question: 'Tavlanın tam kurallarına nereden ulaşabilirim?', answer: 'Standart oyunun temel akışı bu sayfada özetlenir. Hamle ayrıntıları, turnuva uygulamaları ve istisnalar için TavlaTV’nin Nasıl Oynanır rehberini ve turnuva kurallarını birlikte okumak en sağlıklı yoldur.', keywords: 'complete rules tam kurallar' },
    { id: 'dusuk-zar-once', question: 'Taş toplarken düşük zarı önce oynayabilir miyim?', answer: 'Evet. Her iki zar da yasal olarak kullanılabiliyorsa sıra seçilebilir. Düşük zarı önce oynamak, yüksek zarın daha sonra yasal kalmasını sağladığı sürece geçerlidir.', keywords: 'low number bearing off düşük zar toplama' },
    { id: 'pat-stalemate', question: 'Tavlada pat veya stalemate olur mu?', answer: 'Standart tavlada satrançtaki gibi ayrı bir pat sonucu yoktur. Oyuncu yasal hamle yapamıyorsa o tur oynayamaz; oyun taşlar toplanana veya kurallara göre sonuçlanana kadar devam eder.', keywords: 'stalemate pat' },
    { id: 'zar-nasil-atilir', question: 'Zar nasıl atılmalıdır?', answer: 'Fiziksel oyunda iki zar birlikte, tahtaya ve yüzeyde yuvarlanacak şekilde atılır. Zarların ikisi de düz ve okunabilir durmalıdır. TavlaTV’de zar üretimi ve geçerliliği uygulamanın oyun motoru tarafından yönetilir.', keywords: 'roll dice zar atmak' },
    { id: 'touch-move', question: 'Tavlada touch-move, yani dokunma-hamle kuralı var mı?', answer: 'Fiziksel masalarda dokunma-hamle uygulaması masa veya turnuva kuralına göre değişebilir. TavlaTV’de taş sürükleme ve hamle onayı arayüzün geçerli hamle akışına bağlıdır; dokunulan her taşın zorunlu oynanacağı varsayılmaz.', keywords: 'touch move dokunma hamle' },
    { id: 'tur-ne-zaman-biter', question: 'Bir tur ne zaman biter?', answer: 'Oyuncu zarlarının tümünü oynadığında, oynayabildiği kadarını tamamladığında veya yasal hamle kalmadığında tur biter. Hamle tamamlanınca sıra rakibe geçer.', keywords: 'turn over sıra bitişi' },
    { id: '24-hane-numarasi', question: '24 haneli numaralandırma sistemi nedir?', answer: 'Her oyuncunun kendi bakış açısından en uzak hane 24, taş topladığı son hane 1 olarak numaralanır. İki oyuncunun perspektifi ters yönde olsa da hamle notasyonu bu standartla okunur.', keywords: '24 point numbering hane numarası' },
    { id: 'oyun-transkripti', question: 'Tavla oyun transkripti nedir?', answer: 'Transkript, zarları, hamleleri, küp tekliflerini ve oyun sonucunu sırayla kaydeden metindir. Maçı sonradan incelemek, analiz aracına aktarmak veya tartışmalı bir hamleyi kontrol etmek için kullanılır.', keywords: 'game transcript maç kaydı' },
    { id: 'notasyonda-yildiz', question: 'Hamle notasyonundaki yıldız işaretleri ne anlama gelir?', answer: 'Yıldız işareti kullanılan notasyon sistemine göre özel bir hamle, vurma veya açıklama işareti olabilir. TavlaTV analizlerinde asıl anlam, hamle satırındaki açıklama ve pozisyonla birlikte okunmalıdır; evrensel tek bir yıldız standardı yoktur.', keywords: 'asterisk yıldız notasyon' },
    { id: 'notasyonda-parantez', question: 'Hamle notasyonundaki parantezler ne anlama gelir?', answer: 'Parantezler çoğunlukla alternatif hamleyi, açıklamayı veya aynı zarların başka oynanışını ayırmak için kullanılır. Bir analiz dosyasındaki notasyonun anlamı, dosya formatının kurallarına göre belirlenir.', keywords: 'parentheses parantez notasyon' },
  ],
  'kupu-ve-oyun-formatlari': [
    { id: 'tables-nedir', question: '“Tables” nedir?', answer: 'Tables, tavla ailesindeki tarihsel ve bölgesel masa oyunları için kullanılan geniş bir addır. Modern backgammon bu aile içindeki oyunlardan biridir; tüm tables oyunları aynı zar, vurma veya toplama kurallarını kullanmaz.', keywords: 'tables tavla ailesi' },
    { id: 'backgammon-diger-tavlalar', question: 'Backgammon diğer tables oyunlarından nasıl ayrılır?', answer: 'Backgammon, standart başlangıç dizilişi, karşılıklı ilerleme, vurma, bara girme ve taş toplama kurallarıyla tanınır. Aynı ailedeki bazı oyunlar aynı tahtayı kullansa da hareket yönünü veya vurma biçimini değiştirebilir.', keywords: 'tables backgammon farkı' },
    { id: 'resmi-kurallar-var-mi', question: 'Backgammon’un resmi kuralları var mı?', answer: 'Temel backgammon kuralları yaygın biçimde ortaklaşmıştır; ancak küp, puanlama, zar ve anlaşmazlık prosedürlerinde federasyon veya turnuva farkları görülebilir. TavlaTV’de oynanan format, uygulamanın ekranda ve oyun motorunda tanımladığı kurallarla sınırlıdır.', keywords: 'official rules resmi kural' },
    { id: 'acey-deucey-amerikan', question: 'American acey-deucey nasıl oynanır?', answer: 'Amerikan acey-deucey uygulamalarında başlangıç dizilişi, 1-2 atan oyuncunun ek hakları ve çift zarların oynanışı standart backgammon’dan farklıdır. Bu varyantın masa kuralları önceden netleştirilmeden standart tavla gibi oynanmamalıdır.', keywords: 'American acey deucey' },
    { id: 'acey-deucey-avrupa', question: 'European acey-deucey nasıl oynanır?', answer: 'Avrupa acey-deucey kuralları da 1-2 atışına verilen ek haklar ve taşların başlangıç konumları bakımından farklılaşır. Amerikan uygulamasıyla aynı kabul edilmemelidir.', keywords: 'European acey deucey' },
    { id: 'portes-nasil-oynanir', question: 'Portes nasıl oynanır?', answer: 'Portes, Yunan tavli ailesinde standart backgammon’a en yakın oyundur. Temel hareket, vurma ve toplama mantığı benzer olsa da yerel zar, puan ve maç uygulamaları değişebilir.', keywords: 'portes kuralları' },
    { id: 'plakoto-nasil-oynanir', question: 'Plakoto nasıl oynanır?', answer: 'Plakoto’da rakip taşını vurup bara göndermek yerine, tek taşını kendi taşının altında sabitleme kuralı öne çıkar. Bu nedenle kapı kurma, kaçış ve oyunun bitiş koşulları standart backgammon’dan ayrılır.', keywords: 'plakoto kuralları' },
    { id: 'fevga-nasil-oynanir', question: 'Fevga nasıl oynanır?', answer: 'Fevga’da oyuncular genellikle aynı yönde ilerler ve başlangıçta rakip taşlarının önüne geçme yarışı farklı kurallarla yürür. Vurma ve kapı kurma mantığı standart tavladan farklı olduğu için kendi varyant kurallarıyla oynanmalıdır.', keywords: 'fevga kuralları' },
    { id: 'trictrac', question: 'Trictrac nedir?', answer: 'Trictrac, Fransa’da tarihsel olarak oynanan, tavla ailesinden farklı puanlama ve hamle hedefleri bulunan bir oyundur. Modern backgammon kurallarıyla eş anlamlı değildir.', keywords: 'trictrac' },
    { id: 'rus-tavlasi', question: 'Russian backgammon nedir?', answer: 'Russian backgammon, başlangıç ve vurma kuralları standart backgammon’dan ayrılan bölgesel bir varyanttır. Bazı uygulamalarda taşlar rakibin iç tahtasında farklı biçimde ilerler; oynanacak masa kuralı açıkça belirtilmelidir.', keywords: 'Russian backgammon rus tavlası' },
    { id: 'fransiz-tavlasi', question: 'French backgammon nedir?', answer: 'French backgammon, tarihsel Fransız tavla geleneğindeki kuralları ifade eder. Puanlama ve özel hamle ayrıntıları modern backgammon’dan farklı olabilir.', keywords: 'French backgammon fransız tavlası' },
    { id: 'hollanda-tavlasi', question: 'Dutch backgammon nedir?', answer: 'Dutch backgammon, özellikle vurulan taşın oyuna dönüşü ve rakip iç tahtasındaki hareketlerle ilgili farklılıklar içerebilen bir varyanttır. Standart oyunun otomatik karşılığı değildir.', keywords: 'Dutch backgammon hollanda tavlası' },
    { id: 'snake-tavla', question: 'Snake nedir?', answer: 'Snake, tavla ailesinde özel başlangıç veya hareket kuralı bulunan daha niş bir varyant adıdır. Kaynaklarda farklı yerel uygulamaları görülebilir; TavlaTV’nin standart oyun modu ile karıştırılmamalıdır.', keywords: 'snake tavla varyant' },
    { id: 'freeze-out', question: 'Freeze-out match nedir?', answer: 'Freeze-out, birden fazla oyun veya tur boyunca oyunculardan birinin elenmesi ya da belirli bir sonuca ulaşmasıyla biten yarışma formatıdır. Klasik hedef skorlu maçtan farklı bir organizasyon biçimi olabilir.', keywords: 'freeze out match' },
    { id: 'duplicate-backgammon', question: 'Duplicate backgammon nedir?', answer: 'Duplicate backgammon’da aynı zar dizileri veya aynı pozisyonlar birden fazla masada oynatılarak şans etkisi azaltılmaya çalışılır. Sonuçlar oyuncuların aynı koşullardaki performansları karşılaştırılarak değerlendirilir.', keywords: 'duplicate backgammon çiftli analiz' },
    { id: 'table-stakes', question: 'Table stakes bahis nedir?', answer: 'Table stakes, oyuncuların masaya koyduğu ve oyun başladıktan sonra artırılamayan sabit bahis sınırını ifade eder. Bu, sınırsız para oyunundan farklı olarak kaybı ve stratejik riski masadaki tutarla sınırlar.', keywords: 'table stakes bahis' },
    { id: 'table-stakes-neden', question: 'Table stakes neden kullanılır?', answer: 'Oyuncuların oyun başladıktan sonra ek para getirerek riski değiştirmesini önlemek ve iki taraf için aynı finansal sınırı korumak için kullanılır. Bu kural, gerçek para veya yerel masa uygulamasıdır; TavlaTV’nin coin sisteminin otomatik karşılığı değildir.', keywords: 'table stakes neden' },
    { id: 'table-stakes-strateji', question: 'Table stakes stratejisi sınırsız para oyunundan nasıl farklıdır?', answer: 'Sabit bir bahis sınırı, kayıp riskini ve küp teklifinin mali sonucunu değiştirir. Oyuncu yalnızca pozisyonun beklenen değerini değil, masada kalan sınırı da dikkate alır. Bu nedenle iki formatta aynı küp kararı doğru olmayabilir.', keywords: 'table stakes strategy' },
    { id: 'multiple-cube-chouette', question: 'Multiple-cube chouette nedir?', answer: 'Multiple-cube chouette’de ekipteki veya masadaki farklı oyuncular kendi küplerini yönetebilir. Bu, tek küplü chouette’den daha karmaşık bir puan ve karar yapısı oluşturur.', keywords: 'multiple cube chouette' },
    { id: 'chouette-danismanlik', question: 'Chouette’de danışmak ne zaman serbesttir?', answer: 'Danışma hakkı chouette masasının önceden kararlaştırdığı sıraya ve kurala bağlıdır. Bazı masalarda kaptan karar verir, bazılarında ekip görüşür. TavlaTV’nin bire bir oyunlarında bu masa düzeni bulunmaz.', keywords: 'consulting chouette' },
    { id: 'chouette-extras', question: 'Chouette’de extras nedir?', answer: 'Extras, chouette oyuncularının ana oyun dışında ek ödeme, yan hak veya masa kuralı olarak kullandığı özel avantajları anlatır. Standardize edilmiş tek bir anlamı yoktur; masa başlamadan açıklanmalıdır.', keywords: 'extras chouette' },
  ],
  'mac-oyunu': [
    { id: 'woolsey-heinrich', question: 'Woolsey–Heinrich match equity table nedir?', answer: 'Woolsey–Heinrich tablosu, belirli maç skorlarında kazanma olasılığını tahmin etmek için kullanılan tarihsel match equity tablolarından biridir. Hamle kuralı değil, skor temelli strateji referansıdır.', keywords: 'Woolsey Heinrich MET' },
    { id: 'mec26', question: 'Mec26 match equity table nedir?', answer: 'Mec26, maç skorları için kullanılan alternatif bir eşitlik tablosudur. Tablo seçimi analiz modeline ve kullanılan varsayımlara göre değişebilir; tek ve mutlak doğru tablo olarak sunulamaz.', keywords: 'Mec26' },
    { id: 'g11', question: 'G11 match equity table nedir?', answer: 'G11 de maç skorlarındaki kazanma paylarını gösteren bir başka referans tablodur. Farklı tabloların küçük yüzdelik farkları olabilir; pratikte skorun ve pozisyonun doğru okunması daha önemlidir.', keywords: 'G11 match equity' },
    { id: 'en-iyi-mac-tablosu', question: 'Hangi match equity table en iyisidir?', answer: 'Bu, kullanılan veri setine, maç uzunluğuna ve oyuncu topluluğuna bağlıdır. Bir tabloyu evrensel doğru kabul etmek yerine, analiz aracının hangi modeli kullandığına bakılmalıdır. TavlaTV oyunculara bu tabloları doğrudan puan hesabı gibi sunmaz.', keywords: 'best MET en iyi tablo' },
    { id: 'janowski-formulu', question: 'Janowski formülü nedir?', answer: 'Janowski formülü, skor ve küp durumuna göre maç kararlarını yaklaşık eşitliklerle modellemeye çalışan bir yaklaşımdır. Öğretici bir kestirimdir; motorun pozisyon değerlendirmesinin veya TavlaTV rating hesabının yerine geçmez.', keywords: 'Janowski formula' },
    { id: 'turner-formulu', question: 'Turner formülü nedir?', answer: 'Turner formülü, maç eşitliklerini pratik biçimde tahmin etmeye yarayan eski yaklaşımlardan biridir. Özellikle skor durumunu hızlı okumak için anılır; kesin hamle önerisi değildir.', keywords: 'Turner formula' },
    { id: 'neil-sayilari', question: 'Neil’in sayıları nedir?', answer: 'Neil’s numbers, maç skorlarını ve hedefe kalan puanları hızlı değerlendirmek için kullanılan ezberlenebilir yaklaşık değerlerdir. Bunlar resmi TavlaTV rating formülü değildir.', keywords: "Neil's numbers" },
    { id: 'muench-formulu', question: 'Muench formülü nedir?', answer: 'Muench formülü, maç eşitliklerini yaklaşık hesaplamak için önerilmiş yöntemlerden biridir. Öğrenme ve zihinden hesap amacı taşır; pozisyonun gerçek kazanma olasılığını tek başına vermez.', keywords: 'Muench formula' },
    { id: 'take-point-hesap', question: 'Take point nasıl hesaplanır?', answer: 'Kabaca küpü almanın beklenen maç değerini pas geçmeye eşitleyen eşik aranır. Maç skoru, küp değeri, mars ve backgammon olasılıkları birlikte hesaba katılır. Bu nedenle tek bir sabit yüzdeyle güvenilir biçimde hesaplanamaz.', keywords: 'calculate take point' },
    { id: 'gammons-mac', question: 'Maç oyununda gammons neden önemlidir?', answer: 'Mars, tek oyun galibiyetinden daha fazla puan getirdiği için hedef skora ulaşma ihtimalini değiştirir. Bazı skor durumlarında mars şansı küpü alma veya pas geçme kararının merkezine gelir.', keywords: 'gammons match' },
    { id: 'hesap-gerekli-mi', question: 'Maç eşitliği hesaplarının hepsini yapmak gerçekten gerekli mi?', answer: 'Her elde tam tablo hesabı yapmak şart değildir. Temel skor farkını, küp değerini ve mars riskini anlamak çoğu karar için iyi bir başlangıçtır. İleri düzeyde motor ve eşitlik tabloları daha hassas karar desteği sağlar.', keywords: 'match equity calculation' },
    { id: 'free-drop', question: 'Free drop nedir?', answer: 'Crawford sonrası bazı skor durumlarında, küpün stratejik etkisi nedeniyle bir oyunu kaybetmenin maç sonucunu değiştirmediği karar noktasına free drop denir. Bu, standart her maçta otomatik oluşan bir hak değildir.', keywords: 'free drop' },
    { id: 'the-trick', question: 'Maç oyununda “the trick” nedir?', answer: 'The trick, özellikle Crawford sonrası skor ve küp ilişkisinden doğan özel bir stratejik fırsatı anlatan masa terimidir. Uygulaması skor, hedef ve turnuva kuralına bağlıdır; genel bir hamle komutu değildir.', keywords: 'the trick post Crawford' },
    { id: 'iki-uzak-kup', question: '2-away 2-away skorunda en iyi küp stratejisi nedir?', answer: 'Tek bir otomatik strateji yoktur. İki tarafın da iki puana ihtiyacı olduğu için küpün değeri, mars şansı ve rakibin kabul eşiği birlikte incelenir. Pozisyon bilgisi olmadan her elde aynı kararı vermek doğru değildir.', keywords: '2 away cube strategy' },
    { id: 'iki-uzak-double', question: 'Oyuncular 2-away 2-away skorunda neden küpü bekletebilir?', answer: 'Bazı pozisyonlarda erken double rakibe kolay bir pas seçeneği verirken, biraz beklemek kazanma ve mars olasılıklarını daha iyi bir eşiğe taşıyabilir. Bu genel eğilimdir; zorunlu kural değildir.', keywords: '2 away wait double' },
  ],
  'rating-ve-tavlatv': [
    { id: 'rating-gelisimi', question: 'Rating sistemi nasıl geliştirildi?', answer: 'Rating sistemleri genellikle oyuncu sonuçlarından ve rakipler arasındaki beklenen kazanma farkından türetilen istatistiksel modellerdir. Tarihsel kaynaklarda farklı formüller bulunur; TavlaTV’nin güncel puan hesabı kendi sunucu uygulamasının kurallarıdır.', keywords: 'rating system development' },
    { id: 'kazanma-olasiligi', question: 'Rating farkından kazanma şansım hesaplanabilir mi?', answer: 'Rating farkı, eşit koşullarda beklenen kazanma olasılığı hakkında yaklaşık fikir verebilir. Ancak zar, küp, maç skoru ve örneklem etkileri nedeniyle tek bir maç için garanti değildir.', keywords: 'winning chances rating' },
    { id: 'mac-rating-puani', question: 'Bir maçta kaç rating puanı tehlikededir?', answer: 'Değişim miktarı rakip ratingi, maçın puanlı olup olmadığı ve TavlaTV’nin maç uzunluğu/sonuç katsayılarına bağlıdır. Sabit bir “her maçta şu kadar puan” değeri yoktur.', keywords: 'rating points at stake match' },
    { id: 'rating-kazaninca', question: 'Kazanınca ratingim ne kadar artar?', answer: 'Artış, rakibin ratingine ve sistemin beklenen sonuç hesabına göre belirlenir. Daha güçlü rakibe karşı kazanmak genellikle daha fazla artış getirir; kesin miktar maç sonucu işlendiğinde sunucu tarafından hesaplanır.', keywords: 'rating win increase' },
    { id: 'rating-kaybedince', question: 'Kaybedince ratingim ne kadar düşer?', answer: 'Düşüş, rakibin ratingine ve sistemin senden beklediği sonuca göre değişir. Düşük ratingli rakibe kayıp daha büyük değişim yaratabilir. TavlaTV’nin sonucu sunucu kaydeder; PR veya zar sonucu ayrıca ratinge çevrilmez.', keywords: 'rating loss decrease' },
    { id: 'rating-ornek', question: 'Rating değişimine basit bir örnek verilebilir mi?', answer: 'Örneğin senden belirgin biçimde güçlü bir oyuncuyu yenmek beklenmedik bir sonuç sayılacağı için artışın, senden düşük ratingli bir oyuncuyu yenmeye göre daha yüksek olması beklenir. Gerçek katsayılar ve maç türü sonucu kesinleştirir.', keywords: 'rating example' },
    { id: 'rating-ramp-up', question: 'Ramp-up nedir?', answer: 'Bazı rating sistemleri yeni oyuncuların puanını daha hızlı doğru seviyeye yaklaştırmak için başlangıç döneminde daha büyük değişimler kullanır. TavlaTV’de böyle bir çarpanın uygulanıp uygulanmadığı güncel sunucu kuralına bağlıdır; kaynak FIBS’e ait ramp-up bilgisi TavlaTV’ye otomatik olarak taşınamaz.', keywords: 'ramp up rating' },
    { id: 'ramp-up-farki', question: 'Ramp-up rating değişimini ne kadar etkiler?', answer: 'Başlangıç deneyimi düşük oyuncuda aynı sonuç daha büyük puan hareketi yaratabilir; deneyim arttıkça değişim normal seviyeye iner. TavlaTV için kesin katsayı açıklanmadıkça kaynak sistemdeki rakamlar burada geçerli kabul edilmez.', keywords: 'ramp up difference' },
    { id: 'rating-dogrulugu', question: 'Ratingim ne kadar doğru?', answer: 'Rating, çok sayıda maçın sonucunda anlam kazanan istatistiksel bir tahmindir. Kısa galibiyet veya mağlubiyet serileri gerçek gücü olduğundan yüksek ya da düşük gösterebilir. Zaman içinde ve farklı rakiplere karşı oynanan maçlar daha sağlıklı fikir verir.', keywords: 'rating accuracy' },
    { id: 'rating-ppg', question: 'Rating farkı PPG ile nasıl ilişkilidir?', answer: 'PPG, bir rakibe karşı oyun başına net puan farkını izleyen ayrı bir ölçüdür. Rating farkı oyuncuların genel göreli seviyesini, PPG ise belirli bir rakibe veya seri içindeki puan verimini anlatır; aynı şey değildir.', keywords: 'PPG rating difference' },
    { id: 'rating-manipulasyon', question: 'Rating manipüle edilebilir mi?', answer: 'Oyuncu eşleşmelerini kasıtlı seçmek, maçtan kaçmak veya hesapları anlaşmalı sonuçlar için kullanmak ratingi yapay biçimde etkileyebilir. Bu tür davranışlar adil oyuna aykırıdır. TavlaTV’de maçın sunucu tarafından sonuçlandırılması ve puanlı/puansız mod ayrımı bu riski azaltmayı amaçlar.', keywords: 'rating manipulation cheating' },
    { id: 'dropper-nedir', question: 'Dropper nedir?', answer: 'Kaybedeceği belli olan maçı rating kaybından kaçmak için kasıtlı olarak terk eden oyuncuya dropper denir. Bu davranış adil değildir ve platform kurallarına aykırı olabilir; bağlantı kopması ile kasıtlı terk aynı şey değildir.', keywords: 'dropper maç terk' },
    { id: '99-in-1', question: '99-in-1 maç nedir?', answer: '99-in-1, tek oyundan oluşan ve teorik olarak çok yüksek hedef puanla oynanan, küpün art arda büyütülmesiyle sonucu tek oyunda belirlemeye çalışan özel bir formattır. Normal TavlaTV maç akışının parçası değildir ve rating manipülasyonu riski nedeniyle güvenilir bir standart sayılmaz.', keywords: '99 in 1 match' },
  ],
}

const COMPLETE_FAQ_SECTIONS = FAQ_SECTIONS.map((section) => ({
  ...section,
  items: [...section.items, ...(SOURCE_COVERAGE[section.id] ?? [])],
}))

const sourceFaqImage = (path: string) => `/assets/faq-source/${path}`
const faqBoard = (points: Record<number, number>, bar: Partial<GameState['bar']> = {}): GameState => {
  const state: GameState = { points: new Array(24).fill(0), bar: { white: 0, black: 0, ...bar }, off: { white: 0, black: 0 }, turn: 'white', dice: [], diceUsed: [] }
  for (const [point, count] of Object.entries(points)) state.points[Number(point)] = count
  return state
}

// Kaynak sayfalardaki pozisyonlar mevcut TavlaTV tahtasıyla yeniden çizilir.
// Formül, akış şeması ve tarihsel varyant görselleri kaynağa bağlantılı olarak
// gösterilir; kaynak dosyaları sayfaya doğrudan hotlink edilmez, proje varlıkları
// olarak servis edilir ve sayfanın sonunda kaynak bağlantısı verilir.
const FAQ_VISUALS: Record<string, FaqVisual | FaqVisual[]> = {
  'tavla-nedir': { kind: 'image', src: sourceFaqImage('faq/gif/backgammonset.png'), alt: 'Tavla setinin genel görünümü' },
  'tavla-taslari-nasil-dizilir': { kind: 'board', state: faqBoard({ 0: 2, 5: 5, 7: 3, 11: 5, 12: -5, 16: -3, 18: -5, 23: -2 }), caption: 'Standart başlangıç dizilişi, TavlaTV tahtasıyla yeniden oluşturuldu.' },
  'bar-nedir': { kind: 'board', state: faqBoard({ 0: 2, 23: -2 }, { white: 1 }), caption: 'Vurulan taş bar üzerinde bekler.' },
  'ic-dis-tahta': { kind: 'board', state: faqBoard({ 0: 2, 5: 2, 11: 5, 12: -5, 18: -3, 23: -2 }), caption: 'İç ve dış tahta bölgeleri, standart tahta üzerinde.' },
  'orta-nokta': { kind: 'board', state: faqBoard({ 12: 5, 18: -3, 23: -2 }), caption: '13. hane, yani orta nokta.' },
  'ace-point': { kind: 'board', state: faqBoard({ 0: 2 }), caption: '1. hane, yani ace point.' },
  'zarlar-nasil-oynanir': { kind: 'image', src: sourceFaqImage('faq/gif/die-w6.png'), alt: 'Altı gösteren tavla zarı' },
  'tek-sayi-oynanirsa': { kind: 'image', src: sourceFaqImage('faq/gif/onenumber.png'), alt: 'Tek zarın oynandığı hamle örneği' },
  'dusuk-zar-once': { kind: 'images', src: [sourceFaqImage('faq/gif/bearoff1-new.gif'), sourceFaqImage('faq/gif/bearoff2-new.gif')], alt: 'Taş toplama sırası örnekleri' },
  'pat-stalemate': { kind: 'image', src: sourceFaqImage('faq/gif/stalemate-new.gif'), alt: 'Stalemate örneği' },
  'acik-tas-blot': { kind: 'board', state: faqBoard({ 7: 1 }), caption: 'Bir hanede tek başına kalan açık taş.' },
  'prime-nedir': { kind: 'board', state: faqBoard({ 5: 2, 7: 2, 9: 2 }), caption: 'Aralıklı değil, ardışık kapılarla kurulan prime fikri.' },
  'ev-tahtasi': { kind: 'image', src: sourceFaqImage('faq/gif/homeboard.gif'), alt: 'İç veya ev tahtasını gösteren şema' },
  'kapali-tahta': { kind: 'image', src: sourceFaqImage('gloss/pics/close_out.gif'), alt: 'Kapalı tahta örneği' },
  'vur-ve-kac': { kind: 'image', src: sourceFaqImage('faq/gif/pickandpass.gif'), alt: 'Vurup güvenli haneye kaçma örneği' },
  'katlama-kupu-nedir': { kind: 'image', src: sourceFaqImage('gloss/pics/doubling_cube.jpg'), alt: 'Katlama küpü' },
  'kupu-ne-zaman-kullanilir': { kind: 'images', src: [sourceFaqImage('faq/gif/cube-example1.gif'), sourceFaqImage('faq/gif/cube-example2.gif'), sourceFaqImage('faq/gif/cube-example3.gif')], alt: 'Katlama küpü karar örnekleri' },
  '24-hane-numarasi': { kind: 'images', src: [sourceFaqImage('faq/gif/24points-new.gif'), sourceFaqImage('faq/gif/24backwards-new.gif')], alt: '24 haneli numaralandırma şeması' },
  'oyun-transkripti': { kind: 'image', src: sourceFaqImage('faq/gif/transcript.gif'), alt: 'Tavla oyun transkripti örneği' },
  nackgammon: { kind: 'image', src: sourceFaqImage('variants/gif/nackgammon-start.gif'), alt: 'Nackgammon başlangıç konumu' },
  'hyper-backgammon': { kind: 'image', src: sourceFaqImage('variants/gif/hyper-start.gif'), alt: 'Hyper-backgammon başlangıç konumu' },
  'long-gammon': { kind: 'image', src: sourceFaqImage('variants/gif/longgammon-start.gif'), alt: 'Long-gammon başlangıç konumu' },
  'acey-deucey': { kind: 'image', src: sourceFaqImage('variants/gif/amaceydeucey-start.gif'), alt: 'Acey-deucey başlangıç konumu' },
  'acey-deucey-amerikan': { kind: 'board', state: faqBoard({ 0: 2, 5: 5, 7: 3, 11: 5, 12: -5, 16: -3, 18: -5, 23: -2 }), caption: 'American acey-deucey başlangıç düzeni, TavlaTV tahtasıyla yeniden oluşturuldu.' },
  'tavli-nedir': { kind: 'image', src: sourceFaqImage('variants/gif/tavli-flowchart.jpg'), alt: 'Tavli oyun ailesi akış şeması' },
  'plakoto-nasil-oynanir': { kind: 'images', src: [sourceFaqImage('variants/gif/plakoto-start.gif'), sourceFaqImage('variants/gif/plakoto-trap.gif')], alt: 'Plakoto başlangıç ve tuzak konumları' },
  'fevga-nasil-oynanir': { kind: 'image', src: sourceFaqImage('variants/gif/fevga-start.gif'), alt: 'Fevga başlangıç konumu' },
  trictrac: { kind: 'image', src: sourceFaqImage('faq/gif/trictrac.gif'), alt: 'Trictrac görseli' },
  'rus-tavlasi': { kind: 'image', src: sourceFaqImage('variants/gif/russian-start.gif'), alt: 'Russian backgammon başlangıç konumu' },
  'snake-tavla': { kind: 'image', src: sourceFaqImage('variants/gif/snake-start.gif'), alt: 'Snake tavla başlangıç konumu' },
  'para-oyunu-mac-oyunu': { kind: 'images', src: [sourceFaqImage('faq/gif/cube2.gif'), sourceFaqImage('faq/gif/cube4.gif'), sourceFaqImage('faq/gif/cube8.gif'), sourceFaqImage('faq/gif/cube16.gif')], alt: 'Küp değerleri' },
  chouette: { kind: 'image', src: sourceFaqImage('variants/gif/chouette-order.gif'), alt: 'Chouette sıra düzeni' },
  'mac-esitlik-tablosu': { kind: 'image', src: sourceFaqImage('faq/gif/MET-example.gif'), alt: 'Maç eşitlik tablosu örneği' },
  'janowski-formulu': { kind: 'images', src: [sourceFaqImage('faq/gif/JanowskiFormula.gif'), sourceFaqImage('faq/gif/JanowskiExample.gif')], alt: 'Janowski formülü ve örneği' },
  'turner-formulu': { kind: 'image', src: sourceFaqImage('faq/gif/TurnerFormula.gif'), alt: 'Turner formülü' },
  'muench-formulu': { kind: 'image', src: sourceFaqImage('faq/gif/MuenchFormula.gif'), alt: 'Muench formülü' },
  'take-point': { kind: 'image', src: sourceFaqImage('faq/gif/TakepointFormula.gif'), alt: 'Take point formülü' },
  'rating-nasil-calisir': { kind: 'images', src: [sourceFaqImage('faq/gif/rating-curve.gif'), sourceFaqImage('faq/gif/ArpadElo.gif')], alt: 'Rating eğrisi ve Elo açıklaması' },
  'kazanma-olasiligi': { kind: 'images', src: [sourceFaqImage('faq/gif/formula1.gif'), sourceFaqImage('faq/gif/formula2.gif')], alt: 'Rating kazanma olasılığı formülleri' },
  'mac-rating-puani': { kind: 'image', src: sourceFaqImage('faq/gif/formula3.gif'), alt: 'Rating puanları formülü' },
  'rating-kazaninca': { kind: 'image', src: sourceFaqImage('faq/gif/formula4.gif'), alt: 'Galibiyet sonrası rating değişimi formülü' },
  'rating-kaybedince': { kind: 'image', src: sourceFaqImage('faq/gif/formula5.gif'), alt: 'Mağlubiyet sonrası rating değişimi formülü' },
  'rating-ramp-up': { kind: 'images', src: [sourceFaqImage('faq/gif/formula6.gif'), sourceFaqImage('faq/gif/rampup-graph.gif')], alt: 'Ramp-up formülü ve grafiği' },
  'ramp-up-farki': { kind: 'images', src: [sourceFaqImage('faq/gif/rampup-no.gif'), sourceFaqImage('faq/gif/rampup-yes.gif')], alt: 'Ramp-up karşılaştırması' },
  'rating-dogrulugu': { kind: 'images', src: [sourceFaqImage('faq/gif/variation1.gif'), sourceFaqImage('faq/gif/variation2.gif'), sourceFaqImage('faq/gif/variation3.gif')], alt: 'Rating dalgalanması örnekleri' },
}

function FaqVisualBlock({ visual, onOpen }: { visual: FaqVisual | FaqVisual[]; onOpen: (src: string, alt: string) => void }) {
  const list = Array.isArray(visual) ? visual : [visual]
  return <div className="faq-visuals">{list.map((item, index) => item.kind === 'board' ? <ArticleBoard key={index} state={item.state} steps={[]} caption={item.caption} /> : item.kind === 'image' ? <figure key={index} className="faq-source-visual"><button type="button" className="faq-image-button" onClick={() => onOpen(item.src, item.alt)} aria-label={`${item.alt} görselini büyüt`}><img src={item.src} alt={item.alt} /></button><figcaption>{item.caption ?? 'Kaynak FAQ görseli'}</figcaption></figure> : <div key={index} className="faq-source-visuals">{item.src.map((src) => <button type="button" className="faq-image-button" key={src} onClick={() => onOpen(src, item.alt)} aria-label={`${item.alt} görselini büyüt`}><img src={src} alt={item.alt} /></button>)}<span>{item.caption ?? 'Kaynak FAQ görselleri'}</span></div>)}</div>
}

const ALL_FAQ_ITEMS = COMPLETE_FAQ_SECTIONS.flatMap((section) => section.items)

function normalize(value: string): string {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Refresh'te scroll konumunu koru (sessionStorage; oturum boyu, kalıcı değil).
const FAQ_SCROLL_KEY = 'faq:scroll'

export default function FaqView({ onClose }: { onClose?: () => void }) {
  const { t } = useT()
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!lightbox) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lightbox])

  // REFRESH'te KALINAN YERE DÖN: body overflow:hidden -> içerik WINDOW değil bir CONTAINER'da
  // scroll eder, o yüzden tarayıcının otomatik scroll geri-yüklemesi çalışmaz (hep tepede başlar).
  // Scroll konumunu (throttled) sessionStorage'a yaz; refresh'te içerik render olunca geri yükle.
  // #anchor (paylaşılan link) önceliklidir. X ile kapatınca konum SIFIRLANIR -> menüden yeniden
  // açılınca tepeden başlar (yalnız refresh kaldığın yeri korur).
  useEffect(() => {
    // .faq-page'in gerçekte scroll eden en yakın atası (auto/scroll + taşan içerik); yoksa window.
    const findScroller = (el: HTMLElement | null): HTMLElement | null => {
      let node = el?.parentElement ?? null
      while (node) {
        const oy = getComputedStyle(node).overflowY
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
        node = node.parentElement
      }
      return null
    }
    const scroller = findScroller(rootRef.current)
    const getTop = () => (scroller ? scroller.scrollTop : window.scrollY)
    const setTop = (v: number) => (scroller ? (scroller.scrollTop = v) : window.scrollTo(0, v))

    const hash = window.location.hash.slice(1)
    if (hash) {
      window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }), 50)
    } else {
      const saved = Number(sessionStorage.getItem(FAQ_SCROLL_KEY) || '0')
      if (saved > 0) {
        // App.tsx'in olası tepeye-kaydırmasından SONRA çalışsın diye rAF + geç retry (görseller geç gelir).
        requestAnimationFrame(() => requestAnimationFrame(() => setTop(saved)))
        window.setTimeout(() => { if (Math.abs(getTop() - saved) > 4) setTop(saved) }, 250)
      }
    }

    const target: HTMLElement | Window = scroller ?? window
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; sessionStorage.setItem(FAQ_SCROLL_KEY, String(getTop())) })
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const filteredSections = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return COMPLETE_FAQ_SECTIONS
    return COMPLETE_FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => normalize(`${item.question} ${item.answer} ${item.keywords ?? ''}`).includes(needle)),
    })).filter((section) => section.items.length > 0)
  }, [query])

  async function copyLink(id: string) {
    const url = `${window.location.origin}/sikca-sorulan-sorular#${id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600)
    } catch {
      window.history.replaceState(null, '', `/sikca-sorulan-sorular#${id}`)
      window.location.hash = id
    }
  }

  const visibleCount = filteredSections.reduce((total, section) => total + section.items.length, 0)

  return (
    <div ref={rootRef} className="faq-page" onClick={(event) => event.stopPropagation()}>
      {onClose && <button type="button" className="faq-close" onClick={() => { try { sessionStorage.removeItem(FAQ_SCROLL_KEY) } catch { /* yoksay */ } onClose() }} aria-label="Sayfayı kapat"><Icon name="x" size={17} /></button>}
      <Breadcrumb items={[homeCrumb(t), { name: 'Sıkça Sorulan Sorular' }]} />
      <header className="faq-hero">
        <div>
          <span className="faq-eyebrow"><Icon name="zoom-question" size={15} /> TAVLATV DESTEK MASASI</span>
          <h1><Icon name="zoom-question" size={28} /> Tavla hakkında sıkça sorulan sorular</h1>
          <p>Kurallardan maç skoruna, katlama küpünden rating sistemine kadar tavlayla ilgili en çok merak edilenleri kısa ve anlaşılır cevaplarla derledik.</p>
        </div>
        <div className="faq-hero-count"><span>{ALL_FAQ_ITEMS.length}</span><small>özgün cevap</small></div>
      </header>

      <div className="faq-tools">
        <div className="faq-search">
          <Icon name="search" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Soru veya konu ara…" aria-label="Sıkça sorulan sorularda ara" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Aramayı temizle"><Icon name="x" size={15} /></button>}
        </div>
        <span className="faq-result-count">{visibleCount} soru</span>
      </div>

      <nav className="faq-topics" aria-label="Sıkça sorulan sorular konuları">
        {COMPLETE_FAQ_SECTIONS.map((section) => <a key={section.id} href={`#faq-${section.id}`}>{section.label}<span>{section.items.length}</span></a>)}
      </nav>

      <div className="faq-sections">
        {filteredSections.length === 0 ? (
          <div className="faq-empty"><Icon name="search" size={24} /><h2>Aramana uygun soru yok</h2><p>Farklı bir kelime veya konu adı deneyebilirsin.</p></div>
        ) : filteredSections.map((section) => (
          <section key={section.id} id={`faq-${section.id}`} className="faq-section">
            <div className="faq-section-heading"><span className="faq-section-index">{String(COMPLETE_FAQ_SECTIONS.findIndex((item) => item.id === section.id) + 1).padStart(2, '0')}</span><div><h2>{section.label}</h2><p>{section.intro}</p></div></div>
            <div className="faq-list">
              {section.items.map((item) => (
                <article key={item.id} id={item.id} className="faq-item">
                  <div className="faq-item-heading"><h3>{item.question}</h3><button type="button" className="faq-share" onClick={() => copyLink(item.id)} aria-label={`${item.question} bağlantısını kopyala`} title="Paylaşılabilir bağlantıyı kopyala"><Icon name={copied === item.id ? 'check' : 'copy'} size={15} /></button></div>
                  <p>{item.answer}</p>
                  {FAQ_VISUALS[item.id] && <FaqVisualBlock visual={FAQ_VISUALS[item.id]} onOpen={(src, alt) => setLightbox({ src, alt })} />}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="faq-next-steps">
        <span className="faq-eyebrow">DEVAM ET</span>
        <h2>Kuralları okuyup masaya geç</h2>
        <p>Yeni başlayanlar için oyun akışını, strateji yazılarını ve terimleri birlikte inceleyebilirsin.</p>
        <div><a href="/nasil-oynanir">Nasıl oynanır</a><a href="/tavla-rehberi">Tavla rehberi</a><a href="/bilgi/sozluk">Terimler sözlüğü</a></div>
      </aside>

      <footer className="faq-source">Bu sayfadaki konu başlıkları ve genel kural karşılaştırmaları <a href="https://www.bkgm.com/faq/" target="_blank" rel="noreferrer">Backgammon Galore FAQ</a> ve bağlantılı alt sayfalar incelenerek hazırlanmıştır. Açıklamalar TavlaTV için özgün olarak yazılmıştır.</footer>
      {lightbox && <div className="faq-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.alt} onClick={() => setLightbox(null)}><div className="faq-lightbox-panel" onClick={(event) => event.stopPropagation()}><button type="button" className="faq-lightbox-close" onClick={() => setLightbox(null)} aria-label="Görseli kapat"><Icon name="x" size={20} /></button><img src={lightbox.src} alt={lightbox.alt} /></div></div>}
    </div>
  )
}
