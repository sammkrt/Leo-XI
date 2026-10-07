import { playerEvents } from "./club-events.mjs";
import { amsterdamDay } from "./club-model.mjs";
import {
  rawExportOptions,
  selectRawMatches,
  uniqueRawMatches,
} from "./club-export.ts";
import type { Match } from "./club-types";

export const ANALYTICS_TIMEZONE = "Europe/Amsterdam";
export const roles: Record<string, string> = {
  forward: "Forvet",
  midfielder: "Orta saha",
  defender: "Defans",
  goalkeeper: "Kaleci",
  unknown: "Rol yok",
};
export const roleColors: Record<string, string> = {
  forward: "#e8bc68",
  midfielder: "#85bda8",
  defender: "#87a9dc",
  goalkeeper: "#c399cf",
  unknown: "#a0a4b0",
};
export type RawPlayer = Record<string, unknown>;
export type PlayerRow = {
  playerId: string;
  name: string;
  role: string;
  matchId: string;
  timestamp: number;
  raw: RawPlayer;
};
type Observation = { n: number; d?: number };
type MetricKind = "count" | "rate" | "mean" | "deviation";
type MetricDefinition = {
  id: string;
  label: string;
  description: string;
  unit: string;
  kind: MetricKind;
  source: string[];
  level: "oyuncu-maç";
  periods: string;
  formula: string;
  aggregation: string;
  missing: string;
  coverage: string;
  limitation: string;
  interpretation: string;
  read: (row: RawPlayer) => Observation | null;
};
export function finiteCounter(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean" ||
    (typeof value !== "string" && typeof value !== "number")
  )
    return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function named(field: string) {
  return (row: RawPlayer): Observation | null => {
    const n = finiteCounter(row[field]);
    return n === null ? null : { n };
  };
}
function namedRate(made: string, attempts: string) {
  return (row: RawPlayer): Observation | null => {
    const n = finiteCounter(row[made]),
      d = finiteCounter(row[attempts]);
    return n === null || d === null || n > d ? null : { n, d };
  };
}
function events(
  ids: number[],
  denominator?: number[],
  validate?: string,
  passPartition = false,
) {
  return (row: RawPlayer): Observation | null => {
    const e = playerEvents(row) as Map<number, number> | null;
    if (!e) return null;
    const sum = (codes: number[]) =>
      codes.reduce((a, code) => a + (e.get(code) || 0), 0);
    if (
      passPartition &&
      (sum([30, 32, 34]) > sum([215]) || sum([31, 33, 35]) > sum([216]))
    )
      return null;
    if (validate) {
      const expected =
        validate === "shots"
          ? sum([217, 218])
          : validate === "goals"
            ? sum([214])
            : sum([11]);
      const actual = finiteCounter(row[validate]);
      if (
        row[validate] !== undefined &&
        row[validate] !== null &&
        row[validate] !== "" &&
        actual !== expected
      )
        return null;
    }
    const n = sum(ids),
      d = denominator ? sum(denominator) : undefined;
    return d !== undefined && n > d
      ? null
      : { n, ...(d === undefined ? {} : { d }) };
  };
}
function definition(
  id: string,
  label: string,
  source: string[],
  read: MetricDefinition["read"],
  kind: MetricKind = "count",
  extra: Partial<MetricDefinition> = {},
): MetricDefinition {
  return {
    id,
    label,
    source,
    read,
    kind,
    description: label + " · kayıtlı oyuncu-maç örneklemi",
    unit:
      kind === "rate"
        ? "%"
        : kind === "mean" || kind === "deviation"
          ? "puan"
          : "olay",
    level: "oyuncu-maç",
    periods: "Tüm kayıtlar, maç, seans, hafta, ay, son 5/10/20, özel aralık",
    formula:
      kind === "rate"
        ? "100 × Σ başarılı / Σ deneme"
        : kind === "mean"
          ? "Σ değer / geçerli gözlem"
          : kind === "deviation"
            ? "√(Σ(x−ortalama)² / N), N ≥ 2"
            : "Σ değer; maç başına = Σ / geçerli oyuncu-maç",
    aggregation:
      kind === "rate"
        ? "Aynı geçerli satırlardan pay/payda havuzu; yüzde ortalaması alınmaz"
        : "Geçerli oyuncu-maç kayıtları",
    missing:
      "Eksik/bozuk değer null; gözlenen sıfır 0; sıfır denemede oran null",
    coverage:
      "Her metrik kendi geçerli satır sayısını ve kaynak maçlarını taşır",
    limitation:
      "İnsan oyuncu kayıtları tüm takım/AI kapsamını garanti etmez. Olay kodları topluluk araştırmasıdır; geçerli olay yanıtındaki bulunmayan kod sıfır kabul edilir.",
    interpretation:
      "Rol, rakip ve örneklem ile değerlendirilir; tek başına kalite ölçüsü değildir.",
    ...extra,
  };
}
const eventSource = (codes: number[]) =>
  codes.map((code) => "match_event_aggregate_* / E" + code);
export const metrics = {
  goals: definition("goals", "Gol", ["goals"], named("goals")),
  assists: definition("assists", "Asist", ["assists"], named("assists")),
  contributions: definition(
    "contributions",
    "Gol + asist",
    ["goals", "assists"],
    (row) => {
      const a = finiteCounter(row.goals),
        b = finiteCounter(row.assists);
      return a === null || b === null ? null : { n: a + b };
    },
    "count",
    { limitation: "Bireysel katkıdır; takım gol sayısı olarak toplanmaz." },
  ),
  shots: definition("shots", "Şut", ["shots"], named("shots"), "count", {
    limitation: "EA adlandırılmış şut alanı; zaman/konum yoktur.",
  }),
  onTarget: definition(
    "onTarget",
    "İsabetli şut",
    eventSource([217]),
    events([217], undefined, "shots"),
  ),
  accuracy: definition(
    "accuracy",
    "Şut isabeti",
    eventSource([217, 218]),
    events([217], [217, 218], "shots"),
    "rate",
  ),
  conversion: definition(
    "conversion",
    "Gol / şut",
    ["goals", "shots"],
    namedRate("goals", "shots"),
    "rate",
  ),
  passAttempts: definition(
    "passAttempts",
    "Pas denemesi",
    ["passattempts"],
    named("passattempts"),
  ),
  passMade: definition(
    "passMade",
    "Başarılı pas",
    ["passesmade"],
    named("passesmade"),
  ),
  passRate: definition(
    "passRate",
    "Pas başarısı",
    ["passesmade", "passattempts"],
    namedRate("passesmade", "passattempts"),
    "rate",
  ),
  forwardAttempts: definition(
    "forwardAttempts",
    "İleri pas denemesi",
    eventSource([30, 31]),
    events([30, 31], undefined, undefined, true),
  ),
  forwardMade: definition(
    "forwardMade",
    "Başarılı ileri pas",
    eventSource([30]),
    events([30], undefined, undefined, true),
  ),
  forwardRate: definition(
    "forwardRate",
    "İleri pas başarısı",
    eventSource([30, 31]),
    events([30], [30, 31], undefined, true),
    "rate",
    {
      limitation:
        "İleri pas hat kıran pas değildir. Yön toplamı olay tabanlı pas toplamını aşarsa satır dışlanır.",
    },
  ),
  tackleAttempts: definition(
    "tackleAttempts",
    "Müdahale denemesi",
    ["tackleattempts"],
    named("tackleattempts"),
  ),
  tackleMade: definition(
    "tackleMade",
    "Başarılı müdahale",
    ["tacklesmade"],
    named("tacklesmade"),
  ),
  tackleRate: definition(
    "tackleRate",
    "Müdahale başarısı",
    ["tacklesmade", "tackleattempts"],
    namedRate("tacklesmade", "tackleattempts"),
    "rate",
  ),
  interceptions: definition(
    "interceptions",
    "Pas arası",
    eventSource([6]),
    events([6]),
    "count",
    {
      limitation:
        "Müdahale ve top kazanımla örtüşebilir; bu kategoriler tek savunma toplamında toplanmaz.",
    },
  ),
  losses: definition(
    "losses",
    "Bölgesi belli top kaybı",
    eventSource([105, 106, 107]),
    events([105, 106, 107]),
    "count",
    {
      interpretation:
        "Daha az kayıp bağlama göre olumlu olabilir; yüksek oyun sorumluluğu dikkate alınır.",
    },
  ),
  wins: definition(
    "wins",
    "Bölgesi belli top kazanma",
    eventSource([108, 109, 110]),
    events([108, 109, 110]),
  ),
  lostDefense: definition(
    "lostDefense",
    "Savunma bölgesi kayıp",
    eventSource([105]),
    events([105]),
  ),
  lostMidfield: definition(
    "lostMidfield",
    "Orta saha bölgesi kayıp",
    eventSource([106]),
    events([106]),
  ),
  lostAttack: definition(
    "lostAttack",
    "Hücum bölgesi kayıp",
    eventSource([107]),
    events([107]),
  ),
  wonDefense: definition(
    "wonDefense",
    "Savunma bölgesi kazanma",
    eventSource([108]),
    events([108]),
  ),
  wonMidfield: definition(
    "wonMidfield",
    "Orta saha bölgesi kazanma",
    eventSource([109]),
    events([109]),
  ),
  wonAttack: definition(
    "wonAttack",
    "Hücum bölgesi kazanma",
    eventSource([110]),
    events([110]),
  ),
  rating: definition(
    "rating",
    "Ortalama EA maç puanı",
    ["rating"],
    (row) => {
      const n = finiteCounter(row.rating);
      return n === null || n <= 0 || n > 10 ? null : { n };
    },
    "mean",
  ),
  ratingDeviation: definition(
    "ratingDeviation",
    "EA puanı standart sapması",
    ["rating"],
    (row) => {
      const n = finiteCounter(row.rating);
      return n === null || n <= 0 || n > 10 ? null : { n };
    },
    "deviation",
    {
      interpretation:
        "Düşük sapma benzer puanları gösterir; istikrar iyi performansla eşanlamlı değildir.",
    },
  ),
  saves: definition(
    "saves",
    "Kaleci kurtarışı",
    ["saves", "pos"],
    (row) => (row.pos === "goalkeeper" ? named("saves")(row) : null),
    "count",
    {
      limitation:
        "Yalnız açıkça goalkeeper olarak kaydedilen oyuncular; kurtarış yüzdesi için tutarlı karşılaşılan şut paydası yoktur.",
    },
  ),
  corners: definition(
    "corners",
    "Kullanılan korner olayı",
    eventSource([145]),
    events([145]),
    "count",
    {
      limitation:
        "Topluluk E145 sayacı; kornerin sonucunu veya bağımsız takım duran top toplamını vermez.",
    },
  ),
  crosses: definition(
    "crosses",
    "Başarılı orta",
    eventSource([36]),
    events([36]),
    "count",
    {
      limitation:
        "Duran toplar dahil olabilir; açık oyun/duran top başarısı türetilmez.",
    },
  ),
  secondAssists: definition(
    "secondAssists",
    "İkinci asist",
    eventSource([115]),
    events([115]),
    "count",
    { limitation: "Gol ve asistten bağımsız takım golleri gibi toplanmaz." },
  ),
  dribbles: definition(
    "dribbles",
    "Tamamlanan dripling",
    eventSource([174]),
    events([174]),
    "count",
    {
      limitation:
        "Rakip geçme sayısı/başarı oranı değildir; güvenilir deneme paydası yoktur.",
    },
  ),
  outPosition: definition(
    "outPosition",
    "Pozisyon uyarısı",
    eventSource([219]),
    events([219]),
    "count",
    {
      limitation:
        "Oyun geri bildirimidir; süre, koordinat veya taktik disiplin puanı değildir.",
    },
  ),
} satisfies Record<string, MetricDefinition>;
export type MetricId = keyof typeof metrics;
export const metricIds = Object.keys(metrics) as MetricId[];
export const teamMetricDictionary = [
  {
    id: "matches",
    label: "Kayıtlı maç",
    unit: "maç",
    formula: "Tekil matchId sayısı",
  },
  {
    id: "covered",
    label: "Geçerli skor",
    unit: "maç",
    formula: "İki tarafın geçerli skorunun bulunduğu maç sayısı",
  },
  {
    id: "goals",
    label: "Takım golü",
    unit: "gol",
    formula: "Σ clubs[79638].goals",
  },
  {
    id: "conceded",
    label: "Yenilen gol",
    unit: "gol",
    formula: "Σ clubs[rakip].goals; alan yoksa clubs[79638].goalsAgainst",
  },
  {
    id: "difference",
    label: "Gol farkı",
    unit: "gol",
    formula: "Σ (atılan − yenilen); yalnız iki skor da geçerliyse",
  },
  {
    id: "points",
    label: "Puan",
    unit: "puan",
    formula: "Σ (galibiyet 3, beraberlik 1, mağlubiyet 0)",
  },
  {
    id: "pointsPerMatch",
    label: "Puan / maç",
    unit: "puan/maç",
    formula: "Σ puan / geçerli skor maç sayısı",
  },
  { id: "wins", label: "Galibiyet", unit: "maç", formula: "Atılan > yenilen" },
  {
    id: "draws",
    label: "Beraberlik",
    unit: "maç",
    formula: "Atılan = yenilen",
  },
  {
    id: "losses",
    label: "Mağlubiyet",
    unit: "maç",
    formula: "Atılan < yenilen",
  },
].map((item) => ({
  ...item,
  kind: "team",
  source: [
    "matchId",
    "timestamp",
    "clubs[*].goals",
    "clubs[79638].goalsAgainst",
  ],
  level: "takım-maç",
  description:
    "Kayıtlı takım skorları; kariyer toplamları ve insan oyuncu katkıları ayrı tutulur.",
  periods: "Seçili analiz kapsamı",
  aggregation: "Tekil maç; skor metrikleri yalnız iki skor da geçerliyse",
  missing:
    "Eksik skor null; sonuç veya puan uydurulmaz. Boş grupta sonuç sayısı 0, oran null.",
  coverage: "Geçerli skor / seçili tekil maç",
  limitation:
    "Arşiv eksiksiz sezon değildir; EA AI oyuncuları takım skorunda bulunabilir.",
  interpretation:
    "Betimleyici sonuç; kadro/rakip ve küçük örneklemden nedensellik çıkarılmaz.",
}));
export type MetricResult = {
  value: number | null;
  total: number | null;
  numerator: number | null;
  denominator: number | null;
  perMatch: number | null;
  covered: number;
  available: number;
  matchIds: string[];
  median: number | null;
  min: number | null;
  max: number | null;
};
export function median(values: readonly number[]): number | null {
  const a = [...values].sort((x, y) => x - y);
  return a.length
    ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2
    : null;
}
export function playerRows(
  matches: readonly Match[],
  teamId = "79638",
): PlayerRow[] {
  return uniqueRawMatches(matches).flatMap((match) =>
    Object.entries(match.players?.[teamId] || {}).flatMap(([id, raw]) =>
      raw
        ? [
            {
              playerId: id,
              name: raw.playername || id,
              role: raw.pos && roles[raw.pos] ? raw.pos : "unknown",
              matchId: String(match.matchId),
              timestamp: match.timestamp,
              raw,
            },
          ]
        : [],
    ),
  );
}
export function filterPlayerRows(
  matches: readonly Match[],
  filters: Pick<AnalyticsFilters, "playerIds" | "role">,
  teamId = "79638",
) {
  return playerRows(matches, teamId).filter(
    (r) =>
      (!filters.playerIds.length || filters.playerIds.includes(r.playerId)) &&
      (filters.role === "all" || r.role === filters.role),
  );
}
export function summarize(
  rows: readonly PlayerRow[],
  id: MetricId,
): MetricResult {
  const definition = metrics[id],
    seen = new Set<string>();
  const valid = rows
    .filter((row) => {
      const key = row.matchId + ":" + row.playerId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .flatMap((row) => {
      const o = definition.read(row.raw);
      return o ? [{ ...o, row }] : [];
    });
  const n = valid.reduce((a, o) => a + o.n, 0),
    d = valid.reduce((a, o) => a + (o.d || 0), 0);
  const values = valid.flatMap((o) =>
    o.d === undefined ? [o.n] : o.d > 0 ? [(o.n / o.d) * 100] : [],
  );
  const mean = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
  const deviation =
    values.length >= 2 && mean !== null
      ? Math.sqrt(
          values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
        )
      : null;
  const value =
    definition.kind === "rate"
      ? d > 0
        ? (n / d) * 100
        : null
      : definition.kind === "mean"
        ? mean
        : definition.kind === "deviation"
          ? deviation
          : valid.length
            ? n
            : null;
  return {
    value,
    total: valid.length ? n : null,
    numerator: definition.kind === "rate" && valid.length ? n : null,
    denominator: definition.kind === "rate" && valid.length ? d : null,
    perMatch: valid.length ? n / valid.length : null,
    covered: valid.length,
    available: seen.size,
    matchIds: [...new Set(valid.map((o) => o.row.matchId))],
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
}
export type Session = {
  key: string;
  start: number;
  end: number;
  matches: Match[];
  label: string;
};
const dateLabel = (time: number) =>
  new Date(time * 1000).toLocaleString("tr-TR", {
    timeZone: ANALYTICS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export function groupSessions(
  matches: readonly Match[],
  gapMinutes = 120,
): Session[] {
  const gap =
    Math.max(
      15,
      Math.min(720, Number.isFinite(gapMinutes) ? gapMinutes : 120),
    ) * 60;
  const sessions: Session[] = [];
  for (const match of [...uniqueRawMatches(matches)].reverse() as Match[]) {
    let current = sessions[sessions.length - 1];
    if (!current || match.timestamp - current.end > gap) {
      current = {
        key: String(match.matchId),
        start: match.timestamp,
        end: match.timestamp,
        matches: [],
        label: "",
      };
      sessions.push(current);
    }
    current.matches.push(match);
    current.end = match.timestamp;
    current.label = dateLabel(current.start) + " – " + dateLabel(current.end);
  }
  return sessions.reverse();
}
export type AnalyticsScope =
  | "all"
  | "match"
  | "session"
  | "week"
  | "month"
  | "last5"
  | "last10"
  | "last20"
  | "custom";
export type AnalyticsView =
  | "team"
  | "players"
  | "match"
  | "session"
  | "compare"
  | "matrix"
  | "pairs"
  | "development";
export type AnalyticsFilters = {
  scope: AnalyticsScope;
  key: string;
  from: string;
  to: string;
  playerIds: string[];
  role: string;
  result: string;
  opponent: string;
  matchType: string;
  minMatches: number;
  minAttempts: number;
  mode: "total" | "perMatch";
  gapMinutes: number;
  compare: "previous" | "custom" | "none";
  compareFrom: string;
  compareTo: string;
  tag: string;
  view: AnalyticsView;
};
export const defaultFilters: AnalyticsFilters = {
  scope: "all",
  key: "",
  from: "",
  to: "",
  playerIds: [],
  role: "all",
  result: "all",
  opponent: "all",
  matchType: "all",
  minMatches: 1,
  minAttempts: 0,
  mode: "perMatch",
  gapMinutes: 120,
  compare: "previous",
  compareFrom: "",
  compareTo: "",
  tag: "",
  view: "team",
};
const scopes: AnalyticsScope[] = [
  "all",
  "match",
  "session",
  "week",
  "month",
  "last5",
  "last10",
  "last20",
  "custom",
];
const views: AnalyticsView[] = [
  "team",
  "players",
  "match",
  "session",
  "compare",
  "matrix",
  "pairs",
  "development",
];
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export function filtersFromSearch(search: string): AnalyticsFilters {
  const p = new URLSearchParams(search),
    value = (key: string) => p.get("leo_" + key) || "";
  const int = (key: string, fallback: number, min: number, max: number) => {
    const v = value(key);
    const n = Number(v);
    return v && Number.isFinite(n)
      ? Math.max(min, Math.min(max, Math.floor(n)))
      : fallback;
  };
  return {
    ...defaultFilters,
    scope: scopes.find((s) => s === value("scope")) || "all",
    view: views.find((v) => v === value("view")) || "team",
    key: value("key"),
    from: validDate(value("from")) ? value("from") : "",
    to: validDate(value("to")) ? value("to") : "",
    playerIds: value("players").split(",").filter(Boolean),
    role: roles[value("role")] ? value("role") : "all",
    result: ["G", "B", "M"].includes(value("result")) ? value("result") : "all",
    opponent: value("opponent") || "all",
    matchType: value("type") || "all",
    minMatches: int("minMatches", 1, 1, 10000),
    minAttempts: int("minAttempts", 0, 0, 100000),
    gapMinutes: int("gap", 120, 15, 720),
    mode: value("mode") === "total" ? "total" : "perMatch",
    compare:
      value("compare") === "custom"
        ? "custom"
        : value("compare") === "none"
          ? "none"
          : "previous",
    compareFrom: validDate(value("compareFrom")) ? value("compareFrom") : "",
    compareTo: validDate(value("compareTo")) ? value("compareTo") : "",
    tag: value("tag").slice(0, 40),
  };
}
export function filtersToSearch(
  filters: AnalyticsFilters,
  search = "",
): string {
  const p = new URLSearchParams(search);
  const fields = {
    scope: filters.scope,
    view: filters.view,
    key: filters.key,
    from: filters.from,
    to: filters.to,
    players: filters.playerIds.join(","),
    role: filters.role,
    result: filters.result,
    opponent: filters.opponent,
    type: filters.matchType,
    minMatches: String(filters.minMatches),
    minAttempts: String(filters.minAttempts),
    gap: String(filters.gapMinutes),
    mode: filters.mode,
    compare: filters.compare,
    compareFrom: filters.compareFrom,
    compareTo: filters.compareTo,
    tag: filters.tag,
    tab: "Analiz",
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value) p.set("leo_" + key, value);
    else p.delete("leo_" + key);
  }
  return p.toString();
}
export function matchInfo(match: Match, teamId = "79638") {
  const club = match.clubs?.[teamId],
    entry = Object.entries(match.clubs || {}).find(([id]) => id !== teamId);
  const goals = finiteCounter(club?.goals),
    conceded = finiteCounter(entry?.[1]?.goals ?? club?.goalsAgainst);
  const result =
    goals === null || conceded === null
      ? null
      : goals > conceded
        ? "G"
        : goals < conceded
          ? "M"
          : "B";
  return {
    goals,
    conceded,
    result,
    points: result === "G" ? 3 : result === "B" ? 1 : result === "M" ? 0 : null,
    opponentId: entry?.[0] || "",
    opponent: entry?.[1]?.details?.name || "Rakip kaydı yok",
    type: match.matchType || "leagueMatch",
    date: amsterdamDay(match.timestamp * 1000),
  };
}
export type JournalEntry = {
  formation: string;
  tactic: string;
  role: string;
  note: string;
};
export type Journal = Record<string, JournalEntry>;
export function parseJournal(raw: string | null): Journal {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const entries: [string, JournalEntry][] = [];
    for (const [key, entry] of Object.entries(value)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const read = (field: string, max: number) =>
        field in entry && typeof entry[field as keyof typeof entry] === "string"
          ? String(entry[field as keyof typeof entry]).slice(0, max)
          : "";
      entries.push([
        key,
        {
          formation: read("formation", 40),
          tactic: read("tactic", 80),
          role: read("role", 40),
          note: read("note", 1000),
        },
      ]);
    }
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}
export function filterMatches(
  matches: readonly Match[],
  filters: AnalyticsFilters,
  journal: Journal = {},
): Match[] {
  const ordered = uniqueRawMatches(matches) as Match[];
  const sessionKeys = new Map(
    filters.tag
      ? groupSessions(ordered, filters.gapMinutes).flatMap((s) =>
          s.matches.map((m) => [String(m.matchId), s.key] as const),
        )
      : [],
  );
  let pool = ordered;
  if (filters.scope === "match")
    pool = ordered.filter((m) => String(m.matchId) === filters.key);
  if (filters.scope === "session")
    pool =
      groupSessions(ordered, filters.gapMinutes).find(
        (s) => s.key === filters.key,
      )?.matches || [];
  if (filters.scope === "week" || filters.scope === "month")
    pool = selectRawMatches(ordered, {
      scope: filters.scope,
      key: filters.key,
    }) as Match[];
  if (filters.scope === "custom")
    pool =
      !validDate(filters.from) ||
      !validDate(filters.to) ||
      filters.from > filters.to
        ? []
        : ordered.filter((m) => {
            const day = amsterdamDay(m.timestamp * 1000);
            return day >= filters.from && day <= filters.to;
          });
  pool = pool.filter((m) => {
    const info = matchInfo(m);
    if (
      (filters.result !== "all" && info.result !== filters.result) ||
      (filters.opponent !== "all" && info.opponentId !== filters.opponent) ||
      (filters.matchType !== "all" && info.type !== filters.matchType)
    )
      return false;
    if (
      filters.tag &&
      ![
        journal["match:" + m.matchId],
        journal["session:" + (sessionKeys.get(String(m.matchId)) || "")],
      ].some(
        (entry) =>
          entry &&
          [entry.formation, entry.tactic, entry.role].some((s) =>
            s
              .toLocaleLowerCase("tr-TR")
              .includes(filters.tag.toLocaleLowerCase("tr-TR")),
          ),
      )
    )
      return false;
    if (filters.playerIds.length || filters.role !== "all")
      return playerRows([m]).some(
        (row) =>
          (!filters.playerIds.length ||
            filters.playerIds.includes(row.playerId)) &&
          (filters.role === "all" || row.role === filters.role),
      );
    return true;
  });
  pool = [...pool].sort((a, b) => b.timestamp - a.timestamp);
  if (filters.scope.startsWith("last"))
    pool = pool.slice(0, Number(filters.scope.slice(4)));
  return pool;
}
export function previousMatches(
  all: readonly Match[],
  selected: readonly Match[],
  filters: AnalyticsFilters,
  journal: Journal = {},
): Match[] {
  if (!selected.length || filters.compare === "none") return [];
  if (filters.compare === "custom")
    return filterMatches(
      all,
      {
        ...filters,
        scope: "custom",
        from: filters.compareFrom,
        to: filters.compareTo,
        result: filters.result,
      },
      journal,
    ).filter((m) => !selected.some((s) => s.matchId === m.matchId));
  const first = Math.min(...selected.map((m) => m.timestamp));
  const prior = filterMatches(
    all.filter((m) => m.timestamp < first),
    { ...filters, scope: "all" },
    journal,
  );
  if (filters.scope === "session") {
    // Session boundaries come from the complete archive. Applying a player or
    // result filter must not split a night or make an earlier match in the
    // current night look like a previous session.
    const sessions = groupSessions(all, filters.gapMinutes);
    const current = sessions.findIndex(
      (session) => session.key === filters.key,
    );
    if (current < 0) return [];
    const eligible = new Set(prior.map((m) => String(m.matchId)));
    for (const session of sessions.slice(current + 1)) {
      const matches = session.matches.filter((m) =>
        eligible.has(String(m.matchId)),
      );
      if (matches.length) return [...matches].reverse();
    }
    return [];
  }
  if (["week", "month", "custom"].includes(filters.scope)) {
    // Equal calendar-day span, shifted using civil dates rather than 24h DST offsets.
    const from =
      filters.scope === "custom"
        ? filters.from
        : filters.scope === "month"
          ? filters.key + "-01"
          : amsterdamDay(first * 1000);
    const start = new Date(from + "T12:00:00Z");
    let end: Date;
    if (filters.scope === "month") {
      end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(0);
    } else if (filters.scope === "week") {
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
    } else end = new Date(filters.to + "T12:00:00Z");
    const span = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const previousEnd = new Date(start);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    start.setUTCDate(start.getUTCDate() - span);
    return prior.filter((m) => {
      const d = amsterdamDay(m.timestamp * 1000);
      return (
        d >= start.toISOString().slice(0, 10) &&
        d <= previousEnd.toISOString().slice(0, 10)
      );
    });
  }
  return prior.slice(0, selected.length);
}
export function scopeOptions(
  matches: readonly Match[],
  filters: AnalyticsFilters,
) {
  if (filters.scope === "session")
    return groupSessions(matches, filters.gapMinutes).map((s) => ({
      key: s.key,
      label: s.label,
      matchCount: s.matches.length,
    }));
  if (
    filters.scope === "match" ||
    filters.scope === "week" ||
    filters.scope === "month"
  )
    return rawExportOptions(matches, filters.scope);
  return [];
}
export type PlayerSummary = {
  id: string;
  name: string;
  aliases: string[];
  roles: string[];
  role: string;
  matches: number;
  metrics: Record<MetricId, MetricResult>;
};
export function resolveAnalyticsFilters(
  matches: readonly Match[],
  filters: AnalyticsFilters,
): AnalyticsFilters {
  const scope =
    filters.view === "match"
      ? "match"
      : filters.view === "session"
        ? "session"
        : filters.scope;
  const scoped = {
    ...filters,
    scope,
    key: scope === filters.scope ? filters.key : "",
  };
  return {
    ...scoped,
    key: scoped.key || scopeOptions(matches, scoped)[0]?.key || "",
  };
}
export function playerSummaries(
  matches: readonly Match[],
  filters: AnalyticsFilters,
  identityMatches: readonly Match[] = matches,
): PlayerSummary[] {
  const identityRows = playerRows(identityMatches),
    allRows = playerRows(matches),
    rows = allRows.filter(
      (row) =>
        (!filters.playerIds.length ||
          filters.playerIds.includes(row.playerId)) &&
        (filters.role === "all" || row.role === filters.role),
    );
  const groups = new Map<string, PlayerRow[]>();
  for (const row of rows)
    groups.set(row.playerId, [...(groups.get(row.playerId) || []), row]);
  return [...groups]
    .flatMap(([id, sample]) => {
      const results = Object.fromEntries(
        metricIds.map((key) => [key, summarize(sample, key)]),
      ) as Record<MetricId, MetricResult>;
      const count = new Set(sample.map((r) => r.matchId)).size;
      if (count < filters.minMatches) return [];
      const roleCounts = new Map<string, number>();
      for (const row of sample)
        roleCounts.set(row.role, (roleCounts.get(row.role) || 0) + 1);
      const role = [...roleCounts].sort((a, b) => b[1] - a[1])[0][0];
      const observedIdentity = identityRows.filter(
        (row) => row.playerId === id,
      );
      const identity = observedIdentity.length ? observedIdentity : sample;
      return [
        {
          id,
          name: identity[0].name,
          aliases: [...new Set(identity.map((r) => r.name))],
          roles: [...new Set([...sample, ...identity].map((r) => r.role))],
          role,
          matches: count,
          metrics: results,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
export function displayValue(
  result: MetricResult,
  id: MetricId,
  mode: AnalyticsFilters["mode"],
): number | null {
  return metrics[id].kind === "count" && mode === "perMatch"
    ? result.perMatch
    : result.value;
}
export function playerCoordinates(
  player: PlayerSummary,
  xId: MetricId,
  yId: MetricId,
  minAttempts = 0,
) {
  const a = player.metrics[xId],
    b = player.metrics[yId];
  const x = displayValue(a, xId, "perMatch"),
    y = displayValue(b, yId, "perMatch");
  if (
    x === null ||
    y === null ||
    [a, b].some((r) => r.denominator !== null && r.denominator < minAttempts)
  )
    return null;
  return { x, y, xMetric: a, yMetric: b };
}
export function teamSummary(matches: readonly Match[]) {
  const infos = uniqueRawMatches(matches).map((m) => matchInfo(m as Match));
  const scored = infos.filter((i) => i.goals !== null && i.conceded !== null);
  const sum = (field: "goals" | "conceded" | "points") =>
    scored.length ? scored.reduce((a, i) => a + (i[field] || 0), 0) : null;
  const goals = sum("goals"),
    conceded = sum("conceded"),
    points = sum("points");
  return {
    matches: infos.length,
    covered: scored.length,
    wins: scored.filter((i) => i.result === "G").length,
    draws: scored.filter((i) => i.result === "B").length,
    losses: scored.filter((i) => i.result === "M").length,
    goals,
    conceded,
    difference: goals === null || conceded === null ? null : goals - conceded,
    points,
    pointsPerMatch: points === null ? null : points / scored.length,
  };
}
export function pairSummaries(
  matches: readonly Match[],
  filters: AnalyticsFilters,
) {
  const players = playerSummaries(matches, { ...filters, minMatches: 1 }),
    rows = playerRows(matches);
  return players.flatMap((a, index) =>
    players.slice(index + 1).map((b) => {
      const shared = uniqueRawMatches(matches).filter((m) =>
        [a.id, b.id].every((id) =>
          rows.some(
            (r) =>
              r.matchId === String(m.matchId) &&
              r.playerId === id &&
              (filters.role === "all" || r.role === filters.role),
          ),
        ),
      );
      return {
        a,
        b,
        ...teamSummary(shared),
        matchIds: shared.map((m) => String(m.matchId)),
        sufficient: shared.length >= filters.minMatches,
      };
    }),
  );
}
export const scatterPresets = [
  {
    id: "passing",
    label: "Pas sorumluluğu",
    x: "passAttempts",
    y: "passRate",
    context: "Sorumluluk ve güvenlik; sağ üst tek başarı ölçüsü değildir.",
  },
  {
    id: "forward",
    label: "İleri oyun",
    x: "forwardAttempts",
    y: "forwardRate",
    context: "İleri pasın yönü; hat kırma veya risk kalitesi ölçülmez.",
  },
  {
    id: "finishing",
    label: "Bitiricilik",
    x: "shots",
    y: "conversion",
    context: "Şut hacmi ve dönüşüm; rakip/rol ve az şut etkisi önemlidir.",
  },
  {
    id: "creation",
    label: "Golcü–hazırlayıcı",
    x: "goals",
    y: "assists",
    context:
      "Gol ve asist farklı görevleri yansıtır; kalite sıralaması değildir.",
  },
  {
    id: "tackling",
    label: "Savunma müdahalesi",
    x: "tackleAttempts",
    y: "tackleRate",
    context: "Müdahale yükü ve başarı; savunma fırsat sayısı bilinmiyor.",
  },
  {
    id: "defense",
    label: "Savunma tarzı",
    x: "interceptions",
    y: "tackleMade",
    context: "Farklı savunma aksiyonları; örtüşebilir, toplanmaz.",
  },
  {
    id: "balance",
    label: "Top dengesi",
    x: "losses",
    y: "wins",
    context:
      "Yüksek kayıp oyun sorumluluğuyla ilişkili olabilir; kazanımlar bağımsız kategori.",
  },
  {
    id: "consistency",
    label: "Form ve istikrar",
    x: "rating",
    y: "ratingDeviation",
    context:
      "Popülasyon standart sapması, en az iki puan. Düşük sapma yüksek kalite demek değildir.",
  },
] satisfies {
  id: string;
  label: string;
  x: MetricId;
  y: MetricId;
  context: string;
}[];
export function rolePercentile(
  players: readonly PlayerSummary[],
  player: PlayerSummary,
  id: MetricId,
): { value: number; size: number } | null {
  // One role only, at least five distinct peers and at least three valid matches each.
  if (player.roles.length !== 1 || player.metrics[id].covered < 3) return null;
  const cohort = players.filter(
    (p) =>
      p.roles.length === 1 &&
      p.role === player.role &&
      p.metrics[id].covered >= 3 &&
      p.metrics[id].value !== null,
  );
  const metricValue = (p: PlayerSummary) =>
    displayValue(p.metrics[id], id, "perMatch");
  const value = metricValue(player);
  if (cohort.length < 5 || value === null) return null;
  const lower = cohort.filter((p) => metricValue(p)! < value).length,
    equal = cohort.filter((p) => metricValue(p) === value).length;
  return {
    value: (100 * (lower + (equal - 1) / 2)) / (cohort.length - 1),
    size: cohort.length,
  };
}
export type Evidence = {
  observation: string;
  evidence: string;
  explanation: string;
  experiment: string;
  track: MetricId;
  sample: string;
  matchIds: string[];
};
export function evidenceFor(
  current: readonly Match[],
  previous: readonly Match[],
  rows: readonly PlayerRow[] = playerRows(current),
  priorRows: readonly PlayerRow[] = playerRows(previous),
): Evidence[] {
  return (["passRate", "accuracy", "lostDefense"] as MetricId[])
    .flatMap((id) => {
      const a = summarize(rows, id),
        b = summarize(priorRows, id),
        av = metrics[id].kind === "rate" ? a.value : a.perMatch,
        bv = metrics[id].kind === "rate" ? b.value : b.perMatch;
      if (
        av === null ||
        bv === null ||
        a.covered < 3 ||
        b.covered < 3 ||
        a.matchIds.length < 2 ||
        b.matchIds.length < 2
      )
        return [];
      return [
        {
          observation:
            metrics[id].label +
            " önceki örneklemden " +
            (av === bv ? "aynı düzeyde" : av > bv ? "yüksek" : "düşük") +
            ".",
          evidence:
            "Önceki " +
            bv.toFixed(2) +
            " → mevcut " +
            av.toFixed(2) +
            "; fark " +
            (av - bv).toFixed(2) +
            (metrics[id].kind === "rate"
              ? " yüzde puan"
              : " / geçerli oyuncu-maç"),
          explanation:
            "Rol, rakip veya oyuncu kapsamı değişmiş olabilir; nedensellik kurulamaz.",
          experiment:
            id === "passRate"
              ? "Bir sonraki seansta baskı altında kısa pas seçimini ayrı bir taktik etiketiyle deneyin."
              : id === "accuracy"
                ? "Bir sonraki seansta şut seçimini not ederek isabet pay/paydasını takip edin."
                : "Bir sonraki seansta savunma bölgesindeki çıkış seçeneklerini değiştirip bölgesel kayıpları takip edin.",
          track: id,
          sample: `${a.covered}/${a.available} ve ${b.covered}/${b.available} geçerli oyuncu-maç; insan kayıtlarıdır, rakip ve rol etkileri ayrıştırılmaz.`,
          matchIds: a.matchIds,
        },
      ];
    })
    .slice(0, 3);
}
export function matchEvidence(
  match: Match,
  history: readonly Match[],
  teamId = "79638",
  filters: Pick<AnalyticsFilters, "playerIds" | "role"> = defaultFilters,
): Evidence[] {
  const prior = uniqueRawMatches(history).filter(
      (m) => m.timestamp < match.timestamp,
    ),
    rows = filterPlayerRows([match], filters, teamId);
  return (["passRate", "accuracy", "lostDefense"] as MetricId[])
    .flatMap((id) => {
      const current = summarize(rows, id),
        reference = prior
          .map((m) => summarize(filterPlayerRows([m], filters, teamId), id))
          .filter((r) => r.value !== null);
      if (current.value === null || reference.length < 3) return [];
      const baseline = median(reference.map((r) => r.value!))!;
      return [
        {
          track: id,
          observation:
            metrics[id].label +
            ": önceki maç medyanından " +
            (current.value === baseline
              ? "fark yok."
              : current.value > baseline
                ? "yüksek."
                : "düşük."),
          evidence:
            "Bu maç " +
            current.value.toFixed(2) +
            "; geçmiş medyan " +
            baseline.toFixed(2) +
            (metrics[id].kind === "rate" ? " %." : " insan olayı."),
          explanation:
            "Kadro, rakip ve görevler farklı olabilir; farkın nedeni bu kayıtlardan belirlenemez.",
          experiment:
            "Sonraki seansta " +
            metrics[id].label.toLocaleLowerCase("tr-TR") +
            " için bir taktik deneme etiketi kaydedip aynı kapsamla karşılaştırın.",
          sample:
            reference.length +
            " önceki geçerli maç; mevcut insan kayıt kapsamı " +
            current.covered +
            "/" +
            current.available +
            ". Medyan betimleyicidir; güven aralığı değildir.",
          matchIds: [
            ...new Set([
              String(match.matchId),
              ...reference.flatMap((r) => r.matchIds),
            ]),
          ],
        },
      ];
    })
    .slice(0, 3);
}
export function buildAnalyticsReport(
  all: readonly Match[],
  filters: AnalyticsFilters,
  exportedAt: string,
  journal: Journal = {},
) {
  filters = resolveAnalyticsFilters(all, filters);
  const matches = filterMatches(all, filters, journal),
    previous = previousMatches(all, matches, filters, journal);
  // Preserve identity/role observations even when the role filter excludes an
  // entire match. Those observations are metadata, not extra metric samples.
  const identities = filterMatches(all, { ...filters, role: "all" }, journal);
  const players = playerSummaries(matches, filters, identities);
  const rows = playerRows(matches).filter(
    (r) =>
      (!filters.playerIds.length || filters.playerIds.includes(r.playerId)) &&
      (filters.role === "all" || r.role === filters.role),
  );
  const priorRows = playerRows(previous).filter(
    (r) =>
      (!filters.playerIds.length || filters.playerIds.includes(r.playerId)) &&
      (filters.role === "all" || r.role === filters.role),
  );
  const results = Object.fromEntries(
    metricIds.map((id) => [id, summarize(rows, id)]),
  ) as Record<MetricId, MetricResult>;
  const trend = [...matches].reverse().map((match) => {
    const matchRows = rows.filter(
      (row) => row.matchId === String(match.matchId),
    );
    return {
      matchId: String(match.matchId),
      timestamp: match.timestamp,
      ...matchInfo(match),
      metrics: Object.fromEntries(
        metricIds.map((id) => [id, summarize(matchRows, id)]),
      ) as Record<MetricId, MetricResult>,
    };
  });
  const opponents =
    filters.scope === "match"
      ? matches.flatMap((match) =>
          Object.entries(match.clubs).flatMap(([id, club]) => {
            if (id === "79638" || !club) return [];
            const opponentRows = filterPlayerRows(
              [match],
              { ...filters, playerIds: [] },
              id,
            );
            return [
              {
                clubId: id,
                name: club.details?.name || id,
                matchId: String(match.matchId),
                playerMetrics: Object.fromEntries(
                  metricIds.map((metric) => [
                    metric,
                    summarize(opponentRows, metric),
                  ]),
                ) as Record<MetricId, MetricResult>,
              },
            ];
          }),
        )
      : [];
  return {
    exportedAt,
    timezone: ANALYTICS_TIMEZONE,
    filters,
    matchCount: matches.length,
    matchIds: matches.map((m) => String(m.matchId)),
    previousMatchIds: previous.map((m) => String(m.matchId)),
    team: teamSummary(matches),
    previousTeam: teamSummary(previous),
    players,
    previousPlayers: playerSummaries(previous, filters),
    playerMetrics: results,
    opponents,
    trend,
    evidence: evidenceFor(matches, previous, rows, priorRows),
    coverage:
      "Yalnız erişilebilir kayıtlı maçlar; kulüp kariyer toplamları dahil değildir. İnsan oyuncu sayaçları AI ve eksik kayıtları kapsamayabilir.",
    dictionary: [
      ...teamMetricDictionary,
      ...metricIds.map((id) => {
        const { read, ...definition } = metrics[id];
        void read;
        return definition;
      }),
    ],
  };
}
export type AnalyticsReport = ReturnType<typeof buildAnalyticsReport>;
export function passingProfile(
  rows: readonly PlayerRow[],
  category: "direction" | "length",
) {
  const codes =
    category === "direction"
      ? [
          [30, 31],
          [32, 33],
          [34, 35],
        ]
      : [
          [24, 25],
          [26, 27],
          [28, 29],
          [36, 37],
        ];
  const labels =
    category === "direction"
      ? ["İleri", "Geri", "Yana", "Sınıflanmayan"]
      : ["Kısa", "Orta", "Uzun", "Orta yapma", "Sınıflanmayan"];
  const totals = labels.map(() => [0, 0]);
  let covered = 0;
  for (const row of rows) {
    const e = playerEvents(row.raw) as Map<number, number> | null;
    if (!e) continue;
    const pairs = codes.map((pair) => pair.map((code) => e.get(code) || 0));
    const residuals = [0, 1].map(
      (i) =>
        (e.get(i ? 216 : 215) || 0) - pairs.reduce((a, pair) => a + pair[i], 0),
    );
    if (residuals.some((v) => v < 0)) continue;
    covered++;
    [...pairs, residuals].forEach((pair, i) =>
      pair.forEach((n, j) => (totals[i][j] += n)),
    );
  }
  return {
    covered,
    available: rows.length,
    rows: labels.map((label, i) => ({
      label,
      made: covered ? totals[i][0] : null,
      failed: covered ? totals[i][1] : null,
    })),
  };
}
export function rollingTrend(
  trend: AnalyticsReport["trend"],
  id: MetricId,
  window = 5,
): (number | null)[] {
  return trend.map((_, i) => {
    const sample = trend
      .slice(Math.max(0, i - window + 1), i + 1)
      .map((row) => row.metrics[id])
      .filter((r) => r.covered > 0);
    if (!sample.length) return null;
    if (metrics[id].kind === "rate") {
      const n = sample.reduce((a, r) => a + (r.numerator || 0), 0),
        d = sample.reduce((a, r) => a + (r.denominator || 0), 0);
      return d ? (n / d) * 100 : null;
    }
    if (metrics[id].kind === "deviation") return null;
    const n = sample.reduce((a, r) => a + (r.total || 0), 0),
      d =
        metrics[id].kind === "mean"
          ? sample.reduce((a, r) => a + r.covered, 0)
          : sample.length;
    return d ? n / d : null;
  });
}
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return (
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'
  );
}
export function analyticsCSV(report: AnalyticsReport): string {
  const rows: unknown[][] = [
    [
      "seviye",
      "oyuncuId",
      "oyuncu",
      "rol",
      "metrik",
      "değer",
      "birim",
      "toplam",
      "pay",
      "payda",
      "geçerli",
      "mevcut",
      "maçIdleri",
      "kulüpId",
    ],
  ];
  for (const [id, value] of Object.entries(report.team))
    rows.push([
      "takım-maç",
      "",
      "LEO XI",
      "",
      id,
      value,
      id === "pointsPerMatch" ? "puan/maç" : "sayı",
      value,
      "",
      "",
      report.team.covered,
      report.matchCount,
      report.matchIds.join("|"),
      '79638',
    ]);
  for (const opponent of report.opponents)
    for (const id of metricIds) {
      const r = opponent.playerMetrics[id];
      rows.push([
        "rakip-insan-kayıtları",
        '',
        opponent.name,
        report.filters.role,
        id,
        r.value,
        metrics[id].unit,
        r.total,
        r.numerator,
        r.denominator,
        r.covered,
        r.available,
        r.matchIds.join("|"),
        opponent.clubId,
      ]);
    }
  for (const player of report.players)
    for (const id of metricIds) {
      const r = player.metrics[id];
      rows.push([
        "oyuncu-maç",
        player.id,
        player.name,
        player.roles.join("|"),
        id,
        displayValue(r, id, report.filters.mode),
        metrics[id].unit +
          (metrics[id].kind === "count" && report.filters.mode === "perMatch"
            ? "/maç"
            : ""),
        r.total,
        r.numerator,
        r.denominator,
        r.covered,
        r.available,
        r.matchIds.join("|"),
        '79638',
      ]);
    }
  return (
    "\uFEFF" +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
export function analyticsFilename(
  filters: AnalyticsFilters,
  extension: string,
  day: string,
): string {
  return (
    `leo-xi-${filters.view}-${filters.scope}-${filters.key ? filters.key + "-" : ""}${day}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "-",
    ) +
    "." +
    extension
  );
}
