# Rakip/kadro analizi v1

- Kaynak: maçın iki tarafındaki insan oyuncu kayıtları. AI sayısı çıkarılmaz. Eksik liste boş takım değildir. Genel `pos` grupları kullanılır; CB/CDM/LW veya gerçek 11'li diziliş türetilmez.
- Sonuç doğrudan iki kulübün gol toplamından çıkarılır; DNF karşılaştırma dışında. Yinelenen maçlar tekilleştirilir. Gelecek tarihli maçlar dışarıda.
- EA `skillRating` yalnız `clubs/overallStats` kaynağından alınır, Elo diye yeniden adlandırılmaz. Puanın gözlem tarihi saklanır. Geçmiş maç için yalnız maçtan önceki, en çok 7 günlük kayıt kullanılır. Güncel puanlar ayrı tablodadır; geçmişe doldurulmaz.
- Kişi matrisi: gözlenen G/B/M + Dirichlet(1,1,1) düzeltmesi. Ham galibiyet için %95 Wilson aralığı; aynı maç gecesi/aynı kadro bağımlılığı nedeniyle bu aralık iyimser olabilir.
- En yüksek/düşük sıralaması: en az 5 maç, 3 ayrı rakip, 3 Amsterdam takvim günü. Galibiyet iddiası veya nedensellik yoktur.
- Senaryo: aynı insan sayıları; isteğe bağlı rol vektörünün L1 uzaklığı her taraf için ≤2 (bir oyuncunun rol değiştirmesi); geçmiş SR farkına ±150 tolerans. Eksik özelliğin yerine sıfır konmaz. Yeni kayıtlar geldikçe yeniden hesaplanır.
- Tahmin etiketi yalnız sayısal kadro modelinde: ≥20 benzer maç, ≥5 rakip, ≥5 gün; geçmişten geleceğe ≥30 değerlendirme, Brier < geçmiş taban oranı, kalibrasyon farkı ≤0,15. Aynı gün ve sonraki maçlar eğitimde yok. Çoklu maç türü/rol/SR süzmesi betimleyici kalır; bu sürümde bu alt modeller için tahmin iddiası yok.
- Bu eşikler ürün parametreleridir. Model karşılaştırması kazanma garantisi değildir. Yalnız arşivlenmiş maçlar kullanılır; kaçırılan EA geçmişi geri üretilmez.

# Kart sürümü v3

38 önerinin tamamı ayrı kimlikle sisteme alındı. Üç deneysel eşleme (E150/E159/E179) kapalı. E123 kullanan iki kart bağımsız doğrulama bayrağı bekler. Geri kalan 33 tanım veri ve adaylık eşiklerine tabidir (sezon/kulüp kartları ek endpoint bağlamı ister). Ağırlıklar ekteki şablondan tipli fonksiyonlara çevrildi; çalışma anında eval yok.

Yeni maç kartları dört açık event bucket ister; boş string geçerli, eksik bucket sıfır değildir. Sayaç uyuşmazlığı yalnız ilgili kartın kapsamını dışlar. Gol/şut/asist named alanları kontrol edilir; DNF dışarıda. Tüm bileşenler aynı oyuncu-maç kesişiminden hesaplanır. E153 yüzünden named pas toplamları E215'e zorla eşitlenmez.

Özellikler 3 maç önseliyle rol arkadaşlarının ortalamasına yaklaştırılır; rol grubunda dört aday yoksa açık takım referansı kullanılır. Yüzdelikler olasılık değildir. Sabit ağırlıklar korunur; küçük örneklem/beraberlik kontrolleri kazanan üretimini engeller. Bencil Kral için ek bitiricilik/yaratıcılık koruması; Son Dakika Nazarı için 0,35 risk eşiği uygulanır. Hava topu kazanımı yüzdeye dönüştürülmez. Teknik gol etiketleri benzersiz gol sayılmaz.

Sekiz endpoint mevcut gece toplama işine eklendi. Opsiyonel kaynak hatası maç yayınını kesmez; kaynak durumu ekranda görünür. Sezon/kariyer toplama bağlamı 48 saat içinde birlikte geçerli olmalı; ilk sezonda fark üretilemeyebilir. Bu bağlam kartları dönemlerini ayrıca etiketler; haftalık maç snapshotlarına bugünün sezon bilgisi taşınmaz.
