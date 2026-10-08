import { playerRows, metrics } from "./club-analytics.ts";
import type { PlayerRow } from "./club-analytics.ts";
import { playerEvents, decodedPlayer } from "./club-events.mjs";
import { amsterdamDay } from "./club-model.mjs";
import {
  uniqueRawMatches,
  rawExportOptions,
  selectRawMatches,
} from "./club-export.ts";
import type { Match } from "./club-types";

export const AWARD_VERSION = "leo-titles-v1";
export const awardRules = {
  minCandidates: 4,
  minMatches: 3,
  minRolePeers: 3,
  priorMatches: 3,
  shotPrior: 5,
  passPrior: 20,
  tacklePrior: 8,
  equalityTolerance: 1e-9,
  minIndexGap: 0.5,
  minIndexSpread: 1,
  minRelativeDifference: 0.01,
};
export type AwardRules = typeof awardRules;
type Values = Record<string, number | null>;
type AwardRow = PlayerRow & { values: Values; issues: string[] };
type Counts = Record<string, number>;
export type AwardMember = { name: string; proName: string };
export type AwardCategory =
  "attack" | "passing" | "defense" | "contribution" | "style" | "consistency";
type ComponentSpec = {
  key: string;
  label: string;
  weight: number;
  kind: "perMatch" | "rate" | "raw";
  numerator?: string;
  denominator?: string;
  prior?: "shotPrior" | "passPrior" | "tacklePrior";
  sign?: number;
};
type Thresholds = Record<string, number>;
export type AwardDefinition = {
  id: string;
  title: string;
  icon: string;
  category: AwardCategory;
  variant: string;
  joke: string;
  fields: string[];
  thresholds: Thresholds;
  max?: Thresholds;
  components: ComponentSpec[];
  formula: string;
  limitation: string;
};
const per = (
  key: string,
  label: string,
  weight: number,
  numerator = key,
): ComponentSpec => ({ key, label, weight, kind: "perMatch", numerator });
const rate = (
  key: string,
  label: string,
  weight: number,
  numerator: string,
  denominator: string,
  prior: ComponentSpec["prior"],
): ComponentSpec => ({
  key,
  label,
  weight,
  kind: "rate",
  numerator,
  denominator,
  prior,
});
const raw = (
  key: string,
  label: string,
  weight: number,
  sign = 1,
): ComponentSpec => ({ key, label, weight, kind: "raw", sign });
const definition = (
  id: string,
  title: string,
  icon: string,
  category: AwardCategory,
  joke: string,
  fields: string[],
  thresholds: Thresholds,
  components: ComponentSpec[],
  formula: string,
  limitation: string,
  variant = "full",
  max?: Thresholds,
): AwardDefinition => ({
  id,
  title,
  icon,
  category,
  joke,
  fields,
  thresholds,
  components,
  formula,
  limitation,
  variant,
  max,
});
/** Product rules, not a scientific player-quality model. Missing components never redistribute weights. */
export const awardRegistry: AwardDefinition[] = [
  definition(
    "washing",
    "Çamaşır Makinesi",
    "🧺",
    "attack",
    "Sıkma programı çalıştı, gol programı beklemede.",
    ["S", "G", "waste"],
    { S: 8, waste: 5 },
    [
      rate(
        "wasteRate",
        "Düzeltilmiş golsüz şut oranı",
        0.65,
        "waste",
        "S",
        "shotPrior",
      ),
      per("wastePerMatch", "Düzeltilmiş golsüz şut / maç", 0.35, "waste"),
    ],
    "100 × [0,65 P(adjRate(S−G,S,5)) + 0,35 P(adjMatch(S−G,M))]",
    "Şut kalitesi, kaçan net fırsat veya xG altı performans ölçülmez.",
  ),
  definition(
    "potato",
    "Patates",
    "🥔",
    "passing",
    "Paslar sıcak, adresler karışık.",
    ["PA", "PC", "PF"],
    { PA: 40, PF: 8 },
    [
      rate(
        "failRate",
        "Düzeltilmiş pas hata oranı",
        0.7,
        "PF",
        "PA",
        "passPrior",
      ),
      per("failPerMatch", "Düzeltilmiş pas hatası / maç", 0.3, "PF"),
    ],
    "100 × [0,70 P(adjRate(PF,PA,20)) + 0,30 P(adjMatch(PF,M))]",
    "Oyun sorumluluğu ve ileri pas tercihi bağlamdır; ham hata toplamı tek başına kazandırmaz.",
  ),
  definition(
    "carrying",
    "Eşek Yükü",
    "🎒",
    "contribution",
    "Takımın bagajı yine bunun sırtında.",
    ["G", "A", "output", "teamOutput"],
    { output: 3 },
    [
      per("outputPerMatch", "Düzeltilmiş gol katkısı / maç", 0.55, "output"),
      raw("involvementShare", "Kayıtlı insan katkı payı", 0.45),
    ],
    "100 × [0,55 P(adjMatch(G+A,M)) + 0,45 P((G+A)/Σ insan(G+A))]",
    "Gol+asist benzersiz takım golü değildir. Pay yalnız oyuncunun ortak geçerli maçlarındaki kayıtlı insan katkısını kapsar.",
  ),
  definition(
    "fouls",
    "Davar",
    "🐑",
    "defense",
    "Topa da rakibe de aynı mesafede.",
    ["F", "Y", "RC", "discipline"],
    { F: 3 },
    [
      per("foulIntensity", "Düzeltilmiş faul / maç", 0.7, "F"),
      per(
        "disciplineLoad",
        "Düzeltilmiş disiplin yükü / maç",
        0.3,
        "discipline",
      ),
    ],
    "100 × [0,70 P(adjMatch(F,M)) + 0,30 P(adjMatch(Y+3RC,M))]",
    "E95 doğrudan, E213 avantaj sonrası sarıdır; ikinci sarı değildir. Kırmızı ayrı EA redcards alanıdır. İkinci sarıdan ihraç ayrıştırılamaz; sarılar ve 3×kırmızı ayrı ceza boyutlarıdır, benzersiz kart sayısı değildir.",
  ),
  definition(
    "fouls",
    "Davar · yalnız faul",
    "🐑",
    "defense",
    "Topa da rakibe de aynı mesafede.",
    ["F"],
    { F: 3 },
    [per("foulIntensity", "Düzeltilmiş faul / maç", 1, "F")],
    "100 × P(adjMatch(F,M))",
    "Kart kapsamı yoktur; disiplin yükü ölçülmez. Ayrı sürüm, tam Davar formülü değildir.",
    "fouls-only-v1",
  ),
  definition(
    "assassin",
    "Suikastçı",
    "🥷",
    "defense",
    "Operasyon tamam, tutanak kısa.",
    ["F", "Y", "RC", "discipline", "noCardFouls"],
    { F: 4 },
    [
      per(
        "noCardFoulsPerMatch",
        "Kartsız maçlardaki faul / maç (düzeltilmiş)",
        0.6,
        "noCardFouls",
      ),
      raw("penaltyPerFoul", "Faul başına ceza yükü", 0.4, -1),
    ],
    "100 × [0,60 P(adjMatch(kartsız maç faulleri,M)) + 0,40 P(−(Y+3RC)/F)]",
    "Bir faulün kartla sonuçlandığını olay bazında bilmiyoruz. Kartsız biten maçların faulleri kullanılır; herkes sıfır kartlıysa ödül yok.",
    "full",
    { RC: 0 },
  ),
  definition(
    "vacuum",
    "Elektrik Süpürgesi",
    "🧹",
    "contribution",
    "Orta sahadaki kırıntıları topladı.",
    ["I", "R"],
    { defenseActivity: 5 },
    [
      per("interceptions", "Düzeltilmiş pas arası / maç", 0.6, "I"),
      per("recoveries", "Düzeltilmiş bölgesel top kazanma / maç", 0.4, "R"),
    ],
    "100 × [0,60 P(adjMatch(I,M)) + 0,40 P(adjMatch(R,M))]",
    "Pas arası ve top kazanma örtüşebilir; ayrı ağırlıklı boyutlardır, benzersiz kazanım toplamı değildir.",
  ),
  definition(
    "customs",
    "Gümrük Memuru",
    "🛂",
    "defense",
    "Geçiş için evrak eksik.",
    ["I", "TW", "reading"],
    { I: 5, reading: 8 },
    [
      per("interceptions", "Düzeltilmiş pas arası / maç", 0.7, "I"),
      raw("readingShare", "Pas arası / (pas arası + müdahale)", 0.3),
    ],
    "100 × [0,70 P(adjMatch(I,M)) + 0,30 P(I/(I+TW))]",
    "Pay iki kayıt sayacı arasındaki profil oranıdır; benzersiz savunma olayı payı değildir.",
  ),
  definition(
    "toll",
    "Otoban Gişesi",
    "🚧",
    "defense",
    "Bariyer kalktı, trafik aktı.",
    ["TA", "TW", "miss"],
    { TA: 15, miss: 8 },
    [
      rate(
        "missRate",
        "Düzeltilmiş kaçırılan müdahale oranı",
        0.65,
        "miss",
        "TA",
        "tacklePrior",
      ),
      per("missVolume", "Düzeltilmiş kaçırılan müdahale / maç", 0.35, "miss"),
    ],
    "100 × [0,65 P(adjRate(TA−TW,TA,8)) + 0,35 P(adjMatch(TA−TW,M))]",
    "Başarısız müdahale doğrudan rakibin geçtiğini veya gol yedirdiğini göstermez.",
  ),
  definition(
    "forward",
    "İleri Vites",
    "⏩",
    "style",
    "Vites kolunda geri seçeneği zor bulunuyor.",
    ["FA", "FC"],
    { FA: 25 },
    [
      per("forwardVolume", "Düzeltilmiş başarılı ileri pas / maç", 0.6, "FC"),
      rate(
        "forwardSuccess",
        "Düzeltilmiş ileri pas başarısı",
        0.4,
        "FC",
        "FA",
        "passPrior",
      ),
    ],
    "100 × [0,60 P(adjMatch(FC,M)) + 0,40 P(adjRate(FC,FA,20))]",
    "İleri pas hat kıran veya progressive pass değildir. Yalnız doğrulanmış olay yön sınıflaması kullanılır.",
  ),
  definition(
    "backward",
    "Geri Vites",
    "⏪",
    "style",
    "Önce aynalar, sonra trafik.",
    ["BC", "directionMade", "directionAttempts"],
    { directionAttempts: 40, BC: 10 },
    [
      raw("backwardShare", "Sınıflanmış başarılı paslarda geri payı", 0.7),
      per("backwardVolume", "Düzeltilmiş başarılı geri pas / maç", 0.3, "BC"),
    ],
    "100 × [0,70 P(BC/sınıflanmış başarılı paslar) + 0,30 P(adjMatch(BC,M))]",
    "Oyun tarzıdır, kötü oyuncu etiketi değildir. Yön ve uzunluk ayrı sınıflamalardır.",
  ),
  definition(
    "locksmith",
    "Çilingir",
    "🔑",
    "contribution",
    "Gol kapısını başkasına açtı.",
    ["G", "A", "A2", "creation"],
    { A: 3 },
    [
      per("creation", "Düzeltilmiş hazırlama katkısı / maç", 0.7),
      raw("providerShare", "Asist / (gol + asist)", 0.3),
    ],
    "100 × [0,70 P(adjMatch(A+0,5A2,M)) + 0,30 P(A/(G+A))]",
    "İkinci asist E115 kaydıdır. Anahtar pas veya yaratılan şans ölçümü değildir.",
  ),
  definition(
    "locksmith",
    "Çilingir · yalnız asist",
    "🔑",
    "contribution",
    "Gol kapısını başkasına açtı.",
    ["G", "A", "assistCreation"],
    { A: 3 },
    [
      per("creation", "Düzeltilmiş asist / maç", 0.7, "assistCreation"),
      raw("providerShare", "Asist / (gol + asist)", 0.3),
    ],
    "100 × [0,70 P(adjMatch(A,M)) + 0,30 P(A/(G+A))]",
    "A2 kapsamı yoktur; eksik ikinci asist sıfır sayılmaz. Anahtar pas veya yaratılan şans değildir.",
    "assists-only-v1",
  ),
  definition(
    "stowaway",
    "Kaçak Yolcu",
    "🧳",
    "attack",
    "Az bagajla çok gol taşıdı.",
    ["S", "G", "teamS", "teamG"],
    { S: 6, G: 3 },
    [
      raw("scoringLeverage", "Gol payı / şut payı", 0.6),
      rate(
        "conversion",
        "Düzeltilmiş gol dönüşümü",
        0.4,
        "G",
        "S",
        "shotPrior",
      ),
    ],
    "100 × [0,60 P((G/Σ insan G)/(S/Σ insan S)) + 0,40 P(adjRate(G,S,5))]",
    "Pay yalnız oyuncunun ortak maçlarında, tüm kayıtlı insan satırlarında geçerli şut/gol kapsamındadır; AI ve eksik sezon kapsanmaz.",
  ),
  definition(
    "crypto",
    "Kripto Grafiği",
    "📈",
    "consistency",
    "Bir maç zirve, bir maç düzeltme.",
    ["residual"],
    { M: 5 },
    [
      raw(
        "residualSD",
        "Maç arkadaşlarına göre puan farkının standart sapması",
        1,
      ),
    ],
    "r = EA puanı − maçtaki ≥3 diğer geçerli insan puanı ortalaması; ham = √(Σ(r−ortalama r)²/M); endeks = 100 P(ham)",
    "Dalgalanma profilidir; düşük kalite anlamına gelmez. Puan farkları oyuncunun kendi ortalaması etrafında değerlendirilir.",
  ),
  definition(
    "quiet",
    "Sessiz Mesai",
    "🛠️",
    "contribution",
    "Fotoğrafta yok, işin içinde var.",
    ["G", "A", "I", "R", "PA", "PC", "output"],
    { PA: 40 },
    [
      raw("interceptionRaw", "Pas arası / maç", 0.4),
      raw("recoveryRaw", "Top kazanma / maç", 0.35),
      rate(
        "passSuccess",
        "Düzeltilmiş pas başarısı",
        0.25,
        "PC",
        "PA",
        "passPrior",
      ),
    ],
    "100 × [0,40 P(I/M) + 0,35 P(R/M) + 0,25 P(adjRate(PC,PA,20))]",
    "Yalnız G+A≤1 adaylar içinde değerlendirilir. Savunma boyutları benzersiz aksiyon toplamı değildir.",
    "full",
    { output: 1 },
  ),
];

const count = (v: unknown) => {
  if (
    (typeof v !== "string" && typeof v !== "number") ||
    String(v).trim() === ""
  )
    return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const sumIf = (...n: (number | null)[]) =>
  n.every((x) => x !== null)
    ? (n as number[]).reduce((a, b) => a + b, 0)
    : null;
const difference = (a: number | null, b: number | null) =>
  a !== null && b !== null && a >= b ? a - b : null;
const divide = (a: number, b: number) => (b > 0 ? a / b : null);
export const adjustedRate = (
  success: number,
  attempts: number,
  baseline: number,
  k: number,
) => (success + k * baseline) / (attempts + k);
export const adjustedPerMatch = (
  total: number,
  m: number,
  baseline: number,
  prior = 3,
) => (total + prior * baseline) / (m + prior);

/** Named and event counters stay separate. Cross-source cards require reconciled event rows. */
function observations(matches: readonly Match[]): AwardRow[] {
  const rows = playerRows(matches).map((row) => {
    const p = row.raw,
      issues: string[] = [];
    const S = count(p.shots),
      G = count(p.goals),
      A = count(p.assists),
      PA = count(p.passattempts),
      PC = count(p.passesmade),
      TA = count(p.tackleattempts),
      TW = count(p.tacklesmade);
    const waste = difference(S, G),
      PF = difference(PA, PC),
      miss = difference(TA, TW);
    if (S !== null && G !== null && waste === null) issues.push("G>S");
    if (PA !== null && PC !== null && PF === null) issues.push("PC>PA");
    if (TA !== null && TW !== null && miss === null) issues.push("TW>TA");
    const e = decodedPlayer(p)
      ? (playerEvents(p) as Map<number, number> | null)
      : null;
    if (
      !e &&
      Object.keys(p).some((k) => k.startsWith("match_event_aggregate_") && p[k])
    )
      issues.push(
        "Olay kaydı bozuk veya adlandırılmış şut/gol/asist ile çelişkili",
      );
    const event = (...ids: number[]) =>
      e ? ids.reduce((n, id) => n + (e.get(id) || 0), 0) : null;
    const directionsValid =
      !!e &&
      event(30, 32, 34)! <= event(215)! &&
      event(31, 33, 35)! <= event(216)!;
    if (e && !directionsValid)
      issues.push("Yön alt toplamı olay pas toplamını aşıyor");
    const direction = (...ids: number[]) =>
      directionsValid ? event(...ids) : null;
    const F = event(2, 3),
      Y = event(95, 213),
      RC = count(p.redcards),
      I = event(6),
      R = event(108, 109, 110),
      A2 = event(115);
    const discipline = Y !== null && RC !== null ? Y + 3 * RC : null;
    const output = sumIf(G, A);
    const values: Values = {
      S,
      G,
      A,
      PA,
      PC,
      TA,
      TW,
      waste,
      PF,
      miss,
      F,
      Y,
      RC,
      I,
      R,
      A2,
      output,
      discipline,
      FA: direction(30, 31),
      FC: direction(30),
      BA: direction(32, 33),
      BC: direction(32),
      directionMade: direction(30, 32, 34),
      directionAttempts: direction(30, 31, 32, 33, 34, 35),
      creation: A !== null && A2 !== null ? A + 0.5 * A2 : null,
      assistCreation: A,
      reading: sumIf(I, TW),
      defenseActivity: sumIf(I, R),
      noCardFouls:
        F !== null && discipline !== null ? (discipline === 0 ? F : 0) : null,
      rating: metrics.rating.read(p)?.n ?? null,
    };
    return { ...row, values, issues };
  });
  const byMatch = new Map<string, AwardRow[]>();
  for (const row of rows) {
    const list = byMatch.get(row.matchId) || [];
    list.push(row);
    byMatch.set(row.matchId, list);
  }
  for (const row of rows) {
    const others = byMatch.get(row.matchId)!;
    const match = matches.find((m) => String(m.matchId) === row.matchId);
    const complete = (keys: string[]) =>
      Object.keys(match?.players?.["79638"] || {}).length === others.length &&
      others.every((r) =>
        keys.every((k) => r.values[k] !== null && r.values[k] !== undefined),
      );
    row.values.teamOutput = complete(["G", "A"])
      ? others.reduce((n, r) => n + r.values.G! + r.values.A!, 0)
      : null;
    const shotsComplete = complete(["S", "G", "waste"]);
    row.values.teamS = shotsComplete
      ? others.reduce((n, r) => n + r.values.S!, 0)
      : null;
    row.values.teamG = shotsComplete
      ? others.reduce((n, r) => n + r.values.G!, 0)
      : null;
    const ratings = others.filter(
      (r) => r.playerId !== row.playerId && r.values.rating !== null,
    );
    row.values.residual =
      row.values.rating !== null && ratings.length >= 3
        ? row.values.rating! -
          ratings.reduce((n, r) => n + r.values.rating!, 0) / ratings.length
        : null;
  }
  return rows;
}

export type BaselinePart = {
  role: string;
  scope: "same-role" | "team";
  peers: number;
  observations: number;
  attempts: number;
  weight: number;
  value: number;
};
export type AwardComponent = {
  key: string;
  label: string;
  weight: number;
  raw: number;
  adjusted: number;
  percentile: number | null;
  numerator: number;
  denominator: number;
  baseline: number | null;
  prior: number;
  references: BaselinePart[];
};
export type AwardCandidate = {
  playerId: string;
  name: string;
  proName: string;
  roles: string[];
  M: number;
  available: number;
  totals: Counts;
  matchIds: string[];
  components: AwardComponent[];
  index: number | null;
  context: string;
  sourceTotals: {
    matchId: string;
    humanPlayers: number;
    goals: number | null;
    shots: number | null;
    contributions: number | null;
  }[];
};
export type AwardResult = {
  definition: AwardDefinition;
  candidates: AwardCandidate[];
  winners: AwardCandidate[];
  reason: string;
  excluded: { playerId: string; matchId: string; reasons: string[] }[];
};
export type AwardReport = {
  version: string;
  period: string;
  asOf: string;
  matchIds: string[];
  rules: AwardRules;
  results: AwardResult[];
  casper: { member: AwardMember; playerId: string }[];
  coverage: string;
  provisional: boolean;
};
export type AwardOptions = {
  period?: string;
  asOf?: string;
  now?: number;
  rules?: Partial<AwardRules>;
  playerIds?: string[];
  role?: string;
  history?: readonly Match[];
  rosterAsOf?: string;
  allowCasper?: boolean;
  provisional?: boolean;
};

/** Midrank within eligible teammates, normalized to 0–1; neither probability nor confidence. */
export function awardPercentile(
  value: number,
  values: readonly number[],
  epsilon = 1e-9,
): number {
  if (values.length < 2) return 0.5;
  const less = values.filter((v) => v < value - epsilon).length,
    equal = values.filter((v) => Math.abs(v - value) <= epsilon).length;
  return (less + (equal - 1) / 2) / (values.length - 1);
}
function baseline(
  sample: AwardRow[],
  pool: AwardRow[],
  playerId: string,
  spec: ComponentSpec,
  rules: AwardRules,
): { value: number; parts: BaselinePart[] } | null {
  const numerator = spec.numerator!,
    denominator = spec.kind === "rate" ? spec.denominator! : null;
  const k = spec.kind === "rate" ? rules[spec.prior!] : rules.priorMatches;
  const peers = pool.filter((r) => r.playerId !== playerId);
  const totalWeight = sample.reduce(
    (n, r) => n + (denominator ? r.values[denominator]! : 1),
    0,
  );
  if (!totalWeight) return null;
  const parts: BaselinePart[] = [];
  for (const role of new Set(sample.map((r) => r.role))) {
    const same = peers.filter((r) => r.role === role);
    const enough = (rows: AwardRow[]) =>
      rows.reduce(
        (n, r) => n + (denominator ? r.values[denominator]! : 1),
        0,
      ) >= k;
    const useRole =
      role !== "unknown" &&
      new Set(same.map((r) => r.playerId)).size >= rules.minRolePeers &&
      enough(same);
    const reference = useRole ? same : peers;
    if (!reference.length || !enough(reference)) return null;
    const attempts = reference.reduce(
      (n, r) => n + (denominator ? r.values[denominator]! : 1),
      0,
    );
    const value =
      reference.reduce((n, r) => n + r.values[numerator]!, 0) / attempts;
    const weight =
      sample
        .filter((r) => r.role === role)
        .reduce((n, r) => n + (denominator ? r.values[denominator]! : 1), 0) /
      totalWeight;
    parts.push({
      role,
      scope: useRole ? "same-role" : "team",
      peers: new Set(reference.map((r) => r.playerId)).size,
      observations: reference.length,
      attempts,
      weight,
      value,
    });
  }
  return { value: parts.reduce((n, p) => n + p.weight * p.value, 0), parts };
}
function identityMembers(
  history: readonly Match[],
  members: readonly AwardMember[],
) {
  const roster = new Map(members.map((m) => [m.name.trim().toLowerCase(), m]));
  const identities = new Map<string, AwardMember>();
  for (const r of playerRows(history))
    if (!identities.has(r.playerId)) {
      const member = roster.get(r.name.trim().toLowerCase());
      if (member) identities.set(r.playerId, member);
    }
  return identities;
}
function candidatesFor(
  def: AwardDefinition,
  rows: AwardRow[],
  members: Map<string, AwardMember>,
  options: AwardOptions,
  rules: AwardRules,
): AwardResult {
  const valid = rows.filter((row) =>
    def.fields.every(
      (k) => row.values[k] !== null && row.values[k] !== undefined,
    ),
  );
  const excluded = rows
    .filter((row) => !valid.includes(row))
    .map((row) => ({
      playerId: row.playerId,
      matchId: row.matchId,
      reasons: [
        ...row.issues,
        ...def.fields
          .filter((k) => row.values[k] === null || row.values[k] === undefined)
          .map((k) => k + " eksik/geçersiz"),
      ],
    }));
  const candidates: AwardCandidate[] = [];
  for (const playerId of new Set(valid.map((r) => r.playerId))) {
    if (options.playerIds?.length && !options.playerIds.includes(playerId))
      continue;
    const sample = valid.filter(
      (r) =>
        r.playerId === playerId &&
        (!options.role || options.role === "all" || r.role === options.role),
    );
    const M = sample.length;
    if (!M) continue;
    const totals: Counts = { M };
    for (const key of Object.keys(sample[0].values))
      if (
        sample.every(
          (r) => r.values[key] !== null && r.values[key] !== undefined,
        )
      )
        totals[key] = sample.reduce((n, r) => n + r.values[key]!, 0);
    // Only the definition's complete common rows feed its totals, eligibility and every component.
    if (
      M < Math.max(rules.minMatches, def.thresholds.M || 0) ||
      Object.entries(def.thresholds).some(
        ([k, v]) => !Number.isFinite(totals[k]) || totals[k] < v,
      ) ||
      Object.entries(def.max || {}).some(
        ([k, v]) => !Number.isFinite(totals[k]) || totals[k] > v,
      )
    )
      continue;
    const fractions: Record<string, [number, number]> = {
      involvementShare: [totals.output, totals.teamOutput],
      penaltyPerFoul: [totals.discipline, totals.F],
      readingShare: [totals.I, totals.reading],
      backwardShare: [totals.BC, totals.directionMade],
      providerShare: [totals.A, totals.G + totals.A],
      interceptionRaw: [totals.I, M],
      recoveryRaw: [totals.R, M],
    };
    const rawValues: Record<string, number | null> = {
      ...Object.fromEntries(
        Object.entries(fractions).map(([key, [n, d]]) => [key, divide(n, d)]),
      ),
      scoringLeverage:
        totals.teamG > 0 && totals.teamS > 0 && totals.S > 0
          ? totals.G / totals.teamG / (totals.S / totals.teamS)
          : null,
      interceptionRaw: totals.I / M,
      recoveryRaw: totals.R / M,
      residualSD: Math.sqrt(
        sample.reduce(
          (n, r) => n + (r.values.residual! - totals.residual / M) ** 2,
          0,
        ) / M,
      ),
    };
    const components: AwardComponent[] = [];
    for (const spec of def.components) {
      if (spec.kind === "raw") {
        const value = rawValues[spec.key];
        if (value === null || value === undefined || !Number.isFinite(value))
          break;
        components.push({
          key: spec.key,
          label: spec.label,
          weight: spec.weight,
          raw: value,
          adjusted: value * (spec.sign || 1),
          percentile: null,
          numerator: fractions[spec.key]?.[0] ?? value,
          denominator: fractions[spec.key]?.[1] ?? 1,
          baseline: null,
          prior: 0,
          references: [],
        });
      } else {
        const b = baseline(sample, valid, playerId, spec, rules);
        if (!b) break;
        const n = totals[spec.numerator!],
          d = spec.kind === "rate" ? totals[spec.denominator!] : M;
        if (d <= 0) break;
        const prior =
          spec.kind === "rate" ? rules[spec.prior!] : rules.priorMatches;
        const adjusted =
          spec.kind === "rate"
            ? adjustedRate(n, d, b.value, prior)
            : adjustedPerMatch(n, M, b.value, prior);
        components.push({
          key: spec.key,
          label: spec.label,
          weight: spec.weight,
          raw: n / d,
          adjusted,
          percentile: null,
          numerator: n,
          denominator: d,
          baseline: b.value,
          prior,
          references: b.parts,
        });
      }
    }
    if (
      components.length !== def.components.length ||
      components.some((c) => !Number.isFinite(c.adjusted))
    )
      continue;
    const member = members.get(playerId);
    const directionRows = sample.filter(
      (r) => r.values.FA !== null && r.values.directionAttempts !== null,
    );
    const directionAttempts = directionRows.reduce(
      (n, r) => n + r.values.directionAttempts!,
      0,
    );
    candidates.push({
      playerId,
      name: member?.name || sample[0].name,
      proName: member?.proName || sample[0].name,
      roles: [...new Set(sample.map((r) => r.role))],
      M,
      available: rows.filter((r) => r.playerId === playerId).length,
      totals,
      matchIds: sample.map((r) => r.matchId),
      components,
      index: null,
      context: directionAttempts
        ? `Yön kaydı olan ${directionRows.length} ortak maçta ileri deneme payı %${((100 * directionRows.reduce((n, r) => n + r.values.FA!, 0)) / directionAttempts).toFixed(1)}; genel pas kapsamıyla aynı toplam değildir.`
        : "İleri pas risk bağlamı için doğrulanmış yön kapsamı yok.",
      sourceTotals: sample.map((r) => ({
        matchId: r.matchId,
        humanPlayers: rows.filter((x) => x.matchId === r.matchId).length,
        goals: r.values.teamG,
        shots: r.values.teamS,
        contributions: r.values.teamOutput,
      })),
    });
  }
  for (const candidate of candidates.length >= rules.minCandidates
    ? candidates
    : []) {
    candidate.components.forEach((c, i) => {
      c.percentile = awardPercentile(
        c.adjusted,
        candidates.map((p) => p.components[i].adjusted),
        rules.equalityTolerance,
      );
    });
    candidate.index =
      100 *
      candidate.components.reduce((n, c) => n + c.weight * c.percentile!, 0);
  }
  candidates.sort(
    (a, b) => b.index! - a.index! || a.playerId.localeCompare(b.playerId, "en"),
  );
  let reason = "";
  if (candidates.length < rules.minCandidates)
    reason = `En az ${rules.minCandidates} uygun aday gerekli; ${candidates.length} aday var. Ortak veri, eşik veya takım referansı yetersiz.`;
  else if (
    def.id === "assassin" &&
    Math.max(...candidates.map((c) => c.totals.discipline / c.totals.F)) -
      Math.min(...candidates.map((c) => c.totals.discipline / c.totals.F)) <=
      rules.equalityTolerance
  )
    reason =
      "Kart yükü ayırt edici değil; yalnız faul hacmi Suikastçı kazandırmaz.";
  else if (
    candidates[0].index! - candidates.at(-1)!.index! <
    rules.minIndexSpread
  )
    reason = "Bu dönem net kazanan yok; değerler eşit veya fark çok küçük.";
  const leader = candidates[0];
  const leaders = leader
    ? candidates.filter(
        (c) => Math.abs(c.index! - leader.index!) <= rules.equalityTolerance,
      )
    : [];
  const next = candidates.find((c) => !leaders.includes(c));
  if (!reason && next && candidates[0].index! - next.index! < rules.minIndexGap)
    reason = `Bu dönem net kazanan yok; lider farkı ${rules.minIndexGap} endeks puanından küçük.`;
  if (
    !reason &&
    next &&
    leaders.every((leader) =>
      leader.components.every(
        (c, i) =>
          Math.abs(c.adjusted - next.components[i].adjusted) <
          rules.minRelativeDifference *
            Math.max(
              1,
              Math.abs(c.adjusted),
              Math.abs(next.components[i].adjusted),
            ),
      ),
    )
  )
    reason =
      "Bu dönem net kazanan yok; türetilmiş değerlerde lider farkı çok küçük.";
  return {
    definition: def,
    candidates,
    winners: reason ? [] : leaders,
    reason,
    excluded,
  };
}
export function buildAwardReport(
  matches: readonly Match[],
  members: readonly AwardMember[] = [],
  options: AwardOptions = {},
): AwardReport {
  const now = options.now ?? Date.now(),
    selected = uniqueRawMatches(matches).filter(
      (m) => m.timestamp * 1000 <= now,
    ) as Match[];
  const rows = observations(selected),
    identities = identityMembers(options.history || selected, members),
    rules = { ...awardRules, ...options.rules };
  const registry = awardRegistry.filter((def) => {
    if (def.id === "fouls")
      return (
        def.variant ===
        (rows.some(
          (r) =>
            r.values.F !== null && r.values.Y !== null && r.values.RC !== null,
        )
          ? "full"
          : "fouls-only-v1")
      );
    if (def.id === "locksmith")
      return (
        def.variant ===
        (rows.some((r) => r.values.A2 !== null) ? "full" : "assists-only-v1")
      );
    return true;
  });
  // Current roster proves current membership only. Historical roster membership is never inferred.
  const rosterTime = Date.parse(options.rosterAsOf || ""),
    from = now - 7 * 86400000;
  const casper =
    options.allowCasper &&
    selected.length >= 3 &&
    rosterTime >= from &&
    rosterTime <= now
      ? members.flatMap((member) => {
          const id = [...identities].find(
            ([, m]) => m.name === member.name,
          )?.[0];
          return !rows.some(
            (r) =>
              r.playerId === id ||
              r.name.trim().toLowerCase() === member.name.trim().toLowerCase(),
          )
            ? [{ member, playerId: id || "roster:" + member.name }]
            : [];
        })
      : [];
  return {
    version: AWARD_VERSION,
    period: options.period || "Seçili kayıtlar",
    asOf: options.asOf || new Date(now).toISOString(),
    matchIds: selected.map((m) => String(m.matchId)),
    rules,
    results: registry.map((def) =>
      candidatesFor(def, rows, identities, options, rules),
    ),
    casper,
    coverage:
      "Yalnız kayıtlı insan oyuncu-maçlar. Her kartın bileşenleri aynı ortak geçerli satırlardadır; eksik kayıt sıfır değildir. P takım içi orta sıra yüzdeliğidir; olasılık veya güven değildir. LEO XI eğlence endeksidir, bilimsel kalite veya resmî Opta metriği değildir.",
    provisional: options.provisional ?? true,
  };
}

export function selectHomeAwards(report: AwardReport): AwardResult[] {
  const selected: AwardResult[] = [];
  for (const category of [
    "attack",
    "passing",
    "defense",
    "contribution",
    "style",
    "consistency",
  ] as AwardCategory[]) {
    const result = report.results.find(
      (r) => r.definition.category === category && r.winners.length,
    );
    if (result) selected.push(result);
  }
  return selected;
}
export type AwardSnapshot = {
  week: string;
  version: string;
  revision: number;
  asOf: string;
  fingerprint: string;
  report: AwardReport;
  previous: { revision: number; asOf: string; report: AwardReport }[];
};
export function awardCalendarWeek(now = Date.now()): string {
  return rawExportOptions(
    [{ matchId: "clock", timestamp: now / 1000, clubs: {} }],
    "week",
  )[0].key;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b, "en"))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
/** Persisted by the existing Durable Object at seed/sync time; reads never collect upstream data. */
export async function awardSnapshots(
  matches: readonly Match[],
  members: readonly AwardMember[],
  previous: readonly AwardSnapshot[],
  asOf: string,
  now = Date.now(),
): Promise<AwardSnapshot[]> {
  matches = uniqueRawMatches(matches).filter((m) => m.timestamp * 1000 <= now);
  const currentWeek = awardCalendarWeek(now);
  const results: AwardSnapshot[] = [];
  for (const period of rawExportOptions(matches, "week")) {
    const selected = selectRawMatches(matches, {
      scope: "week",
      key: period.key,
    }) as Match[];
    const report = buildAwardReport(selected, members, {
      history: matches,
      period: period.label,
      asOf,
      now,
      provisional: period.key === currentWeek,
    });
    const bytes = new TextEncoder().encode(
      canonical({
        version: AWARD_VERSION,
        rules: awardRules,
        selected: selected.map((m) => ({
          matchId: m.matchId,
          timestamp: m.timestamp,
          players: m.players?.["79638"],
        })),
        members: members.map((m) => ({ name: m.name, proName: m.proName })),
        identities: report.results.map((r) =>
          r.candidates.map((c) => ({
            id: c.playerId,
            name: c.name,
            proName: c.proName,
          })),
        ),
      }),
    );
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const fingerprint = Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const old = previous.find(
      (p) => p.week === period.key && p.version === AWARD_VERSION,
    );
    if (old && old.fingerprint === fingerprint) {
      results.push({
        ...old,
        report: { ...old.report, provisional: report.provisional },
      });
      continue;
    }
    results.push({
      week: period.key,
      version: AWARD_VERSION,
      revision: (old?.revision || 0) + 1,
      asOf,
      fingerprint,
      report,
      previous: old
        ? [
            ...old.previous,
            { revision: old.revision, asOf: old.asOf, report: old.report },
          ]
        : [],
    });
  }
  return results;
}

export function awardPeriodIsCurrentWeek(
  matches: readonly Match[],
  now = Date.now(),
) {
  const current = awardCalendarWeek(now);
  return (
    matches.length > 0 &&
    rawExportOptions(matches, "week").every((p) => p.key === current) &&
    matches.every((m) => amsterdamDay(m.timestamp * 1000) <= amsterdamDay(now))
  );
}
