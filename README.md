# LEO XI Clubhouse

LEO XI FC27 Pro Clubs takımının gerçek EA verileriyle çalışan siyah–altın kulüp merkezi.

## Özellikler

- Sade, mobil uyumlu tasarım; LEO XI logosu ve hafif geçişler.
- Kulüp toplamları, son maç formu ve atılan/yenilen gol grafiği.
- Kalıcı maç arşivi: son lig maçları 30 dakikada bir alınır, maç ID'siyle tekilleştirilir ve Cloudflare SQLite-backed Durable Object deposunda tutulur.
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

İlk yayında `CLUB_STORE` deposu, `ClubStore` sınıfı için SQLite migration ile otomatik oluşturulur. Ayrıca `*/30 * * * *` Cron Trigger tanımlanır. Ayrı bir D1 veritabanı veya manuel database ID gerekmez. Cloudflare hesabının bu işlemler için yetkisi bulunmalıdır. Preview builds şimdilik kapalı tutulabilir.

Yerelden doğrudan yayınlamak için:

```bash
pnpm exec wrangler login
pnpm deploy
```

Yayın sonrası `/api/archive` yanıtında `persistent: true` görülmelidir. Cloudflare panelindeki Domains bölümünden `workers.dev` adresi veya özel domain kullanılabilir. Depo verisi code deployları arasında korunur; Worker/namespace silinirse bu garanti geçerli değildir.

## Veri kapsamı

Kulüp ID **79638**, platform **common-gen5**. Kaynak: EA Clubs.

Arşiv, 7 Ekim 2026 tarihinde alınmış 10 gerçek lig maçıyla başlatılır; bundan sonra görülen maçlar eklenir. EA'nın artık döndürmediği eski maçlar geri getirilemez. 30 dakikalık kontroller arasında EA'nın sınırlı son-maç penceresinden düşen kayıtlar veya uzun EA kesintileri nedeniyle kapsam eksik kalabilir. Haftalık ödül ve grafikler yalnız kayıtlı maçlara göre hesaplanır. Takım ve kadro toplamları EA'nın ayrı toplam istatistikleridir.

EA erişilemiyorsa son doğrulanmış kayıt ve kayıt tarihi gösterilir. Katılım panosu takım üyelerinin beyanıyla çalışır; kullanıcı hesabı doğrulaması yoktur. Kesin diziliş ve sağ/sol konum bilgisi bulunmadığından saha görünümü yoktur.

## Teknik yapı

React 19, TypeScript, Vinext/Vite ve Cloudflare Workers. `lib/club-store.ts` kalıcı kayıt ve katılım API'sini, `lib/club-model.mjs` hesapları içerir. Worker giriş noktası `build/sites-worker.ts`, dağıtım yapılandırması `vite.config.ts` içindedir.

GitHub Pages sunucu API'sini ve kalıcı depoyu çalıştıramaz. Cloudflare yayını için ChatGPT oturumu veya linki gerekmez. `.openai/hosting.json` ilk kaynak projesinin kimliğini içerir; erişim anahtarı değildir.

Bağımsız takım sitesidir; EA SPORTS ile bağlantılı değildir.
