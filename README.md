# LEO XI — Pro Clubs Club Tracker

LEO XI FC27 Pro Clubs takımının gerçek EA verilerini gösteren web sitesi.

**Canlı site:** https://leo-xi-clubs.samkrt.chatgpt.site

## Özellikler

- Takım istatistikleri ve son maç formu
- 12 oyuncunun kayıtlı kadrosu, oyuncu profilleri ve gol/asist sıralaması
- EA kaynağının döndürdüğü son 10 lig maçı ve sonuç filtreleri
- Oyuncu arama ve sıralama
- Mobil uyumlu koyu lacivert/turkuaz tema ve LEO XI logosu
- Veri yenileme düğmesi; EA erişilemezse tarihli doğrulanmış kayıt

## Yerel çalıştırma

Node.js 22.13 veya üzeri ve package.json içindeki sürümle uyumlu pnpm gerekir.

```bash
git clone https://github.com/sammkrt/Leo-XI.git
cd Leo-XI
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Geliştirme sunucusu: http://localhost:5173

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm start
```

## Veri kaynağı

Kulüp ID: **79638** · Platform: **common-gen5**.

`app/api/club/route.ts`, EA Clubs kaynağından kulüp bilgisi, toplam istatistikler, oyuncular ve son lig maçlarını alır. `data/snapshot.json` 7 Ekim 2026 tarihinde alınmış gerçek yedek kaydı içerir. Yenileme manuel olarak yapılır; kesintisiz sezon arşivi veya zamanlanmış veri toplama yoktur.

EA'nın son maç listesinin kapsamı sınırlıdır. Görünen maçlar tüm sezonu temsil etmez. Kesin diziliş ve sağ/sol oyuncu konumları sunulmadığından saha görünümü bulunmaz.

## Teknoloji ve yayınlama

React 19, TypeScript, Vinext/Vite, Cloudflare Workers ve Lucide ikonları. `build/` ve `scripts/` mevcut Sites/Workers derleme entegrasyonunu içerir. `.openai/hosting.json` mevcut Sites projesinin kimliğini taşır; parola veya erişim anahtarı içermez.

API sunucu tarafında çalışır: bu proje doğrudan statik GitHub Pages üzerinde aynı şekilde çalışmaz. Kaynak kodun GitHub'a aktarılması mevcut canlı siteyi veya erişim ayarlarını değiştirmez.

Bağımsız takım sitesidir; EA SPORTS ile bağlantılı değildir.
