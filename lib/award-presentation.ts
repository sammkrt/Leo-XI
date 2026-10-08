import type {
  AwardCandidate,
  AwardReport,
  AwardResult,
} from "./derived-awards.ts";
const fmt = (n: number, digits = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("tr-TR", { maximumFractionDigits: digits })
    : "Veri yok";
export function awardCardContent(
  result: AwardResult,
  candidate: AwardCandidate,
  report: AwardReport,
) {
  const t = candidate.totals,
    component = candidate.components[0];
  const facts: Record<
    string,
    () => { value: string; evidence: [string, string] }
  > = {
    washing: () => ({
      value: `%${fmt(100 * component.adjusted)} düzeltilmiş golsüz şut`,
      evidence: [`${t.S} şutun ${t.waste}’i gol olmadı`, `${t.G} gol`],
    }),
    potato: () => ({
      value: `Her 100 pasta ${fmt((100 * t.PF) / t.PA)} hata`,
      evidence: [
        `${t.PF} hata / ${t.PA} deneme`,
        `Maç başına ${fmt(t.PF / candidate.M)} hata`,
      ],
    }),
    carrying: () => ({
      value: `Maç başına ${fmt(component.adjusted)} düzeltilmiş gol katkısı`,
      evidence: [
        `${t.G} gol · ${t.A} asist`,
        `Kayıtlı katkıda %${fmt((100 * t.output) / t.teamOutput)} pay`,
      ],
    }),
    fouls: () => ({
      value: `Maç başına ${fmt(component.adjusted)} düzeltilmiş faul`,
      evidence: [
        `${t.F} faul`,
        result.definition.variant === "full"
          ? `${t.Y} sarı · ${t.RC} kırmızı`
          : "Kart kapsamı yok · yalnız faul sürümü",
      ],
    }),
    assassin: () => ({
      value: `${fmt(t.discipline / t.F, 2)} faul başına ceza yükü`,
      evidence: [`${t.F} faul`, `${t.Y} sarı · ${t.RC} kırmızı`],
    }),
    vacuum: () => ({
      value: `Maç başına ${fmt(component.adjusted)} düzeltilmiş pas arası`,
      evidence: [`${t.I} pas arası`, `${t.R} bölgesel top kazanma`],
    }),
    customs: () => ({
      value: `%${fmt((100 * t.I) / t.reading)} kayıt sayaçlarında pas arası profili`,
      evidence: [`${t.I} pas arası`, `${t.TW} başarılı müdahale`],
    }),
    toll: () => ({
      value: `%${fmt(100 * component.adjusted)} düzeltilmiş kaçırılan müdahale`,
      evidence: [
        `${t.miss} başarısız / ${t.TA} deneme`,
        `${t.TW} başarılı müdahale`,
      ],
    }),
    forward: () => ({
      value: `Maç başına ${fmt(component.adjusted)} düzeltilmiş başarılı ileri pas`,
      evidence: [
        `${t.FC} başarılı / ${t.FA} ileri deneme`,
        `%${fmt(100 * candidate.components[1].adjusted)} düzeltilmiş başarı`,
      ],
    }),
    backward: () => ({
      value: `%${fmt((100 * t.BC) / t.directionMade)} geri pas tercihi`,
      evidence: [
        `${t.BC} başarılı geri pas`,
        `${t.directionMade} yönü sınıflanmış başarılı pas`,
      ],
    }),
    locksmith: () => ({
      value: `Maç başına ${fmt(component.adjusted)} düzeltilmiş hazırlama katkısı`,
      evidence: [
        `${t.A} asist`,
        result.definition.variant === "full"
          ? `${t.A2} ikinci asist`
          : "İkinci asist kapsamı yok · yalnız asist sürümü",
      ],
    }),
    stowaway: () => ({
      value: `${fmt(component.adjusted, 2)}× gol payı / şut payı`,
      evidence: [
        `Şut payı %${fmt((100 * t.S) / t.teamS)}`,
        `Gol payı %${fmt((100 * t.G) / t.teamG)}`,
      ],
    }),
    crypto: () => ({
      value: `${fmt(component.raw, 2)} puan farkı standart sapması`,
      evidence: [
        `${candidate.M} geçerli maç`,
        "Her maçta ≥3 başka geçerli insan puanı",
      ],
    }),
    quiet: () => ({
      value: `%${fmt(100 * candidate.components[2].adjusted)} düzeltilmiş pas başarısı`,
      evidence: [
        `${t.I} pas arası · ${t.R} bölgesel kazanım`,
        `${t.G + t.A} gol + asist`,
      ],
    }),
  };
  return {
    title: result.definition.title,
    player: candidate.proName,
    name: candidate.name,
    joke: result.definition.joke,
    ...facts[result.definition.id](),
    period: report.period,
    matches: candidate.M,
    index:
      candidate.index === null
        ? "Endeks üretilmedi"
        : `${fmt(candidate.index)}/100 · Unvan endeksi`,
    version: report.version,
    asOf: report.asOf,
    status: report.provisional ? "Geçici dönem" : "Tamamlanmış dönem",
  };
}
const escapeXML = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
/** The on-screen card and PNG consume exactly this same result, never recompute statistics. */
export function awardCardSVG(
  result: AwardResult,
  candidate: AwardCandidate,
  report: AwardReport,
) {
  const c = awardCardContent(result, candidate, report);
  const lines = [
    c.title,
    c.player,
    c.joke,
    c.value,
    ...c.evidence,
    `${c.period} · ${c.matches} geçerli maç`,
    c.index,
    c.status,
    `Kayıt: ${c.asOf} · ${c.version}`,
  ];
  const wrap = (s: string, max = 49) => {
    const out: string[] = [];
    let line = "";
    for (const word of s.split(" ")) {
      if ((line + " " + word).trim().length > max && line) {
        out.push(line);
        line = word;
      } else line = (line + " " + word).trim();
    }
    if (line) out.push(line);
    return out;
  };
  let y = 120;
  const body = lines
    .map((line, i) => {
      const font = i < 2 ? 32 : i === 2 ? 20 : 21;
      const texts = wrap(line).map((text) => {
        const node = `<text x="46" y="${y}" font-size="${font}" fill="${i === 0 || i === 1 ? "#173de8" : "#29384d"}">${escapeXML(text)}</text>`;
        y += font + 12;
        return node;
      });
      y += i === 1 ? 18 : 8;
      return texts.join("");
    })
    .join("");
  const height = Math.max(760, y + 70);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" font-family="Arial, sans-serif"><rect width="720" height="${height}" fill="#ffffff"/><rect x="18" y="18" width="684" height="${height - 36}" rx="10" fill="#f7f9ff" stroke="#dce2ef"/><text x="46" y="66" fill="#173de8" font-size="24" font-weight="700">LEO XI · TAKIMIN UNVANLARI</text>${body}<text x="46" y="${height - 38}" font-size="15" fill="#596476">Takım içi eğlence endeksi · başarı yüzdesi değildir.</text></svg>`;
}
export const awardMapPresets = [
  {
    id: "award-potato",
    award: "potato",
    label: "Unvan: Pas hata profili",
    xLabel: "Düzeltilmiş pas hata oranı · %",
    yLabel: "Pas hatası / maç",
  },
  {
    id: "award-washing",
    award: "washing",
    label: "Unvan: Gol dönüşümü / şut hacmi",
    xLabel: "Düzeltilmiş gol dönüşümü · %",
    yLabel: "Şut / maç",
  },
  {
    id: "award-forward",
    award: "forward",
    label: "Unvan: İleri pas profili",
    xLabel: "Düzeltilmiş ileri pas başarısı · %",
    yLabel: "Başarılı ileri pas / maç",
  },
  {
    id: "award-toll",
    award: "toll",
    label: "Unvan: Müdahale profili",
    xLabel: "Düzeltilmiş müdahale başarısı · %",
    yLabel: "Müdahale denemesi / maç",
  },
  {
    id: "award-carrying",
    award: "carrying",
    label: "Unvan: Gol katkısı / katkı payı",
    xLabel: "Düzeltilmiş gol + asist / maç",
    yLabel: "Ortak maçların kayıtlı insan katkı payı · %",
  },
];
export function awardCoordinates(result: AwardResult, c: AwardCandidate) {
  const t = c.totals;
  switch (result.definition.id) {
    case "potato":
      return { x: 100 * c.components[0].adjusted, y: t.PF / c.M };
    case "washing":
      return { x: 100 * (1 - c.components[0].adjusted), y: t.S / c.M };
    case "forward":
      return { x: 100 * c.components[1].adjusted, y: t.FC / c.M };
    case "toll":
      return { x: 100 * (1 - c.components[0].adjusted), y: t.TA / c.M };
    case "carrying":
      return {
        x: c.components[0].adjusted,
        y: (100 * t.output) / t.teamOutput,
      };
    default:
      return null;
  }
}
