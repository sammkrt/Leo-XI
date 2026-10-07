# LEO XI performans analizi

Analiz sekmesi takım, oyuncu, maç, seans, karşılaştırma, oyuncu × maç, birlikte oynama ve gelişim görünümlerini içerir. Eski olay analizi ayrıntıları açılabilir; kariyer karşılaştırması, kadro, maç detayları ve katılım panosu korunur. PDF örnekleri yalnız panel düzeni ve soru yaklaşımı için referanstır; örnek rapor sayıları uygulamaya alınmaz.

## Kaynak ve dönemler

Kalıcı arşiv bağlantısı başarılıysa `archive.matches` kullanılır. Güncel kulüp yanıtı aynı maçın saklanmış bilinmeyen alanlarının üzerine yazılmaz. Bağlantı kurulana kadar mevcut kayıtlı uygulama verisi kullanılır. İkinci kalıcı maç deposu veya yeni veri toplama servisi yoktur. Arşiv kariyer toplamı veya eksiksiz sezon değildir.

Tekil kimlik `String(matchId)`; mevcut arşiv politikasında son kayıt kazanır. Oyuncu birleştirmeleri oyuncu ID’siyle yapılır; isim geçmişi ve maçtaki EA rolleri korunur. Kullanıcının taktik rol etiketi EA rolünü değiştirmez.

Dönemler: tüm kayıtlar, tek maç, seans, Amsterdam takvim haftası/ayı, son 5/10/20 uygun maç, dahil başlangıç/bitiş günlü özel aralık. Haftalar ISO hafta yılı ve pazartesi başlangıcını kullanır. URL’de `leo_` filtreleri saklanır; paylaşma, yeniden yükleme ve tarayıcı geri/ileri gezinmesi desteklenir. Oyuncu, maçtaki EA rolü, sonuç, rakip, maç türü ve taktik etiketi filtreleri birlikte uygulanır.

Seans açık bir EA kimliği değildir. Ardışık maçlar arasında en fazla **120 dakika** olacak şekilde türetilir; eşik 15–720 dakika seçilebilir. Gece yarısı seansı bölmez. Fark gerçek zaman damgalarından hesaplandığı için yaz/kış saati geçişleri yanlış boşluk üretmez. Seans anahtarı ilk maçın ID’sidir. Ham dışa aktarma yardımcılarının takvim-günü seçimi ile performans seansı ayrı tanımlardır; analiz ekranı ve filtreli ham JSON aynı süre temelli seans seçimini kullanır.

Önceki dönem seçili kayıtlarla çakışmaz. Son N/tek maç/tüm kayıtlar görünümünde önceki aynı sayıda uygun maç; seansta önceki uygun seans; hafta/ay/özel aralıkta önceki eşit takvim günü sayısı kullanılır. Ay karşılaştırması önceki takvim ayı anlamına gelmez. Özel karşılaştırma aralığındaki ortak maçlar çıkarılır. Eksik önceki dönemden gelişim oku veya sonuç üretilmez.

## Hesaplama sözleşmesi

`lib/club-analytics.ts` metrik sözlüğü kaynak alanlarını/olay kodlarını, Türkçe adları, birimi, düzeyi, formülü, toplama yöntemini, eksiklik/kapsam politikasını ve yorum kısıtlarını taşır. Aynı rapor modeli grafik, tablo, CSV, JSON ve PDF’yi besler.

- Eksik, boş, negatif, bozuk veya sonsuz sayaç `null`; kaydedilmiş sıfır `0`. Oran için sıfır deneme geçerli kayıt olsa da yüzde tanımsızdır.
- Oran `100 × Σ pay / Σ payda`; maç yüzdelerinin basit ortalaması alınmaz. Başarılı sayısı denemeyi aşan satır dışlanır.
- Bireysel maç başına değer yalnız o metriğin geçerli oyuncu-maç sayısına bölünür. Takım trendindeki insan sayacı / maç, geçerli takım-maç sayısını kullanır. Dakika alanları doğrulanamadığı için dakika başına veya per-90 yoktur.
- Takım golü/sonucu `clubs` alanlarından; insan oyuncu üretimi `players` alanlarından gelir. İkisi farklı kapsamdır. Gol+asist takım golü değildir; pas arası, müdahale ve top kazanma tek savunma toplamında toplanmaz.
- Pas yönü ve uzunluğu ayrı sınıflamalardır. Başarılı ve hatalı alt toplamlar olay pas toplamını ayrı ayrı aşarsa satır geçersizdir. Pozitif kalan açıkça sınıflanmayan olarak gösterilir; negatif kalan sıfırlanmaz.
- Olay eşleştirmeleri mevcut topluluk araştırmasına dayanır, resmî EA/Opta tanımı değildir. Geçerli olay kaydında bulunmayan kod gözlenmiş sıfır; eksik/bozuk olay yanıtı eksik veridir.
- Rol radarı aynı tek EA rolünde en az beş oyuncu ve her eksende üç geçerli maç ister. Sayımlar maç başına; oranlar havuzlanmış değer üzerinden orta sıra yüzdeliklerine çevrilir. Eksenler 0–100 ve en fazla iki oyuncudur; birleşik kalite puanı yoktur. Rol filtresi rol değişikliği geçmişini gizleyerek oyuncuyu radar için uygun hale getirmez.
- Maç referansı yalnız daha önceki en az üç geçerli maçın medyanı/min–maks aralığıdır. Dönem kanıtı iki tarafta en az iki maç ve üç geçerli oyuncu-maç ister. Kanıtlar betimleyicidir; kadro, rol, rakip veya nedensellik ayrıştırılmaz.

## Grafikler ve kaynak inceleme

Sekiz hazır oyuncu haritası ve sözlükten özel X/Y seçimi vardır. Kohort medyanları nötr dört bölgeyi ayırır; rol renk yanında şekille gösterilir. Koordinatlar değiştirilmez. Aynı koordinattaki kayıtlar liste olarak açılır. Gelişim oku yalnız seçili oyuncunun mevcut/önceki iki geçerli noktasını bağlar.

Takımın dört maç haritası, maçtan maça ve son beş eğilimi, ayrık dağılımlar, sonuç profilleri, ayrı katkı payları, pas profili ve üç bölgeli top dengesi bulunur. Bölgesel saha üç kategori şemasıdır; gerçek koordinat heatmap’i değildir. Karşılaştırmada gerçek ölçekli iki noktalı grafik, uygun rol radarı ve en fazla üç oyuncunun null boşlukları olan zaman çizgisi vardır. Tablo alternatifleri ve kaynak maç bağlantıları bulunur. Matris hücresinden asıl oyuncu-maç JSON’u ve tam maç raporu açılır. İkili matrisi ortak kadro kayıtlarını gösterir; pas ağı veya kanıtlanmış uyum sıralaması değildir.

Mevcut maç detayları profesyonel maç raporunu, oyuncu profilleri gelişimi ve katılım panosu kaydedilmiş maç gecesi performansını içerir. Katılım beyanları EA verisi değildir ve performans hesabına girmez.

## Günlük ve dışa aktarma

Taktik günlüğü maç/seans/oyuncuya diziliş, taktik ve kullanıcı rolü etiketi ile not ekler. **Yalnız bu tarayıcıdaki localStorage’da saklanır**; başka cihaz veya takım arkadaşına aktarılmaz. Mevcut katılım uç noktası kimlik doğrulamalı özel not deposu olmadığından yeni herkese açık yazma API’si eklenmez. Tarayıcı depolaması kapalıysa başarısızlık gösterilir. Notlar ham EA maç kaydına eklenmez.

CSV/filtreli JSON aynı ekran raporunun oyuncu/rol/dönem ölçümlerini ve kapsamını taşır. CSV formül başlangıçları kaçışlanır. Ham JSON seçilen maçların **tam asıl nesnelerini** taşır; oyuncu filtresi maç seçimini daraltır ama ham nesneden rakip/diğer oyuncular veya bilinmeyen alanlar silinmez. Tüm arşiv ham JSON’u ayrıca indirilebilir. Ham kayıtlar değiştirilmez, eksikler eklenmez, sırlar dahil edilmez. Boş seçimde indirme kapalıdır.

SVG grafikleri SVG veya PNG olarak indirilebilir. Dosya adları LEO XI, görünüm/kapsam/seçim ve indirme tarihini içerir. Tarayıcının PDF / Yazdır işlevi aynı rapor modelinden çok sayfalı takım, oyuncu, kaynak maç ve kanıt raporu üretir; arşiv eksikliği, kapsam, zaman dilimi ve filtreler raporda görünür. PDF’yi kaydetmek tarayıcının yazdırma penceresindedir, yeni PDF kütüphanesi yoktur. Büyük tablo ve matrisler mobilde kendi alanında yatay kayar. Hareket azaltma tercihi desteklenir.

## Veriyle desteklenmeyen analizler

Mevcut kayıtlar pas alıcısı, olay x/y koordinatları, olay zaman sırası, tracking, hat kırma, xG, baskı/pressing fazları veya fiziksel mesafeler sağlamaz. Bu yüzden gerçek pas ağı, şut haritası, detaylı heatmap, xG, receiving/lines broken, hareket/pressing veya fiziksel rapor üretilmez. Kaleci kurtarışı yalnız açık `goalkeeper` rolü ve gerçek `saves` alanında gösterilir; güvenilir karşılaşılan şut paydası olmadan kurtarış yüzdesi yoktur. Korner/orta olayları yalnız gerçek sayaçlar seviyesindedir; duran top şansı/sonucu uydurulmaz.

Toplayıcı EA’nın son 10 lig maçını Amsterdam saatiyle 19:17, 21:17, 23:17 ve 01:17’de, ayrıca mevcut 03:17–06:17 saatlik gece sonu denemelerinde alır; iki başarılı alma arasında ondan fazla yeni maç varsa kayıtlar kaçabilir. Worker sayfa görüntülemelerinden EA’ya istek yapmaz ve arşiv idempotenttir. Gece içi dört ek fırsat son 10 maç penceresi riskini azaltır ama eksiksizliği garanti etmez. Her çalışmada aynı tek maç isteği, doğrulama ve hata politikası korunur; yeni retry döngüsü, tarayıcıdan EA isteği, üretim sırrı veya erişim politikası değişikliği yoktur; eksik sezonu tamamladığını iddia etmez.

## Ayrıntı kapsamı ve filtre sınırları

Maç görünümü tek maç kapsamını, Seans görünümü tek seans kapsamını seçer. Seçim ortak rapora ve URL’ye yazılır; CSV/JSON/PDF başka bir dönemin kayıtlarını sessizce içermez. Diğer görünümler ortak dönem filtresini korur. Maç raporunda oyuncu/EA rolü filtresi insan üretimine, kaynaklara ve geçmiş referansa uygulanır. Seçili oyuncu varken iki takımın farklı insan örneklemleri karşılıklı tam takım sayıları gibi gösterilmez; takım skorları ayrı kalır. Rakip sekmesi aynı rolün mevcut rakip kayıtlarını bağlam olarak sunar; bu metrikler tek maç JSON/CSV/PDF raporlarında da açık kapsamla bulunur.

Maç içi katkı haritasında sekiz oyuncu profili seçilebilir. Tek maçta sayımlar gerçek sayılardır; tek puandan istikrar sapması üretilmez. Bölge tablosunun kaynak detayları asıl oyuncu-maç JSON’una açılır.

Önceki seansın sınırları filtrelerden önce tam arşivden belirlenir. Oyuncu/sonuç filtreleri bir seansı yeniden bölmez; mevcut seansın filtre dışında kalmış erken maçları önceki seans sanılmaz. Rol filtresinin tamamen dışladığı maçlardaki gözlenen rol değişimleri kimlik metadatasında korunur ve radarı uygunsuz hale getirebilir; bu kayıtlar seçili metrik pay/paydasına eklenmez.
