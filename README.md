# LEO XI Clubhouse

LEO XI FC27 Pro Clubs takımının gerçek EA verileriyle çalışan siyah–altın kulüp merkezi.

## Özellikler

- Sade, mobil uyumlu tasarım; LEO XI logosu ve hafif geçişler.
- Kulüp toplamları, son maç formu ve atılan/yenilen gol grafiği.
- Kalıcı maç arşivi: son 10 lig maçı için her gün 04:17 Europe/Amsterdam saatinde veri alma denemesi yapılır; EA erişimi şu anda 403 nedeniyle başarısızdır, maç ID'siyle tekilleştirilir ve Cloudflare SQLite-backed Durable Object deposunda tutulur.
- Maç detayları: her iki takımın oyuncu puanları, gol/asistleri, başarılı/denenen pasları ve müdahaleleri.
- Haftanın oyuncusu: son 7 günde en az 3 kayıtlı maç; en yüksek ortalama EA puanı. Eşitlikte maçın oyuncusu sayısı, sonra maç sayısı.
- Oyuncu karşılaştırması: maç başına gol, asist ve müdahale; EA ortalama puanı ve pas yüzdesi.
- Maç gecesi katılımı: güne göre ortak Geliyorum / Belki / Gelemiyorum listesi; yeniden yayınlamalarda korunur.

## Yerel çalıştırma

Node.js 22.16 veya üzeri, pnpm 11.25.0.  

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Geliştirme sunucusu: http://localhost:5173

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm start
```

Durable Object deposu yerel Wrangler/Miniflare ortamında çalışır. `.wrangler/` içeriği Git'e gönderilmez.

## Sayfa adresleri

Bölümler `/maclar`, `/kadro`, `/karsilastir`, `/mac-gecesi` ve `/analiz` adreslerinden doğrudan açılır. Tek maç analizi `/analiz/mac/{matchId}`, seans analizi `/analiz/seans/{seansId}` biçimindedir. Diğer analiz görünümleri `/analiz/oyuncular`, `/analiz/karsilastir`, `/analiz/matris`, `/analiz/ikili` ve `/analiz/gelisim` adreslerini kullanır.

Yalnız varsayılandan farklı filtreler sorgu parametresi olarak tutulur; örneğin `/analiz/mac/74140658290365?mode=total`. Eski `leo_*` bağlantıları seçimi koruyarak temiz adreslere HTTP 308 ile yönlendirilir. Sayfa yenileme ve tarayıcının geri/ileri düğmeleri desteklenir. Bölüm değiştirildiğinde analiz filtreleri diğer bölümlerin adreslerine taşınmaz. `/api/club`, `/api/archive` ve `/api/attendance` uç noktaları değişmez.

## Cloudflare Workers ile yayınlama

Cloudflare Workers & Pages bölümünde GitHub reposu `sammkrt/Leo-XI`, üretim dalı `main` seçilir.

| Alan | Değer |
| --- | --- |
| Project name | `leo-xi` |
| Build command | `pnpm run build` |
| Deploy command | `pnpm exec wrangler deploy --config dist/server/wrangler.json --name leo-xi` |
| Path | `/` |
| Build variable: NODE_VERSION | `22.16.0` |
| Build variable: PNPM_VERSION | `11.25.0` |

İlk yayında `CLUB_STORE` deposu, `ClubStore` sınıfı için SQLite migration ile otomatik oluşturulur. Ayrıca `*/5 * * * *` Cron Trigger tanımlanır; EA yerine yayımlanmış veri dosyasını kalıcı depoya aktarır. Ayrı bir D1 veritabanı veya manuel database ID gerekmez. Cloudflare hesabının bu işlemler için yetkisi bulunmalıdır. Preview builds şimdilik kapalı tutulabilir.

Yerelden doğrudan yayınlamak için:

```bash
pnpm exec wrangler login
pnpm deploy
```

Yayın sonrası `/api/archive` yanıtında `persistent: true` görülmelidir. Cloudflare panelindeki Domains bölümünden `workers.dev` adresi veya özel domain kullanılabilir. Depo verisi code deployları arasında korunur; Worker/namespace silinirse bu garanti geçerli değildir.

## Veri kapsamı

Kulüp ID **79638**, platform **common-gen5**. Kaynak: EA Clubs.

Arşiv, 7 Ekim 2026 tarihinde alınmış 10 gerçek lig maçıyla başlatılır; bundan sonra görülen maçlar eklenir. EA'nın artık döndürmediği eski maçlar geri getirilemez. Günlük kontroller arasında EA'nın sınırlı son-maç penceresinden düşen kayıtlar veya uzun EA kesintileri nedeniyle kapsam eksik kalabilir. Haftalık ödül ve grafikler yalnız kayıtlı maçlara göre hesaplanır. Takım ve kadro toplamları EA'nın ayrı toplam istatistikleridir.

EA erişilemiyorsa son doğrulanmış kayıt ve kayıt tarihi gösterilir. Katılım panosu takım üyelerinin beyanıyla çalışır; kullanıcı hesabı doğrulaması yoktur. Kesin diziliş ve sağ/sol konum bilgisi bulunmadığından saha görünümü yoktur.

## Teknik yapı

React 19, TypeScript, Vinext/Vite ve Cloudflare Workers. `lib/club-store.ts` kalıcı kayıt ve katılım API'sini, `lib/club-model.mjs` hesapları içerir. Worker giriş noktası `build/sites-worker.ts`, dağıtım yapılandırması `vite.config.ts` içindedir.

GitHub Pages sunucu API'sini ve kalıcı depoyu çalıştıramaz. Cloudflare yayını için ChatGPT oturumu veya linki gerekmez. `.openai/hosting.json` ilk kaynak projesinin kimliğini içerir; erişim anahtarı değildir.

Bağımsız takım sitesidir; EA SPORTS ile bağlantılı değildir.

## Otomatik veri güncelleme

`Update EA club data` GitHub Actions işi UTC saatine göre her saatin 07 ve 37. dakikalarında EA verilerini alır, kulüp ve yanıt yapısını doğrular ve yalnız `club-data` dalındaki `latest.json` dosyasını günceller. Node.js 22 üzerinde çalışır; harici token veya Cloudflare secret gerekmez. İş yalnız bu depoda geçici `GITHUB_TOKEN` ile `contents: write` izni kullanır. Veri dalı ilk kurulumda oluşturulmuştur; uygulama üretim dalı `main` olarak kalır.

Cloudflare her 5 dakikada bu dosyayı okuyup mevcut kalıcı arşive işler. Kullanıcı istekleri EA'ya veya GitHub'a veri çekme isteği başlatmaz. Yenile düğmesi kaldırılmıştır; açık sayfa 5 dakikada bir yalnız sitenin kayıtlı verisini okur. Her veri yenilemesi için uygulama build'i gerekmez.

GitHub zamanlanmış işleri gecikebilir; kesin dakika garantisi yoktur. Public depolarda 60 gün repo etkinliği yoksa GitHub zamanlanmış işleri devre dışı bırakabilir; Actions sayfasından tekrar etkinleştirilir. Actions sekmesinde `Update EA club data` işi ve çalışma sonucu izlenebilir; gerekirse `Run workflow` ile yönetici tarafından başlatılır. EA hatası veya geçersiz yanıt halinde mevcut dosya değiştirilmez; Cloudflare okuma hatasında da kayıtlar korunur.

## Gelişmiş olay analizi

Analiz sekmesinde tüm kayıtlar / son 7 gün / son 30 gün ve oyuncu filtresi bulunur. Maç detayında seçili takımın toplamı veya tek oyuncusu analiz edilir. Pas yönü ve uzunluğu için başarılı/hatalı olay sayıları; şut, isabetli şut, dripling, pas arası, ikinci asist, pozisyon uyarıları ve üç bölgedeki top kazanma/kaybetme sayıları gösterilir.

Eşleştirme kaynağı: https://github.com/Interactive-63/eafc-pro-clubs-api-research . Yalnız araştırmada confirmed/high confidence olarak sınıflanan kodlar kullanılır; bunlar resmî EA tanımları değildir. Gol, asist ve şut kodları varsa adlandırılmış alanlarla karşılaştırılır. Eksik/bozuk veya doğrulaması uyuşmayan satırlar dışlanır ve oyuncu-maç kapsamı gösterilir. Ofsayt pasları ve alt kategori kapsamı nedeniyle pas toplamları standart tablodan farklı olabilir; kalan negatifse sıfır uydurmak yerine hesaplanamadı gösterilir. Şut olayları bloklanan şutları içerebilir. Pozisyon uyarıları süre veya kesin saha konumu değildir.

Başlangıçtaki LEO XI kaydında 10 maç, 91 oyuncu-maç satırı ve kullanılabilir 90 olay kaydı vardır. Bu 90 satırın gol, asist ve şut eşleştirmeleri mevcut EA alanlarıyla doğrulanmıştır. Analiz yeni veriye erişim sağlayan bir servis değildir; mevcut veya sonradan arşive eklenen kayıtları yorumlar. EA 403 erişim sorunu bu özellikten bağımsızdır.


## Kayıtlı maç karşılaştırması

Karşılaştır sayfasındaki Kayıtlı maçlar görünümü, kulüp oyuncu toplamlarından ayrı bir örneklem kullanır. Tüm kayıtlar veya son 5/10 uygun maç; yalnız ortak maçlar; kayıttaki pozisyon ve ayrı maç türü filtreleri vardır. Eski kayıtlar leagueMatch uç noktasından alınmıştır.

Yedi kategori 108 olay göstergesi içerir: hücum, pas, savunma, bölgesel top kaybı/kazanma, dripling, disiplin ve pozisyon/karar geri bildirimi. Yüzdeler toplam pay/payda üzerinden hesaplanır, her göstergenin kendi geçerli maç kapsamı gösterilir. Olay eşleştirmeleri topluluk araştırmasıdır. Tutarsız farklar sıfırlanmaz; ilgili kayıtlardan çıkarılır. Medyan ve popülasyon standart sapması isteğe bağlıdır; sıfır denemeli maçlar yüzde dağılımından çıkarılır. Son 5 ve önceki 5 gol+asist ortalamaları ile son 10 hareketli ortalaması seçili örneklemdeki kişisel maçlara dayanır.

Ham olaylar arşivde tutulur; matchId + playerId satırları karşılaştırmada tekilleştirilir. Eksik olay yanıtları gözlenen sıfırdan ayrılır. Güvenilir dakika doğrulaması olmadığından per-90, geçerli denemeler bulunmadığından dripling/hava topu başarı yüzdesi, partial E96 kodundan kırmızı kart, xG ya da özel karar kalitesi puanı üretilmez. Bu özellik yeni veri erişimi sağlamaz ve EA 403 sorununu çözmez.


## Günlük veri toplama

`Update EA club data` işi maç gecesinden sonra Amsterdam saatiyle 03:17, 04:17, 05:17 ve 06:17'de çalışır (`timezone: Europe/Amsterdam`). Böylece geçici bir EA erişim hatasından sonra aynı gece üç ek toplama fırsatı bulunur. GitHub zamanlanmış işleri gecikebilir. Cloudflare beş dakikada bir son yayımlanmış doğrulanmış dosyayı arşive aktarır; bu kontrol veri alma zamanını yenilemez. Son başarılı EA kayıt zamanı arayüzde açıkça gösterilir. 36 saatten eski kayıt için günlük güncelleme gecikmesi bildirilir. Başarısız EA istekleri veri dosyasını değiştirmez ve eski maçları silmez.

7 Ekim 2026 tarihinde aynı GitHub macOS runner üzerinde Node fetch sade başlıklarla HTTP 403, Python urllib sade başlıklarla zaman aşımı, Python urllib uyumluluk başlıklarıyla başarılı JSON döndürmüştür. Son yöntem 14:59:52 UTC tarihinde 79638 kulübünün 10 lig maçını doğrulayıp yayımlamıştır (Actions run 37641253269). Günlük zamanlama artık bu çalışan Python istemcisini kullanır. Bu gözlem gelecekte EA erişiminin değişmeyeceğini garanti etmez. Günlük son 10 maç kapsamı tüm sezonun eksiksiz arşivi anlamına gelmez.


## Bağımsız maç toplama

Günlük iş `node scripts/update-club-data.mjs --matches-only` çalıştırır. Yalnız `/clubs/matches` adresinden son 10 lig maçını alır ve doğrulanan yanıtı `club-data/matches.json` dosyasına yazar. `overallStats`, oyuncu ve liderlik tablosu uç noktalarının hataları bu işi artık engellemez. Tam istatistik toplama ayrı olarak betiğin varsayılan modu ile yapılabilir; günlük maç işi takım/kadro toplamlarını yenilemez.

Cloudflare önce maç dosyasını okur. İlk maç dosyası henüz yoksa (yalnız 404 durumunda) eski `latest.json` kaydını kullanır; diğer hatalarda mevcut arşivi korur. Maç yanıtının kulüp ID, maç türü, zaman ve tekilleştirme kontrolleri yapılır. Yeni maç dosyası toplam istatistiklerin `fetchedAt` zamanını değiştirmez. Arşiv `lastMatchUpdate` bilgisini ayrı gösterir. Yeni veri yoksa kontrol saati son başarılı veri alma saati olarak sunulmaz. Tarayıcıdan başarılı erişim, GitHub runner erişiminin de başarılı olduğunu kanıtlamaz.


## EA HTTP istemcisi

`scripts/fetch-ea-json.py` Python standart kütüphanesindeki urllib ile yalnız izin verilen FC uç noktalarını çağırır. Accept-Language, Sec-Fetch-Site ve istemci uyumluluk başlıkları topluluk istemcisindeki gözleme dayanır: https://github.com/1erkandogan/fc27-clubs-api . Üçüncü taraf kod veya paket çalıştırılmaz; çerez, kullanıcı kimlik bilgisi, ek proxy veya TLS doğrulamasını kapatma kullanılmaz. EA'nın kendi karar mekanizması görünmediğinden tek bir başlığın hatanın kesin nedeni olduğu ileri sürülmez.

Günlük ve push çalışmaları yalnız çalışan yöntemi kullanır. Actions → Run workflow → diagnostics seçeneği istenirse aynı runner üzerinde iki ek karşılaştırma isteği yapar. Hata durumunda yalnız HTTP kodu ve varsa EA referans numarası günlüğe yazılır; hata sayfasının tamamı yayımlanmaz. Yanıtlar doğrulanmadan kalıcı veri güncellenmez.

## Performans laboratuvarı

Analiz sekmesi kayıtlı maçları takım, oyuncu, maç, seans ve gelişim görünümlerinde inceler. Filtreli CSV/JSON, tam ham arşiv JSON ve tarayıcı PDF raporu sunar. Eksik veri ve örneklem sınırları için [analiz sözleşmesine](docs/ANALYTICS.md) bakın.

## Haftanın kartları

Ana sayfadaki dört küçük kart son 7 günlük kayıtlı maçlardan hesaplanır: Çamaşır Makinesi (şut − gol), Patates (denenen − başarılı pas), En Gayi (güncel kadroda en az kayıtlı maç) ve Eşek Yükü (gol + asist). Eşitlikte tüm oyuncular gösterilir. Kadro üyesinin hiç görünmemesi 0 kayıtlı maç sayılır; hiç oyuncu kaydı olmayan haftada unvan verilmez. Eksik veya tutarsız sayaçlar sıfır kabul edilmez; bir oyuncunun ilgili metriği tüm haftalık görünümlerinde geçerli değilse o metrik için unvan adayı yapılmaz. Golsüz şut, kaçan net fırsat anlamına gelmez. Eski büyük Haftanın Oyuncusu kartı kaldırılmıştır.
