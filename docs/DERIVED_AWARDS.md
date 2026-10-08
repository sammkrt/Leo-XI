# LEO XI takımın unvanları

`/analiz/unvanlar` mevcut analiz filtreleriyle çalışır. Ana sayfa son yedi günün en fazla altı kategori kartını gösterir; aynı kişinin başka kartları kazanması engellenmez. Son yedi gün ve Amsterdam takvim haftası ayrı seçimlerdir. Seans, ay, tüm kayıtlar ve özel tarih aralığı mevcut filtrelerin aynı maç kümesini kullanır. Tek maçta haftalık eşikler gevşetilmez.

`lib/derived-awards.ts` saf hesaplama motoru ve sürümlü kart registry’sidir. `lib/award-presentation.ts` kart, PNG ve X–Y eksenlerinin ortak sonuç modelidir. Profesyonel analiz metriklerinin formülleri değiştirilmez. Bunlar takım içi eğlence endeksleridir; kalite, güven, olasılık, xG veya resmî Opta metrikleri değildir.

## Kaynak ve kapsam

- Her kart yalnız tüm bileşenlerinin geçerli olduğu ortak oyuncu-maç kayıtlarını kullanır. Kartların M değerleri farklı olabilir. Eksik alanlar sıfır olmaz; negatif sayaç, G>S, PC>PA ve TW>TA ilgili hesaplardan dışlanır. Dışlanan kaynak kayıtları denetim JSON’unda bulunur.
- Genel pas ve müdahale alanları adlandırılmış EA sayaçlarıdır. Yön kartları olay yön sayaçları ve olay pas toplamlarıyla doğrulanır. Yönlü ve adlandırılmış pas toplamları gelişigüzel birleştirilmez. Patates detayındaki ileri pas risk bağlamı ayrı kapsama sahiptir.
- Bileşik olay kartlarında mevcut `decodedPlayer` şut/gol/asist uzlaştırması kullanılır. Geçerli olay payload’ında bulunmayan kod gözlenen sıfırdır; bozuk veya bulunmayan payload eksiktir.
- Faul E2+E3, sarı E95+E213, ikinci asist E115, pas arası E6 ve bölgesel kazanım E108+E109+E110’dur. [Mevcut topluluk araştırmasında](https://github.com/Interactive-63/eafc-pro-clubs-api-research) E213 avantaj sonrası sarıdır, ikinci sarı değildir. Kırmızı adlandırılmış `redcards` alanıdır. Y+3RC ayrı ceza boyutlarının ürün ağırlığıdır; benzersiz kart/ihraç sayısı değildir. İkinci sarıdan ihraç nedeni bu veriden ayrıştırılmaz.
- İnsan gol/şut/katkı payı yalnız oyuncunun ortak geçerli maçlarındaki bütün kayıtlı insan satırları geçerliyse hesaplanır. AI ve eksik sezon kapsamı iddia edilmez. Gol+asist benzersiz takım golü değildir. I ve R tek savunma aksiyonu toplamı olarak sunulmaz.
- Oyuncu ID’si korunur; tarihsel isimler aynı ID altında birleşir. Casper yalnız yakın tarihli doğrulanmış güncel kadro ve en az üç kayıtlı maç kapsamında arşivde görünmeme bilgisidir. Geçmiş kadro üyeliği bugünkü kadrodan çıkarılmaz. Katılım beyanları ayrı panoda kalır.

## Referans ve seçim

Oran: `(başarı + k × baseline)/(deneme + k)`; şut k=5, pas k=20, müdahale k=8. Sayım/maç: `(sayı + 3 × baseline)/(M + 3)`. Önce oyuncunun kendi kayıtları çıkarılır. Aynı rolde en az üç başka oyuncu ve en az k geçerli deneme (sayım/maçta üç kayıt) varsa bu rol havuzu kullanılır; aksi durumda aynı dönem genel takım havuzuna dönülür. Genel havuzda da yeterli payda yoksa aday hesaplanmaz. Karışık roller oranlarda deneme, sayım/maçta maç sayısıyla ağırlıklandırılır.

Uygunluk smoothing’den önce uygulanır. P, en az dört uygun aday arasında 0–1 orta sıra yüzdeliğidir. Bileşen yüzdelikleri registry ağırlıklarıyla toplanarak “Unvan endeksi” üretilir. Daha çok maç oynamak için endeks ayrıca maç sayısıyla çarpılmaz.

Başlangıç ürün parametreleri: tam eşitlik toleransı `1e-9`; en az 1 puan toplam endeks aralığı; en az 0,5 puan lider farkı. Ayrıca lider ile sıradaki adayın bütün türetilmiş bileşen farkları `0,01 × max(1, |değerler|)` altında kalıyorsa net kazanan yoktur. Gerçek eşit liderler unvanı paylaşır. Herkes sıfır kartlıysa yalnız faul hacmiyle Suikastçı verilmez. Küçük aday grubunda endeks de üretilmez. Parametreler bilimsel optimum iddiası taşımayan yapılandırılabilir ürün kurallarıdır.

Kart ve detaylarında tam formül, ham pay/payda, baseline/rol ağırlıkları, prior, yüzdelik/ağırlık, ortak M, ilk üç adayın farkları ve kaynak maçlar bulunur. Eksik kart bileşenleri çıkarılıp ağırlık dağıtılmaz: Davar’ın `fouls-only-v1`, Çilingir’in `assists-only-v1` sürümleri açıkça adlandırılır; diğer eksik kartlar üretilmez.

## Gerçek kayıt denetimi — 8 Ekim 2026

Kaynak: [canlı kalıcı maç arşivi](https://leo-xi.samet-krt.workers.dev/api/archive), veri alma tarihi `2026-10-08T08:25:26.157Z`; [kadronun](https://leo-xi.samet-krt.workers.dev/api/club) veri tarihi `2026-10-07T12:29:28.978Z`. Dönem son yedi gün, 10 kayıtlı maç; hesaplama `leo-titles-v1`. İndeksler yüzde değildir. Adlandırılmış ham toplamlar her kazananın kaynak maçlarından ayrıca yeniden toplandı; ağırlıklar bu oyuncuları seçmek için ayarlanmadı.

| Unvan | Kazanan | Ortak M | Uygun aday | Endeks | Denetlenebilir kanıt |
|---|---|---:|---:|---:|---|
| Çamaşır Makinesi | — | — | 3 | — | En az dört uygun aday yok |
| Patates | ACC | 10 | 10 | 100 | 44/150 pas hatası; ham %29,33, düzeltilmiş %28,52; ham 4,4 hata/maç |
| Eşek Yükü | Emre | 10 | 5 | 100 | 11 gol + 8 asist; 19/53 kayıtlı insan katkısı; düzeltilmiş 1,554 katkı/maç |
| Davar | — | — | 1 | — | M≥3 ve F≥3 sağlayan yeterli aday yok |
| Suikastçı | — | — | 0 | — | M≥3, F≥4 ve RC=0 sağlayan yeterli aday yok |
| Elektrik Süpürgesi | Rakun | 10 | 10 | 93,33 | 25 pas arası ve 23 bölgesel kazanım; ayrı düzeltilmiş boyutlar 2,389 ve 2,009/maç |
| Gümrük Memuru | Kaya | 8 | 10 | 96,67 | 27 pas arası, 11 başarılı müdahale; sayaç profil payı 27/38 |
| Otoban Gişesi | Emre | 10 | 9 | 82,50 | 33 başarısız / 38 müdahale denemesi; düzeltilmiş kaçırma %85,22 |
| İleri Vites | Rakun | 9 | 10 | 91,11 | 99/118 ileri pas; düzeltilmiş başarı %83,12 |
| Geri Vites | TheDoc | 9 | 6 | 100 | 39/104 sınıflanmış başarılı pas geri yönde; ham pay %37,5 |
| Çilingir | — | — | 3 | — | En az dört uygun aday yok |
| Kaçak Yolcu | Emre | 10 | 4 | 100 | Şut payı 17/66, gol payı 11/27; leverage 1,582; düzeltilmiş dönüşüm %57,09 |
| Kripto Grafiği | J. ERCAN | 8 | 10 | 100 | Maç arkadaşlarına göre puan farklarının standart sapması 1,934 |
| Sessiz Mesai | Rakun | 10 | 5 | 83,75 | G+A=0; 25 pas arası, 23 kazanım; düzeltilmiş pas başarısı %82,00 |

Kaynak maçlar: `74140658290365`, `74186341560280`, `73860932140076`, `73886613590202`, `73756865160211`, `73698699520413`, `73764330780430`, `73744159940214`, `70566875200281`, `70702404140237`. Her kartın alt kümesi uygulamanın kaynak düğmeleri ve denetim JSON’unda bulunur. Bu tablo yeni veriyle kendiliğinden değişmez; uygulamadaki sonuç tablosu seçili dönem verisinden üretilir.

## Kalıcı unvan arşivi

Mevcut ClubStore ilk yerel kayıt sırasında ve başarılı feed senkronizasyonunda haftalık snapshot’ları aynı transaction içinde üretir. Sürüm, hafta, ortak kaynak kapsamı, as-of, veri fingerprint’i, revizyon ve önceki rapor korunur. Aynı verinin tekrar alınması revizyon oluşturmaz; geç gelen/değişen kayıt yeni revizyon oluşturur. Devam eden hafta geçicidir; hafta tamamlandığında veri değişmeden tamamlanmış olarak işaretlenir. Feed başarısız olsa da okuma yalnız takvim durumunu güncel gösterir, hesapları veya as-of tarihini değiştirmez. Henüz gözlenmemiş eski ödül geçmişi uydurulmaz.

Revizyon geçmişleri sınırlı boyutlu parçalarda kayıpsız saklanır; mevcut maç/katılım deposu, namespace ve migration değiştirilmez. `/api/archive` saklanmış unvanları döndürür; okuma upstream toplama başlatmaz. Depolama hatası maç ve ödül transaction’ını birlikte geri alır. Feed hataları önceki sonuçları korur.

PNG karttaki aynı kanıt/değer modelini kullanır. Web Share dosya desteği yoksa indirme yapılır. Kütüphane, resmî analitik veya yeni canlı veri kaynağı eklenmez.
