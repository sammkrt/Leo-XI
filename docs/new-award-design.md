# LEO XI — EA FC27 event denetimi ve 38 yeni geyik kartı

**Tarih:** 9 Ekim 2026  
**Durum:** Ürün/algoritma tasarımı. Bu dosya uygulanmış özellik değildir. Site canlı olarak incelenmiş olsa da EA API uçlarına bu ortamda doğrudan bağlanılamadı. Kartların gerçek kazananları hesaplanmadı.

## Kaynaklar ve temel varsayımlar

- Kullanıcının `EA FC Pro Clubs API Research` araştırma dökümü (248 satır, güncel oturum eki).
- Mevcut LEO XI: https://leo-xi.samet-krt.workers.dev/ (7 Ekim kayıtlı veri örneği).
- Bağımsız endpoint testi: https://github.com/1erkandogan/fc27-clubs-api/blob/main/docs/endpoints.md (2 Ekim 2026 tekrar kontrolü).
- Resmî EA dokümantasyonu **değil**. Tüm event anlamları bağımsız araştırma bulgusudur.

## Mevcut kartlar (YENİ önerilere dahil edilmedi)

Asabi; Gariban; Patates; Eşek Yükü; Elektrik Süpürgesi; Gümrük Memuru; Otoban Gişesi; İleri Vites; Geri Vites; Kaçak Yolcu; Kripto Grafiği; Sessiz Mesai.

Sitede bulunmayan fakat kullanıcı tarafından önceki konuşmada istenen `Kudurtucu`, `Defans Siken`, `Hücum Siken`, `Narşın Kelebeği`, `Haftanın El Bombası`, `Haftanın Şabanı` gibi kartlar mevcut iş listesi sayılmalıdır; yeni 38 kartla birleştirme sırasında kopya isim yaratılmamalı. Yeni `Misafirperver Defans` kombine disiplin/korner/pozisyon riski ölçer; daha önce istenen `Haftanın El Bombası` ise yalnız ceza sahası içi top kaybına dayandığı için ayrıdır (EA araştırma dökümünde ceza sahası içi top kaybı ayrıca doğrulanmamıştır).

## Endpoint bazında denetim

| # | JSON endpoint | Gözlenen/araştırılan veri | LEO XI kullanımı | Kritik sınırlama |
|---|---|---|---|---|
| 1 | `/allTimeLeaderboard/search` | clubName ile arama; kariyer/genel kulüp toplamı | Kulüp kimliği keşfi, tüm-zamanlar referansı, yeni sezon farkı | `maxResultCount` kesin sonuç adedi değil; kulüp adı eşleşmesini doğrula |
| 2 | `/currentSeasonLeaderboard/search` | aynı yapı, cari sezon verisi | Kulüp gidişatı ve `Son Dakika Nazarı` | İlk sezonda tüm-zamanlar ile aynı olabilir |
| 3 | `/club/playoffAchievements` | playoff ödül kaydı | Varsa playoff kupaları/rozetleri; yoksa gizle | Bağımsız testlerde `[]`; dolu şema bilinmiyor |
| 4 | `/clubs/info` | ad, kimlik, regionId, teamId, kit/crest | Kart tasarımı/klüp kimliği, doğru clubId | FC27 nesil/platform ve sezon değişimi sonrası clubId doğrula |
| 5 | `/clubs/overallStats` | galibiyet, beraberlik, mağlubiyet, SR, seriler, gol | Takım performans kartları, sezon kıyasları | lastMatch/lastOpponent dizisi, gerçek maç listesiyle tam örtüşmeyebilir |
| 6 | `/clubs/matches` | maç+rakip, oyuncu istatistikleri, dört event bucket | **Çoğu yeni kartın ana kaynağı**; maç/oyuncu kırılımları | en fazla son 10 maç/her matchType, sayfalama yok; geçmişi depolamak gerekli |
| 7 | `/members/career/stats` | kulüpte oyuncu kariyer toplamları | `Sonradan Açılan Füze` sezon-kariyer kıyası | kariyer sezonu içerir; eski dönemi çıkararak bul |
| 8 | `/members/stats` | cari sezon maç, gol, asist, başarı, kart, pozisyon | sezonluk bağlam, oyuncu adı/pozisyon, emniyet kontrolleri | maç detaylarıyla farklı zaman penceresi; doğrudan aynı paydaya bölme |

PNG asset uçları (crest, notfound, reputation tier, division badge, kapak): **görsel katmandır**, istatistik verisi ya da yeni kart kazananı üretmez. Başarılı/başarısız erişim halinde imaj fallback uygulanır.

## Event ağırlığına ilişkin zorunlu kurallar

1. `E(n)` oyuncunun **aynı uygun maç setinde** `match_event_aggregate_0..3` içinden ayrıştırılan event n toplamıdır. `M` yalnız o oyuncunun geçerli maç sayısı. `P(x)` benzer pozisyon grubundaki uygun oyuncular arasında 0–1 yüzde sırası (percentile), olasılık değil. `P()` uygulanırken örneklem yeterli olmalı.
2. Ortak kapsam: tüm bileşenlerin gözlendiği maçların kesişimi; kayıp bucket veya maç = 0 sayılmaz. Kontrol için raw match id, bucket ham dizgisi ve ayrı `coverage_status` sakla.
3. `E215` geçerli tamamlanan pas, `E216` başarısız pas, `E153` ofsayt pasıdır. EA'nın `passesmade` alanı E153'ü de içerebilir; `E215` ile aynen eşit olduğu varsayılmamalı.
4. Pas **yönü** (`30..35`) ve **uzunluğu** (`24..29`, `36..37`) farklı sınıflandırmalardır. Aynı pası iki defa sayıp toplam pas üretme. Başarılı pas alt grubu E215 içinde; başarısız E216 içinde olabilir.
5. Şut bölgesi `13/14/18/19`, on-target `217`, off-target `218` ve toplam `217+218` kesişir. E202 kalecinin yaptığı kurtarış değil, şutu kurtarılan oyuncunun sayacı olabilir; örneklemle doğrula.
6. Gol E214 ile `128`, `131`, `136`, `123` ve diğer goal-technique tag'leri farklı boyutlarda örtüşür. Gol tekniği event'lerini tekil gol olarak toplama.
7. `E112 = normal beat + skill move beat(E38)`; E38'i E112'ye ekleme. E97 top taşıma türüdür; çalım girişimi değildir. `E229/230` E0'dan ayrı yeni müdahaleler gibi toplanmaz.
8. `E219 = Σ(E99..E103)` konum dışı toplamı; şiddet ağırlığı değerlendirilirken `Σ(j×E(98+j)) / E219` kullanılır. `E111` geri bildirimidir, tüm pozisyon anlarını ölçmez.
9. `E265` ve `E266` başarılı hava topu kazanımlarıdır; **denenen hava topu sayısı bu dökümde yoktur**. Dolayısıyla aerial win % veya en düşük deneme oranı üretilmez.
10. `E4` oyuncuya yapılan fauldür; hangi rakibin sarı gördüğü E4'ten tek başına bulunamaz. `Kudurtucu` etiketi sarı kart neden-sonuç iddiasına bağlanmasın; ancak eşleştirilmiş olay zaman çizelgesi varsa doğrulanabilir.
11. Rakip oyuncu verisi `players[opponentClubId]` mevcutsa kullanılabilir; ancak oyuncular arası bire bir faul/kart eşleşmesi aggregate sayacından çıkmaz.
12. `E96` kırmızı kart demek değildir (kısmi tetik); `E104` ofsayt sayacı eksik yakalar; `E121` E229'a çok benzer duplicate'dir; bunlar kesin sayım olarak kullanılmaz.
13. `E49/E50` kurtarış alt türlerinin hangisi olduğu bilinmiyor; etiketlenmez. `E150/E159/E179` tek/iki örneklik tahmin; varsayılan kapalı.
14. Her kart min 3 maç, yeterli payda, 4 uygun aday, rol/pozisyon ağırlığı, küçük örneklem düzeltmesi ve eşitlik kontrolü ister. Sayılar başlangıç hipotezidir; gerçek oyuncu-maç dağılımıyla kalibre edilecek.
15. Son 7 gün denecekse tüm dönemin arşivlendiğini kanıtla. Yoksa **“Son 10 kayıtlı maç”** yaz. EA'nın maç başına 10 limitini kırmak için zamanla kendi arşivini biriktir, eski 10'u geriye dönük sihirli biçimde çektiğini iddia etme.

## Puanlama kılavuzu

- Kısa isimli yardımcılar: `P(x)` takım içi pozisyon eşlenik yüzdelik sıralama; `r(a,b;k) = (a + k×pozisyona_özel_ortalama_oran)/(b+k)`; `a/M` maç başına.
- Skorları önce 0..1 arası pozisyon/maç ayarlı normalize et, sonra tabloda belirtilen ağırlıklarla 100'e çarp. Örnek tablolar **algoritma şablonlarıdır**, doğrudan çalıştırılabilen JS değildir.
- Çoklu örtüşen event'ler bağımsız **özellik boyutları** olarak skorlanır, benzersiz olay sayısı diye gösterilmez.
- Negatif ödüllerde üst sıra en kötü davranışı temsil eder; olumlu kategorilerde en iyi. Fark yeterli değilse “bu hafta kazanan yok”.
- DNF kısa maçlarını ayrı etiketle; oyuncu süreleri farklıysa 90-dakika normalize oran kullan ve maç süreleri güvenilir mi kontrol et. Her kartta **3 kritik sayı + bir komik cümle**; ayrıntılı matematik tooltip/detayda kalmalı.

## Önerilen 38 yeni kart (formül detayları)

### 01. 🎪 Haftanın Şovmeni — Hücum • Övgü

> Gol atmaya değil, fragman çekmeye gelmiş.

- **Event'ler:** E38, E147, E123, E128, E131, E136, E214, E112, E174
- **Skor (0–100):** `100 × (0.27 P(E38/M) + 0.20 P(E147/M) + 0.25 P(min(E123,E214)/max(E214,1)) + 0.16 P((E128+E131+E136)/max(E214,1)) + 0.12 P(E174/M))`
- **Uygunluk:** M≥3; E214≥1 VEYA E38+E147≥3
- **Yorum sınırı:** E123 kısmi (~%99); E128/131/136 gol türleri çakışabilir, benzersiz gol toplamı değildir.
- **Durum:** **Önerilen**

### 02. 🦚 Mahallenin Neymar'ı — Hücum • Övgü

> Çalım atmadı, adamın joystick'ini bozdu.

- **Event'ler:** E38, E112, E174, E97
- **Skor (0–100):** `100 × (0.45 P(E38/max(E112,1)) + 0.35 P(E112/M) + 0.20 P(E174/M))`
- **Uygunluk:** M≥3; E112≥4; E174≥5
- **Yorum sınırı:** E38, E112'nin alt kümesidir; E97 top taşıma türüdür, çalım denemesi paydası değildir. E97 bağlam metni için.
- **Durum:** **Önerilen**

### 03. 🚀 NASA Stajyeri — Hücum • Taşlama

> Şut Dünya atmosferini terk etti, top geri dönmedi.

- **Event'ler:** E18, E19, E13, E14, E217, E218, E214
- **Skor (0–100):** `100 × (0.50 P(E19/max(E18+E19,1)) + 0.30 P((E18+E19)/M) + 0.20 P(E218/max(E217+E218,1)))`
- **Uygunluk:** M≥3; E18+E19≥5; E217+E218≥8
- **Yorum sınırı:** Dış şut profili ölçer; tüm ıskaları göğe atılmış şut diye yorumlamaz. E13/E14 karşılaştırmalı bölge bağlamı; E214 bağlam.
- **Durum:** **Önerilen**

### 04. 🧱 Kalecinin Arkadaşı — Hücum • Taşlama

> Kaleci onun sayesinde maçın adamı oldu.

- **Event'ler:** E202, E217, E218, E214, E13, E14
- **Skor (0–100):** `100 × (0.45 P(E202/max(E217,1)) + 0.35 P(E202/M) + 0.20 P(E14/max(E13+E14,1)))`
- **Uygunluk:** M≥3; E217≥5; E202≥2
- **Yorum sınırı:** E202 “saved shot” olayının oyuncu tarafındaki anlamı doğrulansın; şut türleri çift sayılmaz.
- **Durum:** **Önerilen**

### 05. 🎯 Ceza Sahası Cerrahı — Hücum • Övgü

> İçeri girdi mi işini bitiriyor, lafı uzatmıyor.

- **Event'ler:** E13, E14, E18, E19, E214, E217, E218
- **Skor (0–100):** `100 × (0.50 P(E13/max(E13+E14,1)) + 0.30 P(E13/M) + 0.20 P(E214/max(E217+E218,1)))`
- **Uygunluk:** M≥3; E13+E14≥6; E214≥2
- **Yorum sınırı:** İçeriden gol sayısı yok; “içeride bitirdiği” iddiası kurulmaz, içeride isabet profili yorumlanır.
- **Durum:** **Önerilen**

### 06. 🥄 Kepçeyle Gol Atan — Hücum • Övgü

> Kaleciyle göz göze gelip üstünden aşırdı.

- **Event'ler:** E123, E214, E128, E131, E136
- **Skor (0–100):** `100 × (0.65 P(min(E123,E214)/max(E214,1)) + 0.35 P(E123/M))`
- **Uygunluk:** M≥3; E214≥2; E123≥1
- **Yorum sınırı:** E123 doğrulanmış değil, yüksek güvenli kısmi. Bu kart doğrulama bayrağıyla çalışır; E128/E131/E136 yalnız detay etiketleri.
- **Durum:** **Önerilen**

### 07. 👑 Bencil Kral — Hücum • Taşlama

> Şut tuşu aşınmış, pas tuşu kutudan çıkmamış.

- **Event'ler:** E217, E218, E214, E11, E115, E215, E216, E147, E152
- **Skor (0–100):** `100 × (0.45 P(((E217+E218)/max(takım_şutları,1))) + 0.35 P((E217+E218)/M) + 0.20 P((1-E214/max(E217+E218,1))*(1-(E11+0.5*E115)/max(E217+E218+E11+0.5*E115,1))))`
- **Uygunluk:** M≥3; E217+E218≥8; aynı maçlarda takım şutu var
- **Yorum sınırı:** Golcü olmayı cezalandırmaz: yüksek şut payı ve düşük yaratıcı katkı şarttır. E147/E152 + paslar açıklamada görünür.
- **Durum:** **Önerilen**

### 08. 🪄 İnce İşçilik — Hücum • Övgü

> Pas attı mı savunmanın tapusu el değiştiriyor.

- **Event'ler:** E152, E118, E11, E115, E143, E147, E215, E216
- **Skor (0–100):** `100 × (0.35 P(E152/M) + 0.25 P(E118/max(E11,1)) + 0.25 P(E115/M) + 0.15 P(E147/M))`
- **Uygunluk:** M≥3; E215+E216≥30; E152+E115≥3
- **Yorum sınırı:** E118 asist alt türüdür; E11'e eklenmez. E143 ve genel pas isabeti anlatı/karşılaştırma.
- **Durum:** **Önerilen**

### 09. 🧠 Görünmeyen Mimar — Hücum • Övgü

> Asisti yapan değil, asistçinin akıl hocası.

- **Event'ler:** E115, E11, E143, E152, E176, E177
- **Skor (0–100):** `100 × (0.55 P(E115/M) + 0.25 P(E143/M) + 0.20 P((E176+E177)/M))`
- **Uygunluk:** M≥3; E115≥2
- **Yorum sınırı:** E115 ikinci asisttir; E176/E177 oyun içi feedback, olayların aynı pozisyonda olduğu iddia edilemez.
- **Durum:** **Önerilen**

### 10. 📵 Ofsayt Çağrı Merkezi — Hücum • Taşlama

> Savunmanın arkasına arıyor, sürekli meşgul.

- **Event'ler:** E153, E152, E30, E31, E104
- **Skor (0–100):** `100 × (0.65 P(E153/max(E30+E31+E153,1)) + 0.35 P(E153/M))`
- **Uygunluk:** M≥3; E153≥2; E30+E31≥15
- **Yorum sınırı:** E153 ofsayt pası, oyuncunun kendisinin ofsayta yakalanması değil. E104 kısmi, skorda yok.
- **Durum:** **Önerilen**

### 11. 🏓 Langırt Ustası — Pas • Övgü

> Tek dokunuşla herkesin kafasına top sektirdi.

- **Event'ler:** E143, E24, E25, E215, E216, E30, E31
- **Skor (0–100):** `100 × (0.45 P(E143/max(E215+E216,1)) + 0.30 P(E143/M) + 0.25 P(E30/max(E30+E31,1)))`
- **Uygunluk:** M≥3; E143≥8; E30+E31≥15
- **Yorum sınırı:** E24/25 kısa pas bağlamıdır; E143 tek dokunuş pası ile eşleşebilir.
- **Durum:** **Önerilen**

### 12. 📦 Kıtalararası Kargo — Pas • Övgü

> Topu gönderdi, kargo takip numarası bile verdi.

- **Event'ler:** E144, E28, E29, E26, E27, E215, E216
- **Skor (0–100):** `100 × (0.40 P(E144/M) + 0.35 P(E28/max(E28+E29,1)) + 0.25 P(E28/M))`
- **Uygunluk:** M≥3; E28+E29≥8; E144≥2
- **Yorum sınırı:** E144 yön değiştirme, E28 uzun pas; bazen aynı pas olabilir, ayrı endeks bileşenleri. Orta mesafe E26/27 ile kıyas bağlamı.
- **Durum:** **Önerilen**

### 13. 🧻 Yan Sanayi Xavi — Pas • Taşlama

> Pas var, istikamet genellikle yan komşu.

- **Event'ler:** E32, E33, E34, E35, E24, E25, E30, E31, E152, E215, E216
- **Skor (0–100):** `100 × (0.50 P((E32+E34)/max(E30+E32+E34,1)) + 0.30 P((E24+E25)/max(E215+E216,1)) + 0.20 P(1-E152/max(E215,1)))`
- **Uygunluk:** M≥3; yönü bilinen tamamlanan pas≥40; toplam pas≥50
- **Yorum sınırı:** Geri Vites'in kopyası değil: yan/geri + kısa + az delici pas kombinasyonu. Pas yönü ve uzunluğu birbirine toplanmaz.
- **Durum:** **Önerilen**

### 14. 📞 Yanlış Numara — Pas • Taşlama

> Pası gönderdi, alıcı yerine komşunun zili çaldı.

- **Event'ler:** E31, E33, E35, E25, E27, E29, E37, E216, E151, E30, E215
- **Skor (0–100):** `100 × (0.45 P(E31/max(E30+E31,1)) + 0.30 P((E25+E27+E29+E37)/max(E215+E216,1)) + 0.25 P(E216/M))`
- **Uygunluk:** M≥3; E215+E216≥50; E30+E31≥15
- **Yorum sınırı:** E151 “bad pass?” doğrulanmadığı için skor dışı. E216 genel hata, alt türler tekrar toplanmaz.
- **Durum:** **Önerilen**

### 15. 🎭 Ben Öyle Demek İstemedim — Pas • Taşlama

> Oyun bile “başka yere atsaydın” dedi.

- **Event'ler:** E182, E207, E175, E183, E176, E177, E212, E215, E216
- **Skor (0–100):** `100 × (0.40 P(E182/M) + 0.30 P(E207/M) + 0.30 P(E175/M))`
- **Uygunluk:** M≥3; toplam anlamlı MF feedback≥5; E215+E216≥30
- **Yorum sınırı:** Feedback etiketleri seyrek/kontekstli. E212 “Use the ball” tek başına yanlış karar demek değil; E183 ve iyi karar olayları karşı delil.
- **Durum:** **Önerilen**

### 16. 🧭 Doğru Adres — Pas • Övgü

> Top gelmeden bir sonraki hamleyi hesapladı.

- **Event'ler:** E176, E177, E182, E183, E207, E152, E215, E216
- **Skor (0–100):** `100 × (0.50 P((E176+E177)/max(E176+E177+E182,1)) + 0.25 P((E176+E177)/M) + 0.25 P(E152/M))`
- **Uygunluk:** M≥3; E176+E177+E182≥5
- **Yorum sınırı:** Feedback seçici olabilir; tüm pasların doğru karar yüzdesi değildir.
- **Durum:** **Önerilen**

### 17. 🧵 Terzi Makası — Kanat • Övgü

> Orta kesti, rakip savunma dikiş tutmadı.

- **Event'ler:** E36, E37, E145, E156, E157, E11, E118
- **Skor (0–100):** `100 × (0.55 P(E36/max(E36+E37,1)) + 0.30 P(E36/M) + 0.15 P(E11/M))`
- **Uygunluk:** M≥3; E36+E37≥8
- **Yorum sınırı:** E145 korner girişimleri ve E156 bloklanan ortalar bağlamdır. E157 kısmi; toplam orta paydasına sokulmaz.
- **Durum:** **Önerilen**

### 18. 📡 Uydu Yayını — Kanat • Taşlama

> Ortayı yaptı, top yayın uydusuna bağlandı.

- **Event'ler:** E36, E37, E145, E156, E157, E215, E216
- **Skor (0–100):** `100 × (0.55 P(E37/max(E36+E37,1)) + 0.30 P(E37/M) + 0.15 P(E37/max(E215+E216,1)))`
- **Uygunluk:** M≥3; E36+E37≥10; E37≥4
- **Yorum sınırı:** E145 korner sayısıdır, hepsinin orta olduğu bilinmez. E157 deneysel gösterilebilir ama skor dışı.
- **Durum:** **Önerilen**

### 19. 🐝 Pres Makinesi — Orta saha • Övgü

> Adam topa değil, rakibin nefesine bastı.

- **Event'ler:** E110, E158, E6, E164, E163
- **Skor (0–100):** `100 × (0.45 P(E110/M) + 0.35 P(E158/M) + 0.20 P(E6/M))`
- **Uygunluk:** M≥3; E110+E158+E6≥6
- **Yorum sınırı:** Top kazanma, dispossession ve interception tek olayda örtüşebilir; rakamlar benzersiz müdahale toplamı değildir.
- **Durum:** **Önerilen**

### 20. 🐙 Hücum Fişini Çeken — Orta saha • Taşlama

> Topu istedi, top ondan ayrılmak istedi.

- **Event'ler:** E110, E107, E106, E174, E112, E152, E214, E11
- **Skor (0–100):** `100 × (0.40 P(E107/max(E107+E110,1)) + 0.30 P(E107/M) + 0.30 P((E174+E112)/max(E214+E11+1,1)))`
- **Uygunluk:** M≥3; E107+E110≥7; E174+E112≥5
- **Yorum sınırı:** Agregalar olay sırasını içermez; “topu kazanıp aynı pozisyonda kaybetti” kesinliği yok.
- **Durum:** **Önerilen**

### 21. 🧯 Yangın Tüpü — Savunma • Övgü

> Herkes panikledi, bu yangın söndürüp çıktı.

- **Event'ler:** E108, E105, E164, E6, E94, E10
- **Skor (0–100):** `100 × (0.35 P(E108/M) + 0.30 P(E164/M) + 0.25 P(E6/M) + 0.10 P(1/(1+E94+E10)))`
- **Uygunluk:** M≥3; E108+E164+E6≥7
- **Yorum sınırı:** Elektrik Süpürgesi'nden farklı: savunma üçlüsündeki temiz müdahale ve risk kontrolü. E105 kayıp karşılaştırması.
- **Durum:** **Önerilen**

### 22. 🎁 Misafirperver Defans — Savunma • Taşlama

> Rakibe korner, faul, penaltı… çay da ister misin?

- **Event'ler:** E94, E10, E3, E105, E95, E213, E163
- **Skor (0–100):** `100 × (0.40 P((E94+E10+E3)/M) + 0.35 P(E105/M) + 0.25 P((E95+E213+E163)/M))`
- **Uygunluk:** M≥3; savunmada ≥3 maç; E94+E10+E3+E105≥3
- **Yorum sınırı:** “Gol yedirdi” değil: savunma bölgesindeki risk sinyalleri. Penaltı ve korner farklıdır, eşit sonuç şiddeti değildir.
- **Durum:** **Önerilen**

### 23. 🛝 Kayarak Giren — Savunma • Övgü

> Fren yerine slide tackle tuşu taktırmış.

- **Event'ler:** E230, E229, E0, E1, E164, E163
- **Skor (0–100):** `100 × (0.50 P(E230/max(E229+E230,1)) + 0.30 P(E230/M) + 0.20 P(E164/max(E0+E1,1)))`
- **Uygunluk:** M≥3; E229+E230≥7
- **Yorum sınırı:** E0 toplam kazanılan müdahale, E229/E230 alt türü; toplanmaz. E164 clean tackle olayları overlap olabilir.
- **Durum:** **Önerilen**

### 24. 🧼 Tertemiz Kasap — Savunma • Övgü

> Kesti biçti ama hakeme malzeme vermedi.

- **Event'ler:** E164, E0, E1, E229, E230, E2, E3, E95, E213, E94
- **Skor (0–100):** `100 × (0.45 P(min(1,E164/max(E0+E1,1))) + 0.30 P(E0/max(E0+E1,1)) + 0.25 P(1/(1+E2+E3+E95+E213+E94)))`
- **Uygunluk:** M≥3; E0+E1≥10
- **Yorum sınırı:** E164 çoklu sayılabilir; “faulsüz” yalnız E2+E3=0 ise denir.
- **Durum:** **Önerilen**

### 25. 🪓 Nazikçe Parçaladı — Savunma • Taşlama

> Topla beraber rakibin sabrını da aldı.

- **Event'ler:** E163, E2, E3, E95, E213, E94, E164, E171, E0, E1
- **Skor (0–100):** `100 × (0.40 P(E163/M) + 0.35 P((E2+E3+2*(E95+E213)+3*E94)/M) + 0.25 P(1-min(1,E164/max(E0+E1,1))))`
- **Uygunluk:** M≥3; E2+E3+E163≥3
- **Yorum sınırı:** Asabi'den farklı: faul başına şiddet/kart/penaltı profili. E171 etiketi belirsiz: sadece görünür audit.
- **Durum:** **Önerilen**

### 26. 🧀 İsviçre Peyniri — Savunma • Taşlama

> Savunmada delik yok, mahalle tüneli var.

- **Event'ler:** E105, E106, E1, E99, E100, E101, E102, E103, E219
- **Skor (0–100):** `100 × (0.40 P((E105+E106)/M) + 0.25 P(E1/M) + 0.35 P((E102+E103)/max(E219,1)))`
- **Uygunluk:** M≥3; savunma/orta saha≥3 maç; E219≥5
- **Yorum sınırı:** E219 = E99..E103; sadece ağırlıklı ağır pozisyon kaybı yüzdesi kullanılır.
- **Durum:** **Önerilen**

### 27. 🗺️ GPS Sinyali Yok — Savunma • Taşlama

> Hoca sağ bek dedi, adam başka mahallede.

- **Event'ler:** E99, E100, E101, E102, E103, E111, E219, E175, E212
- **Skor (0–100):** `100 × (0.50 P((E99+2*E100+3*E101+4*E102+5*E103)/max(E219,1)) + 0.30 P(E219/M) + 0.20 P(E219/max(E219+E111,1)))`
- **Uygunluk:** M≥3; E219≥8
- **Yorum sınırı:** E111 iyi pozisyon geri bildirimi; doğrudan tüm pozisyonların paydası değildir. E175/E212 yalnız anlatı bağlamı.
- **Durum:** **Önerilen**

### 28. ✈️ Hava Kuvvetleri — Savunma • Övgü

> Yerden havaalanına geçiş izni sadece onda.

- **Event'ler:** E265, E266, E229, E230, E108, E110
- **Skor (0–100):** `100 × (0.45 P(E266/M) + 0.30 P(E265/M) + 0.25 P((E265+E266)/M))`
- **Uygunluk:** M≥3; E265+E266≥5
- **Yorum sınırı:** Hava topu kazanma SAYISI; deneme event'i olmadığı için hava topu kazanma yüzdesi hesaplanmaz.
- **Durum:** **Önerilen**

### 29. 🧱 Kapı Duvar — Savunma • Övgü

> Topu geçirene kadar nöbet bitmiyor.

- **Event'ler:** E156, E266, E10, E229, E230, E108
- **Skor (0–100):** `100 × (0.40 P(E266/M) + 0.35 P((E229+E230)/M) + 0.25 P(E108/M))`
- **Uygunluk:** M≥3; savunma≥3 maç; E266+E229+E230≥6
- **Yorum sınırı:** E156 bloklanan ortalar kimin tarafından bloklandı belirsiz: skor dışı; E10 verilen korner yalnız bağlamdır.
- **Durum:** **Önerilen**

### 30. 🎰 VAR'a Abone — Savunma • Taşlama

> Hakem düdüğü duyunca puanları hazır.

- **Event'ler:** E95, E213, E96, E94, E171, E2, E3, E10
- **Skor (0–100):** `100 × (0.40 P((E95+E213)/max(E2+E3,1)) + 0.35 P((E94+E10)/M) + 0.25 P((E95+E213)/M))`
- **Uygunluk:** M≥3; E2+E3≥3; E95+E213+E94+E10≥2
- **Yorum sınırı:** E96 kırmızı kart değildir: kısmi tetikleyici, skorda yok. E171 serbest vuruş nedeni belirsiz, açıklamada düşük güven.
- **Durum:** **Önerilen**

### 31. 🧤 Eldivenli Duvar — Kaleci • Övgü

> Topa “buradan geçemezsin” şifresi koymuş.

- **Event'ler:** E267
- **Skor (0–100):** `100 × (0.50 P(Saves/max(Saves+GoalsConceded,1)) + 0.25 P(E267/max(Saves,1)) + 0.25 P(CleanSheetsGK/max(M,1)))`
- **Uygunluk:** M≥3; kaleci rolü; Saves+GoalsConceded≥8
- **Yorum sınırı:** E267 “good direction saves”; diğer istatistikler maç JSON named fields. E49/50 türleri tanımlı değil, skor dışı.
- **Durum:** **Önerilen**

### 32. 🧤 Delik Eldiven — Kaleci • Taşlama

> Top eline geldi ama misafir olarak uğradı.

- **Event'ler:** E267, E49, E50
- **Skor (0–100):** `100 × (0.50 P(GoalsConceded/max(Saves+GoalsConceded,1)) + 0.30 P(GoalsConceded/M) + 0.20 P(1-E267/max(Saves,1)))`
- **Uygunluk:** M≥3; kaleci rolü; Saves+GoalsConceded≥8
- **Yorum sınırı:** Yenen golün kaleci hatası olduğu söylenemez. E49/50 yalnız subtype varlık göstergesi, etiketlenmeden skorlanmaz.
- **Durum:** **Önerilen**

### 33. 📈 Sonradan Açılan Füze — Sezon • Övgü

> Kariyerinde çay servisi, bu sezon hat-trick.

- **Event'ler:** E214, E11, E115
- **Skor (0–100):** `100 × (0.45 P((CurrentGoals+CurrentAssists)/max(CurrentGames,1) - ((CareerGoals-CurrentGoals)+(CareerAssists-CurrentAssists))/max(CareerGames-CurrentGames,1)) + 0.35 P(CurrentRating-((CareerRating*CareerGames-CurrentRating*CurrentGames)/max(CareerGames-CurrentGames,1))) + 0.20 P((CurrentGoals+CurrentAssists)/max(CurrentGames,1)))`
- **Uygunluk:** sezon maç≥8; sezon öncesi kariyer maç≥10; career>season
- **Yorum sınırı:** Sezon kariyerin alt kümesi: optimum karşılaştırma previous=(career-current) ayrı oyun sayılarıyla yapılmalı. Bu şablon kariyerden sezonu çıkararak önceki dönemi karşılaştırır.
- **Durum:** **Önerilen**

### 34. 🫠 Son Dakika Nazarı — Kulüp • Taşlama

> Klasman ısırıyor, form grafiği tatile çıktı.

- **Event'ler:** E214, E11
- **Skor (0–100):** `100 × (0.45 team_loss_rate_last_10 + 0.30 min(1,max(0,goalsAgainst-goals)/max(games,1)) + 0.25 max(0,allTimeWinRate-currentSeasonWinRate))`
- **Uygunluk:** takım son 5 maç; leaderboard iki dönem de var
- **Yorum sınırı:** Takım kartı, oyuncuya haksız suç atılmaz. Mevcut Kripto Grafiği bireysel puan oynaklığından farklı.
- **Durum:** **Önerilen**

### 35. 📉 90 Dakika Turist — Maç • Taşlama

> Sahada bulunduğu kesin, haritada görünmedi.

- **Event'ler:** E97, E174, E110, E108, E109, E215, E216, E212
- **Skor (0–100):** `100 × (0.35 P(1/(1+E174/max(SecondsPlayed,1)*5400)) + 0.35 P(1/(1+(E108+E109+E110)/max(SecondsPlayed,1)*5400)) + 0.30 P(1/(1+E215/max(SecondsPlayed,1)*5400)))`
- **Uygunluk:** M≥3; toplam oyun süresi≥180 dakika
- **Yorum sınırı:** E97 taşıma bağlamıdır; dakika ölçekleme validasyon gerekir. “Etkisiz” yorumu pozisyona göre ayarlanmalıdır.
- **Durum:** **Önerilen**

### 36. 🔫 VURSANA BE! — Deneysel • Taşlama

> Kaleci bekledi, defans bekledi, o hâlâ opsiyon bakıyor.

- **Event'ler:** E179, E217, E218, E182, E183, E177
- **Skor (0–100):** `100 × (0.60 P(E179/M) + 0.25 P(E182/M) + 0.15 P(1/(1+(E217+E218)/M)))`
- **Uygunluk:** M≥3; E179 en az 3 gözlemle yeniden doğrulanmalı
- **Yorum sınırı:** E179 sadece 2/2 gözlem: varsayılan kapalı. E183 “chose to pass” şut kaçırma kanıtı değildir.
- **Durum:** **Deneysel / kapalı**

### 37. 🧬 Tiki Taka DNA'sı — Deneysel • Övgü

> Top değmeden düşünmüş, top değince göndermiş.

- **Event'ler:** E150, E143, E24, E26, E215, E216
- **Skor (0–100):** `100 × (0.40 P(E150/M) + 0.35 P(E143/M) + 0.25 P(E215/max(E215+E216,1)))`
- **Uygunluk:** E150 en az 30 doğrulanmış oyuncu-maçta test edilmiş olmalı
- **Yorum sınırı:** E150 sadece 1/1, düşük güven; opsiyonel ve varsayılan kapalı.
- **Durum:** **Deneysel / kapalı**

### 38. 🐺 Çalım Vergisi — Deneysel • Övgü

> Çalıma kalkana terminalden ceza kesiyor.

- **Event'ler:** E159, E158, E164, E0, E1
- **Skor (0–100):** `100 × (0.35 P(E159/M) + 0.35 P(E158/M) + 0.30 P(E164/max(E0+E1,1)))`
- **Uygunluk:** E159 yeni örneklerle doğrulanmalı; en az 3 maç
- **Yorum sınırı:** E159 1/1, yalnız deneysel modda.
- **Durum:** **Deneysel / kapalı**

## Event kapsam envanteri ve doğrulama

- Aşağıdaki listenin `high-confidence` etiketi, **kullanıcının araştırma belgesindeki sınıflandırmadır**, EA onayı değil.
- 80 yüksek güven event'inin 79'u yeni kartların ana/yardımcı sinyalinde, kalan `E4` mevcut Gariban kartında kullanılıyor; böylece 80/80 kod kapsanıyor. Eğer eşleşmenin bire bir olmadığı kod varsa amaç gizlemek değil, kaynak event'i debug/QA panelinde de izlemektir.

- `E0`: A23, A24, A25, A38
- `E1`: A23, A24, A25, A26, A38
- `E2`: A24, A25, A30
- `E3`: A22, A24, A25, A30
- `E4`: **Mevcut Gariban kartında kullanılıyor; yeni kartta tekrar edilmiyor**
- `E6`: A19, A21
- `E10`: A21, A22, A29, A30
- `E11`: A07, A08, A09, A17, A20, A33, A34
- `E13`: A03, A04, A05
- `E14`: A03, A04, A05
- `E18`: A03, A05
- `E19`: A03, A05
- `E24`: A11, A13, A37
- `E25`: A11, A13, A14
- `E26`: A12, A37
- `E27`: A12, A14
- `E28`: A12
- `E29`: A12, A14
- `E30`: A10, A11, A13, A14
- `E31`: A10, A11, A13, A14
- `E32`: A13
- `E33`: A13, A14
- `E34`: A13
- `E35`: A13, A14
- `E36`: A17, A18
- `E37`: A14, A17, A18
- `E38`: A01, A02
- `E94`: A21, A22, A24, A25, A30
- `E95`: A22, A24, A25, A30
- `E97`: A02, A35
- `E99`: A26, A27
- `E100`: A26, A27
- `E101`: A26, A27
- `E102`: A26, A27
- `E103`: A26, A27
- `E105`: A21, A22, A26
- `E106`: A20, A26
- `E107`: A20
- `E108`: A21, A28, A29, A35
- `E109`: A35
- `E110`: A19, A20, A28, A35
- `E111`: A27
- `E112`: A01, A02, A20
- `E115`: A07, A08, A09, A33
- `E118`: A08, A17
- `E128`: A01, A06
- `E131`: A01, A06
- `E136`: A01, A06
- `E143`: A08, A09, A11, A37
- `E144`: A12
- `E145`: A17, A18
- `E147`: A01, A07, A08
- `E152`: A07, A08, A09, A10, A13, A16, A20
- `E153`: A10
- `E156`: A17, A18, A29
- `E158`: A19, A38
- `E163`: A19, A22, A23, A25
- `E164`: A19, A21, A23, A24, A25, A38
- `E171`: A25, A30
- `E174`: A01, A02, A20, A35
- `E175`: A15, A27
- `E176`: A09, A15, A16
- `E177`: A09, A15, A16, A36
- `E182`: A15, A16, A36
- `E183`: A15, A16, A36
- `E202`: A04
- `E207`: A15, A16
- `E212`: A15, A27, A35
- `E213`: A22, A24, A25, A30
- `E214`: A01, A03, A04, A05, A06, A07, A20, A33, A34
- `E215`: A07, A08, A11, A12, A13, A14, A15, A16, A18, A35, A37
- `E216`: A07, A08, A11, A12, A13, A14, A15, A16, A18, A35, A37
- `E217`: A03, A04, A05, A07, A36
- `E218`: A03, A04, A05, A07, A36
- `E219`: A26, A27
- `E229`: A23, A24, A28, A29
- `E230`: A23, A24, A28, A29
- `E265`: A28
- `E266`: A28, A29
- `E267`: A31, A32

## Kısmi / keşif event'leri: veri kaybı olmadan güvenli kullanım

- Kısmi anlam eşleştirmeleri doğrudan score'a yalnız belgeyle tanımlanmış koşulda girer. `E123` aşırtma için yaklaşık %99 precision bildiriyor; `E12,E124,E137,E140,E93,E238` gol tekniği olduğu belirlenmiş, ancak adlandırılmamış; bu kodları `gol_teknigi_belirsiz` denetim katmanına al. `E151,E157,E96,E104,E121,E49,E50` belirsizliklerini gizleme.
- `E179,E150,E159` için debug rozetleri çıkar ama geçerli olay örneği artana kadar gerçek ödül vermeyi kapalı tut. `E171` yüksek güven bölümünde olsa da adı soru işaretli olduğu için ağır cezaya dayanak yapılmamalı.
- Keşif goal-technique grubunda diğer kodlara göre düşük precision gösteren `E203,E21,E173,E194,E117` skora girmez; doğru isimsiz ham event olarak korunur. Sıfır olay görülmesi bozuk endpoint kanıtı değildir.
- Çok nadir ve tahminen gol tekniği olan `E48,E132,E122,E199,E168` de aday kodlar, isimlendirilmeden ayrı kanal/istatistik panelinde tutulur.

**Kısmi event envanteri:** E12, E49, E50, E93, E96, E104, E121, E123, E124, E128, E137, E140, E145, E150, E151, E157, E159, E179, E238

**Keşif event envanteri:** E15, E17, E21, E46, E48, E117, E122, E125, E126, E130, E132, E134, E135, E138, E139, E141, E168, E173, E194, E199, E203, E239

## Üretime alma sırası

1. **Önce:** 2, 3, 5, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31 numaralı kartlar (yüksek güvenli event ağırlıklı).
2. **Sonra:** 1, 4, 6, 10, 18, 22, 29, 32, 33, 34, 35 (anlam/örneklem/rol hassasiyeti veya mevcut kart çakışma kontrolü).
3. **Test alanı:** 36–38, gözlem sayısı artırılmadan ana sayfada yayımlanmaz.

## Test ve çalışırlık kontrol listesi

- Parsers: boş bucket, hatalı `id:count`, tekrar eden id, sayı dönüştürme, farklı maç türleri, null response, unplayed member.
- Veri tutarlılığı: E217+E218 ≈ named `shots`; E13+E18≈E217 ve E14+E19≈E218; E219=ΣE99..103; E112≥E38; E215+E153≈named `passesmade` (kapsam şartlarıyla). Fark görüldüğünde skor basmadan logla.
- Yetersiz kanıt: şut/süre eşiği, pozisyon havuzu, 3 maç, 4 aday, birden fazla etkene dayanan net lider farkı; aksi durumda “Kazanan yok” çıkmalı.
- QA: endeksin monotonluğu (olumlu arttıkça skor artmalı), eşitlik, sıfır payda, 0 maç, kadro değişimi, isim/gamertag değişimi, aynı oynayan oyuncu birden fazla profili, bot/Any ayrımı, rakip oyuncunun sızmaması.
- Görünüm: 3 mini metrik + slogan; kaynak maç ID'leri açılır kanıt panelinde, ana kartta ham JSON yok. Her kart üç farklı ekran boyutunda aynı yükseklikte görüntülenmeli.
- Raporun bir bileşeninde istenen her event'in gerçekten görüldüğü, değerinin sıfır olmadığı, her haftaki kazanan hesaplamasının buna bağlı olduğu garanti edilemez. **Kullanılabilir her güvenilir event değerlendirmeye alınabilir, ama boş veri için sahte kazanan üretilemez.**
