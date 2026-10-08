"use client";
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useEffect,
} from "react";
import {
  BarChart3,
  Users,
  Target,
  CalendarDays,
  GitCompareArrows,
  Grid3X3,
  Network,
  TrendingUp,
  X,
  Printer,
  Download,
} from "lucide-react";
import {
  useLocationSearch,
  readSearch,
  replaceSearch,
} from "./analytics-location";
import {
  ChartCard,
  ScatterChart,
  TrendChart,
  Distribution,
  numberLabel,
  downloadFile,
  ComparisonBars,
} from "./analytics-charts";
import type { ScatterPoint } from "./analytics-charts";
import MatchReport, {
  PassProfile,
  ZoneBalance,
  EvidenceCards,
  PrintableReport,
} from "./analytics-report";
import {
  defaultFilters,
  resolveAnalyticsFilters,
  playerCoordinates,
  filterPlayerRows,
  filtersFromSearch,
  filtersToSearch,
  buildAnalyticsReport,
  analyticsCSV,
  analyticsFilename,
  groupSessions,
  scopeOptions,
  playerRows,
  playerSummaries,
  roles,
  roleColors,
  metrics,
  metricIds,
  scatterPresets,
  displayValue,
  summarize,
  pairSummaries,
  rolePercentile,
  matchInfo,
  passingProfile,
  rollingTrend,
  parseJournal,
  evidenceFor,
} from "../lib/club-analytics";
import type {
  AnalyticsFilters,
  AnalyticsReport,
  PlayerSummary,
  MetricId,
  JournalEntry,
  Journal,
  AnalyticsScope,
} from "../lib/club-analytics";
import { createRawExport, uniqueRawMatches } from "../lib/club-export";
import type { Match } from "../lib/club-types";

const views = [
  ["team", "Takım", BarChart3],
  ["players", "Oyuncular", Users],
  ["match", "Maç", Target],
  ["session", "Seans", CalendarDays],
  ["compare", "Karşılaştır", GitCompareArrows],
  ["matrix", "Oyuncu × maç", Grid3X3],
  ["pairs", "Birlikte oynama", Network],
  ["development", "Gelişim", TrendingUp],
] as const;
const scopeLabels: Record<AnalyticsScope, string> = {
  all: "Tüm kayıtlı maçlar",
  match: "Tek maç",
  session: "Seans / maç gecesi",
  week: "Takvim haftası",
  month: "Takvim ayı",
  last5: "Son 5 maç",
  last10: "Son 10 maç",
  last20: "Son 20 maç",
  custom: "Özel tarih aralığı",
};
const journalKey = "leo-xi-tactical-journal-v1",
  journalEvent = "leo-journal-change";
const emptyJournal = "{}";
function readJournal() {
  try {
    return localStorage.getItem(journalKey) || emptyJournal;
  } catch {
    return emptyJournal;
  }
}
function subscribeJournal(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(journalEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(journalEvent, callback);
  };
}
function playerColor(id: string) {
  const palette = [
    "#e8bc68",
    "#85bda8",
    "#87a9dc",
    "#c399cf",
    "#d99681",
    "#b5ba74",
    "#70b5c3",
    "#dc9cae",
  ];
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
function metricUnit(id: MetricId, mode: AnalyticsFilters["mode"] = "perMatch") {
  return (
    metrics[id].unit +
    (metrics[id].kind === "count" && mode === "perMatch"
      ? " / geçerli maç"
      : "")
  );
}
function MetricTable({
  players,
  ids,
  mode,
  onPlayer,
}: {
  players: PlayerSummary[];
  ids: MetricId[];
  mode: AnalyticsFilters["mode"];
  onPlayer?: (id: string) => void;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Oyuncu / EA rolü</th>
          {ids.map((id) => (
            <th key={id}>
              {metrics[id].label}
              <small>{metricUnit(id, mode)}</small>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id}>
            <th scope="row">
              {onPlayer ? (
                <button className="playerButton" onClick={() => onPlayer(p.id)}>
                  {p.name}
                </button>
              ) : (
                <span>{p.name}</span>
              )}
              <small>
                {p.roles.map((role) => roles[role]).join(" / ")} · {p.matches}{" "}
                maç
              </small>
            </th>
            {ids.map((id) => {
              const r = p.metrics[id];
              return (
                <td key={id}>
                  {numberLabel(displayValue(r, id, mode))}
                  <small>
                    {r.numerator === null
                      ? ""
                      : `${r.numerator}/${r.denominator} · `}
                    {r.covered}/{r.available} kayıt
                  </small>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function SourceMatches({
  matches,
  onMatch,
}: {
  matches: Match[];
  onMatch: (id: string) => void;
}) {
  return (
    <div className="sourceLinks">
      {matches.map((m) => {
        const i = matchInfo(m);
        return (
          <button
            type="button"
            key={m.matchId}
            onClick={() => onMatch(String(m.matchId))}
          >
            {i.date} · {i.opponent} · {numberLabel(i.goals, 0)}:
            {numberLabel(i.conceded, 0)}
          </button>
        );
      })}
    </div>
  );
}
function JournalEditor({
  entity,
  journal,
}: {
  entity: string;
  journal: Journal;
}) {
  const [draft, setDraft] = useState<JournalEntry>(
      journal[entity] || { formation: "", tactic: "", role: "", note: "" },
    ),
    [status, setStatus] = useState("");
  function save() {
    try {
      const next = parseJournal(readJournal());
      next[entity] = draft;
      localStorage.setItem(journalKey, JSON.stringify(next));
      window.dispatchEvent(new Event(journalEvent));
      setStatus("Bu tarayıcıda kaydedildi.");
    } catch {
      setStatus("Tarayıcı depolaması kullanılamıyor; not kaydedilemedi.");
    }
  }
  return (
    <details className="analyticsAdvanced noPrint">
      <summary>
        Taktik günlüğü ·{" "}
        {entity.startsWith("player:")
          ? "oyuncu etiketi"
          : entity.startsWith("session:")
            ? "seans"
            : "maç"}
      </summary>
      <p className="footnote">
        Yalnız bu tarayıcıda saklanır; takımın ortak panosuna gönderilmez.
        Kullanıcı etiketleri EA rolü/verisi değildir. Maç/seans etiketleri
        Taktik etiketi filtresinde kullanılabilir.
      </p>
      <div className="analyticsFilters">
        {(["formation", "tactic", "role"] as const).map((field) => (
          <label key={field}>
            {field === "formation"
              ? "Diziliş"
              : field === "tactic"
                ? "Taktik etiketi"
                : "Kullanıcı rol etiketi"}
            <input
              value={draft[field]}
              maxLength={field === "tactic" ? 80 : 40}
              onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label className="formLabel">
        Kısa not
        <textarea
          value={draft.note}
          maxLength={1000}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </label>
      <button type="button" className="primaryButton" onClick={save}>
        Notu kaydet
      </button>
      <p role="status">{status}</p>
    </details>
  );
}

export default function AnalyticsDashboard({
  matches,
  onMatch,
}: {
  matches: Match[];
  onMatch: (id: string) => void;
}) {
  const search = useLocationSearch(),
    rawFilters = useMemo(() => filtersFromSearch(search), [search]);
  const journalRaw = useSyncExternalStore(
      subscribeJournal,
      readJournal,
      () => emptyJournal,
    ),
    journal = useMemo(() => parseJournal(journalRaw), [journalRaw]);
  const filters = useMemo(
    () => resolveAnalyticsFilters(matches, rawFilters),
    [matches, rawFilters],
  );
  const options = useMemo(
    () => scopeOptions(matches, filters),
    [matches, filters],
  );
  const report = useMemo(
    () => buildAnalyticsReport(matches, filters, "", journal),
    [matches, filters, journal],
  );
  const pool = useMemo(
    () =>
      (uniqueRawMatches(matches) as Match[]).filter((m) =>
        report.matchIds.includes(String(m.matchId)),
      ),
    [matches, report.matchIds],
  );
  const allPlayers = useMemo(
    () => playerSummaries(matches, defaultFilters),
    [matches],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]),
    [focusedId, setFocusedId] = useState(""),
    [printTime, setPrintTime] = useState(""),
    [error, setError] = useState("");
  function selectPlayers(ids: string[]) {
    setSelectedIds(ids);
    if (ids.length === 1) setFocusedId(ids[0]);
  }
  const selectedPlayers = report.players.filter((p) =>
    selectedIds.includes(p.id),
  );
  function update(patch: Partial<AnalyticsFilters>) {
    const next = resolveAnalyticsFilters(matches, { ...filters, ...patch });
    if (patch.scope && patch.scope !== filters.scope) {
      next.key = "";
      next.key = scopeOptions(matches, next)[0]?.key || "";
    }
    replaceSearch(filtersToSearch(next, readSearch()));
    setError("");
  }
  function exportData(format: "csv" | "json" | "raw" | "all-raw") {
    try {
      const now = new Date().toISOString(),
        day = now.slice(0, 10),
        exported = { ...report, exportedAt: now };
      if (format === "all-raw") {
        const file = createRawExport(matches, { scope: "all-time" }, now);
        downloadFile(
          file.json,
          file.filename.replace(".json", "-" + day + ".json"),
        );
      } else if (format === "raw")
        downloadFile(
          JSON.stringify(
            {
              exportedAt: now,
              timezone: "Europe/Amsterdam",
              scope: filters.scope,
              selection: filters,
              matchCount: pool.length,
              matches: pool,
            },
            null,
            2,
          ),
          analyticsFilename(filters, "json", day).replace(".json", "-raw.json"),
        );
      else
        downloadFile(
          format === "csv"
            ? analyticsCSV(exported)
            : JSON.stringify(exported, null, 2),
          analyticsFilename(filters, format, day),
          format === "csv" ? "text/csv" : "application/json",
        );
    } catch {
      setError(
        "Dosya indirilemedi. Tarayıcı indirme izinlerini kontrol edebilirsin.",
      );
    }
  }
  const opponents = [
    ...new Map(
      matches.map((m) => {
        const i = matchInfo(m);
        return [i.opponentId, i.opponent] as const;
      }),
    ),
  ];
  const matchTypes = [...new Set(matches.map((m) => matchInfo(m).type))];
  return (
    <div className="analyticsDashboard">
      <details className="analyticsIntro analyticsGuide"><summary>Analizi nasıl kullanırım?</summary><div>
        <div>
          <p className="eyebrow">LEO XI · PERFORMANS LABORATUVARI</p>
          <h3>Takımını daha yakından tanı.</h3>
          <p>
            Maçları birlikte oku. Her sayının kapsamını gör, kaydına ulaş,
            sonraki denemeyi ölç.
          </p>
        </div>
        <span className="miniTag">
          {matches.length} erişilebilir arşiv kaydı
        </span>
      </div></details>
      <div
        className="analyticsViewTabs noPrint"
        role="tablist"
        aria-label="Performans analiz görünümleri"
      >
        {views.map(([id, label, Icon]) => (
          <button
            type="button"
            key={id}
            role="tab"
            id={"analysis-tab-" + id}
            aria-selected={filters.view === id}
            aria-controls="analysis-view"
            className={filters.view === id ? "chosen" : ""}
            onClick={() => update({ view: id })}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <section
        className="panel analyticsFilterPanel noPrint"
        aria-label="Ortak analiz filtreleri"
      >
        <div className="analyticsFilters">
          <label>
            Kapsam
            <select
              aria-label="Analiz kapsamı"
              disabled={filters.view === "match" || filters.view === "session"}
              value={filters.scope}
              onChange={(e) =>
                update({ scope: e.target.value as AnalyticsScope })
              }
            >
              {Object.entries(scopeLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {options.length > 0 && (
            <label>
              Seçim
              <select
                aria-label="Kapsam seçimi"
                value={filters.key}
                onChange={(e) => update({ key: e.target.value })}
              >
                {options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} · {option.matchCount} maç
                  </option>
                ))}
              </select>
            </label>
          )}
          {filters.scope === "custom" && (
            <>
              <label>
                Başlangıç
                <input
                  aria-label="Aralık başlangıcı"
                  type="date"
                  value={filters.from}
                  onChange={(e) => update({ from: e.target.value })}
                />
              </label>
              <label>
                Bitiş
                <input
                  aria-label="Aralık bitişi"
                  type="date"
                  value={filters.to}
                  onChange={(e) => update({ to: e.target.value })}
                />
              </label>
            </>
          )}
          <label>
            Gösterim
            <select
              aria-label="Metrik gösterimi"
              value={filters.mode}
              onChange={(e) =>
                update({
                  mode: e.target.value === "total" ? "total" : "perMatch",
                })
              }
            >
              <option value="perMatch">Geçerli maç başına</option>
              <option value="total">Toplam</option>
            </select>
          </label>
        </div>
        <details className="analyticsAdvanced">
          <summary>Oyuncu, rol, rakip ve karşılaştırma filtreleri</summary>
          <div className="analyticsFilters">
            <label>
              Oyuncular
              <select
                aria-label="Analiz oyuncuları"
                multiple
                value={filters.playerIds}
                onChange={(e) =>
                  update({
                    playerIds: [...e.target.selectedOptions].map(
                      (o) => o.value,
                    ),
                  })
                }
              >
                {allPlayers.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · #{p.id}
                  </option>
                ))}
              </select>
              <small>Boş seçim = tümü; Ctrl/⌘ ile çoklu seçim.</small>
            </label>
            <label>
              Maçtaki EA rolü
              <select
                aria-label="Analiz rolü"
                value={filters.role}
                onChange={(e) => update({ role: e.target.value })}
              >
                <option value="all">Tüm roller</option>
                {Object.entries(roles).map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sonuç
              <select
                value={filters.result}
                onChange={(e) => update({ result: e.target.value })}
              >
                <option value="all">G / B / M</option>
                <option value="G">Galibiyet</option>
                <option value="B">Beraberlik</option>
                <option value="M">Mağlubiyet</option>
              </select>
            </label>
            <label>
              Rakip
              <select
                value={filters.opponent}
                onChange={(e) => update({ opponent: e.target.value })}
              >
                <option value="all">Tüm rakipler</option>
                {opponents.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Maç türü
              <select
                value={filters.matchType}
                onChange={(e) => update({ matchType: e.target.value })}
              >
                <option value="all">Tüm türler</option>
                {matchTypes.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Minimum oyuncu / ortak maç
              <input
                aria-label="Minimum maç"
                type="number"
                min="1"
                max="10000"
                value={filters.minMatches}
                onChange={(e) =>
                  update({
                    minMatches: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </label>
            <label>
              Harita oranları için min. deneme
              <input
                aria-label="Minimum deneme"
                type="number"
                min="0"
                value={filters.minAttempts}
                onChange={(e) =>
                  update({
                    minAttempts: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              Seans boşluğu (dakika)
              <input
                aria-label="Seans boşluğu"
                type="number"
                min="15"
                max="720"
                value={filters.gapMinutes}
                onChange={(e) =>
                  update({
                    gapMinutes: Math.max(
                      15,
                      Math.min(720, Number(e.target.value) || 120),
                    ),
                    key: "",
                  })
                }
              />
            </label>
            <label>
              Taktik etiketi
              <input
                value={filters.tag}
                maxLength={40}
                onChange={(e) => update({ tag: e.target.value })}
              />
            </label>
            <label>
              Karşılaştırma dönemi
              <select
                aria-label="Karşılaştırma dönemi"
                value={filters.compare}
                onChange={(e) =>
                  update({
                    compare: e.target.value as AnalyticsFilters["compare"],
                  })
                }
              >
                <option value="previous">Önceki eşit dönem / maç sayısı</option>
                <option value="custom">Seçili tarih aralığı</option>
                <option value="none">Kapalı</option>
              </select>
            </label>
            {filters.compare === "custom" && (
              <>
                <label>
                  Önceki başlangıç
                  <input
                    type="date"
                    value={filters.compareFrom}
                    onChange={(e) => update({ compareFrom: e.target.value })}
                  />
                </label>
                <label>
                  Önceki bitiş
                  <input
                    type="date"
                    value={filters.compareTo}
                    onChange={(e) => update({ compareTo: e.target.value })}
                  />
                </label>
              </>
            )}
          </div>
        </details>
        <p className="footnote">
          Seans: ardışık maçlar arasında en fazla {filters.gapMinutes} dakika;
          gece yarısı bölünmez. Takvim günleri/ayları Europe/Amsterdam; haftalar
          pazartesi. Önceki hafta/ay/aralık aynı sayıda takvim günü; son N
          görünümünde önceki N uygun maç. Oyuncu eşikleri harita kohortuna
          uygulanır. Haritalarda sayımlar geçerli oyuncu-maç başınadır.
        </p>
        <button
          className="textBtn"
          onClick={() => update({ ...defaultFilters, view: filters.view })}
        >
          Filtreleri temizle
        </button>
      </section>
      <div className="analyticsToolbar noPrint">
        <span>
          {report.matchCount} maç · {report.players.length} oyuncu ·{" "}
          {report.previousMatchIds.length} önceki maç
        </span>
        <button disabled={!pool.length} onClick={() => exportData("csv")}>
          <Download size={14} /> CSV
        </button>
        <button disabled={!pool.length} onClick={() => exportData("json")}>
          Filtreli JSON
        </button>
        <button disabled={!pool.length} onClick={() => exportData("raw")}>
          Ham JSON
        </button>
        <button
          disabled={!matches.length}
          onClick={() => exportData("all-raw")}
        >
          Tüm arşivi indir
        </button>
        <button
          disabled={!pool.length}
          onClick={() => {
            setPrintTime(new Date().toISOString());
            setTimeout(() => window.print(), 0);
          }}
        >
          <Printer size={14} /> PDF / Yazdır
        </button>
        <button
          onClick={() => {
            void navigator.clipboard
              ?.writeText(window.location.href)
              .catch(() =>
                setError(
                  "Bağlantı kopyalanamadı; adres çubuğundaki URL paylaşılabilir.",
                ),
              );
          }}
        >
          Bağlantıyı kopyala
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="analyticsCoverage" role="status">
        {report.coverage} Seçili kapsam: {scopeLabels[filters.scope]}. Ölçümler
        dakika başına değildir; dönemler rol/rakip dağılımıyla değişebilir.
      </p>
      <div
        id="analysis-view"
        role="tabpanel"
        aria-labelledby={"analysis-tab-" + filters.view}
      >
        {!pool.length ? (
          <section className="panel">
            <p className="empty">
              Bu filtrelerde kayıtlı maç yok. Yeni EA verisi veya eksik geçmiş
              üretilmez.
            </p>
          </section>
        ) : (
          <>
            {filters.view === "team" && (
              <TeamView
                report={report}
                matches={pool}
                onMatch={onMatch}
                onPlayer={(id) => selectPlayers([id])}
              />
            )}
            {filters.view === "players" && (
              <PlayerMaps
                report={report}
                onSelect={selectPlayers}
                selected={focusedId}
              />
            )}
            {filters.view === "match" && (
              <>
                <label className="formLabel noPrint">
                  Maç raporu
                  <select
                    value={pool[0].matchId}
                    onChange={(e) =>
                      update({ scope: "match", key: e.target.value })
                    }
                  >
                    {matches.map((m) => (
                      <option value={m.matchId} key={m.matchId}>
                        {matchInfo(m).date} · {matchInfo(m).opponent} · #
                        {m.matchId}
                      </option>
                    ))}
                  </select>
                </label>
                <MatchReport
                  key={pool[0].matchId}
                  match={pool[0]}
                  history={matches}
                  filters={filters}
                  journal={journal}
                  onMatch={onMatch}
                />
                <JournalEditor
                  key={"match:" + pool[0].matchId}
                  entity={"match:" + pool[0].matchId}
                  journal={journal}
                />
              </>
            )}
            {filters.view === "session" && (
              <SessionView
                all={matches}
                filters={filters}
                report={report}
                onMatch={onMatch}
                update={update}
                journal={journal}
              />
            )}
            {filters.view === "compare" && (
              <CompareView
                report={report}
                matches={pool}
                onPlayer={(id) => selectPlayers([id])}
                onMatch={onMatch}
              />
            )}
            {filters.view === "matrix" && (
              <MatrixView
                report={report}
                matches={pool}
                onSelect={(_playerId, matchId) => onMatch(matchId)}
              />
            )}
            {filters.view === "pairs" && (
              <PairsView matches={pool} filters={filters} onMatch={onMatch} />
            )}
            {filters.view === "development" && (
              <DevelopmentView
                report={report}
                matches={pool}
                all={matches}
                journal={journal}
                onMatch={onMatch}
              />
            )}
          </>
        )}
      </div>
      <details className="analyticsAdvanced metricDictionary noPrint">
        <summary>Metrik sözlüğü · formüller, kaynaklar ve kısıtlar</summary>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Metrik</th>
                <th>Kaynak ve formül</th>
                <th>Kapsam ve yorum</th>
              </tr>
            </thead>
            <tbody>
              {report.dictionary.map((m) => {
                return (
                  <tr key={m.id}>
                    <th>
                      {m.label}
                      <small>
                        {m.unit} · {m.level}
                      </small>
                    </th>
                    <td>
                      {m.source.join(", ")}
                      <p>{m.formula}</p>
                      <small>
                        {m.periods} · {m.aggregation}
                      </small>
                    </td>
                    <td>
                      {m.description}
                      <p>{m.missing}</p>
                      <p>{m.coverage}</p>
                      <p>{m.limitation}</p>
                      <small>{m.interpretation}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <details className="analyticsAdvanced noPrint">
        <summary>Seçili sayıları oluşturan maçlar</summary>
        <SourceMatches matches={pool} onMatch={onMatch} />
      </details>
      <PrintableReport report={{ ...report, exportedAt: printTime }} />
      {selectedIds.length > 0 && (
        <PlayerDrawer
          players={selectedPlayers}
          allPlayers={allPlayers}
          report={report}
          matches={pool}
          onClose={() => setSelectedIds([])}
          onSelect={(id) => selectPlayers([id])}
          onMatch={onMatch}
          journal={journal}
        />
      )}
    </div>
  );
}

function playerPoints(
  players: PlayerSummary[],
  xId: MetricId,
  yId: MetricId,
  minAttempts: number,
): ScatterPoint[] {
  return players.flatMap((p) => {
    const coordinate = playerCoordinates(p, xId, yId, minAttempts);
    if (!coordinate) return [];
    const { x, y, xMetric: a, yMetric: b } = coordinate;
    return [
      {
        id: p.id,
        label: p.name,
        x,
        y,
        role: p.role,
        color: roleColors[p.role] || roleColors.unknown,
        detail: `${p.name} · ${roles[p.role]}: ${metrics[xId].label} ${numberLabel(x)} (${a.numerator ?? a.total}/${a.denominator ?? a.covered}); ${metrics[yId].label} ${numberLabel(y)} (${b.numerator ?? b.total}/${b.denominator ?? b.covered}); kapsam ${a.covered}/${a.available} ve ${b.covered}/${b.available} · ${p.matches} maç`,
      },
    ];
  });
}
function PlayerMaps({
  report,
  onSelect,
  selected,
}: {
  report: AnalyticsReport;
  onSelect: (ids: string[]) => void;
  selected?: string;
}) {
  const [preset, setPreset] = useState("passing"),
    [zone, setZone] = useState("all"),
    [customX, setCustomX] = useState<MetricId>("passAttempts"),
    [customY, setCustomY] = useState<MetricId>("passRate");
  const active =
    scatterPresets.find((p) => p.id === preset) || scatterPresets[0];
  const xId: MetricId =
    preset === "custom"
      ? customX
      : active.id === "balance" && zone !== "all"
        ? (("lost" + zone) as MetricId)
        : active.x;
  const yId: MetricId =
    preset === "custom"
      ? customY
      : active.id === "balance" && zone !== "all"
        ? (("won" + zone) as MetricId)
        : active.y;
  const points = playerPoints(
      report.players,
      xId,
      yId,
      report.filters.minAttempts,
    ),
    previous = playerPoints(
      report.previousPlayers,
      xId,
      yId,
      report.filters.minAttempts,
    );
  return (
    <>
      <ChartCard
        exportable
        title={preset === "custom" ? "Kendi haritan" : active.label}
        question="OYUNCULARIN GÖREV PROFİLLERİ NASIL AYRIŞIYOR?"
        note={
          (preset === "custom"
            ? "Yalnız sözlükte tanımlı oyuncu-maç metrikleri kullanılır."
            : active.context) +
          " Kesikli çizgiler kohort medyanı; renk ve şekil EA rolünü gösterir. Ok yalnız seçili oyuncunun iki geçerli dönemini birleştirir. Çakışan noktaya tıklayınca liste açılır."
        }
        table={
          <MetricTable
            players={report.players}
            ids={[xId, yId]}
            mode="perMatch"
            onPlayer={(id) => onSelect([id])}
          />
        }
      >
        <div className="analyticsFilters noPrint">
          <label>
            Hazır harita
            <select
              aria-label="Oyuncu haritası"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {scatterPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Kendi grafiğini oluştur</option>
            </select>
          </label>
          {active.id === "balance" && preset !== "custom" && (
            <label>
              Bölge
              <select value={zone} onChange={(e) => setZone(e.target.value)}>
                <option value="all">Tüm bölgeler</option>
                <option value="Defense">Savunma</option>
                <option value="Midfield">Orta saha</option>
                <option value="Attack">Hücum</option>
              </select>
            </label>
          )}
          {preset === "custom" &&
            (["X", "Y"] as const).map((axis) => (
              <label key={axis}>
                {axis} metriği
                <select
                  value={axis === "X" ? customX : customY}
                  onChange={(e) => {
                    const id = metricIds.find((id) => id === e.target.value);
                    if (id) {
                      if (axis === "X") setCustomX(id);
                      else setCustomY(id);
                    }
                  }}
                >
                  {metricIds.map((id) => (
                    <option key={id} value={id}>
                      {metrics[id].label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
        <ScatterChart
          points={points}
          xLabel={metrics[xId].label + " · " + metricUnit(xId)}
          yLabel={metrics[yId].label + " · " + metricUnit(yId)}
          onSelect={onSelect}
          selected={selected}
          previous={previous}
        />
        <div className="analyticsLegend">
          {Object.entries(roles).map(([id, label]) => (
            <span key={id}>
              <i style={{ background: roleColors[id] }} />
              {id === "forward" ? "▲" : id === "defender" ? "■" : "●"} {label}
            </span>
          ))}
        </div>
      </ChartCard>
      <ChartCard
        title="Bireysel veriler"
        question="HANGİ SAYININ KAÇ GEÇERLİ KAYDI VAR?"
        note="İsim değişikliklerinde kayıtlar oyuncu ID’siyle birleşir. Maç başına payda her metriğin kendi geçerli oyuncu-maç sayısıdır."
      >
        <div className="tableWrap">
          <MetricTable
            players={report.players}
            ids={[
              "goals",
              "assists",
              "shots",
              "passRate",
              "forwardRate",
              "interceptions",
              "tackleRate",
              "losses",
              "rating",
            ]}
            mode={report.filters.mode}
            onPlayer={(id) => onSelect([id])}
          />
        </div>
      </ChartCard>
    </>
  );
}

function TeamView({
  report,
  matches,
  onMatch,
  onPlayer,
}: {
  report: AnalyticsReport;
  matches: Match[];
  onMatch: (id: string) => void;
  onPlayer: (id: string) => void;
}) {
  const [map, setMap] = useState("score"),
    [trend, setTrend] = useState("points"),
    [dist, setDist] = useState("results"),
    [overlaps, setOverlaps] = useState<string[]>([]);
  const points = report.trend.flatMap((row) => {
    const x =
      map === "score"
        ? row.goals
        : map === "shots"
          ? row.metrics.shots.total
          : map === "passing"
            ? row.metrics.passRate.value
            : row.metrics.lostDefense.total;
    const y =
      map === "score"
        ? row.conceded
        : map === "shots"
          ? row.goals
          : map === "passing"
            ? row.metrics.shots.total
            : row.conceded;
    return x === null || y === null
      ? []
      : [
          {
            id: row.matchId,
            label: row.date + " " + row.opponent,
            x,
            y,
            color:
              row.result === "G"
                ? "#8ac8a3"
                : row.result === "B"
                  ? "#daba80"
                  : "#dd9296",
            detail: `${row.date} ${row.opponent} ${row.goals}:${row.conceded} · X ${x} / Y ${y}; insan şut/pas/olay kapsamı ${row.metrics.shots.covered}/${row.metrics.shots.available}`,
          },
        ];
  });
  const metricId = metricIds.find((id) => id === trend);
  const values = report.trend.map((row) =>
    trend === "points"
      ? row.points
      : trend === "goals"
        ? row.goals
        : trend === "conceded"
          ? row.conceded
          : trend === "difference"
            ? row.goals === null || row.conceded === null
              ? null
              : row.goals - row.conceded
            : metricId
              ? metrics[metricId].kind === "count"
                ? row.metrics[metricId].total
                : row.metrics[metricId].value
              : null,
  );
  const rolling =
    metricId && !["goals", "conceded"].includes(trend)
      ? rollingTrend(report.trend, metricId)
      : values.map((_, i) => {
          const valid = values
            .slice(Math.max(0, i - 4), i + 1)
            .filter((v): v is number => v !== null);
          return valid.length
            ? valid.reduce((a, b) => a + b, 0) / valid.length
            : null;
        });
  const rows = filterPlayerRows(matches, report.filters);
  let slices = [
    { label: "Galibiyet", value: report.team.wins, color: "#8ac8a3" },
    { label: "Beraberlik", value: report.team.draws, color: "#daba80" },
    { label: "Mağlubiyet", value: report.team.losses, color: "#dd9296" },
  ];
  if (dist === "losses" || dist === "wins")
    slices = (["Defense", "Midfield", "Attack"] as const).flatMap((zone, i) => {
      const id = ((dist === "losses" ? "lost" : "won") + zone) as MetricId,
        r = summarize(rows, id);
      return r.total === null
        ? []
        : [
            {
              label: ["Savunma", "Orta saha", "Hücum"][i],
              value: r.total,
              color: ["#87a9dc", "#85bda8", "#e8bc68"][i],
            },
          ];
    });
  if (dist === "goals") {
    const players = report.players
      .filter((p) => p.metrics.goals.total !== null)
      .sort((a, b) => b.metrics.goals.total! - a.metrics.goals.total!);
    slices = players.slice(0, 4).map((p) => ({
      label: p.name,
      value: p.metrics.goals.total!,
      color: playerColor(p.id),
    }));
    const rest = players
      .slice(4)
      .reduce((a, p) => a + p.metrics.goals.total!, 0);
    if (rest)
      slices.push({ label: "Diğerleri", value: rest, color: "#999da7" });
  }
  if (dist === "passing") {
    const profile = passingProfile(rows, "direction");
    slices = profile.rows.flatMap((r, i) =>
      r.made === null || r.failed === null
        ? []
        : [
            {
              label: r.label,
              value: r.made + r.failed,
              color: ["#e8bc68", "#85bda8", "#87a9dc", "#999da7"][i],
            },
          ],
    );
  }
  return (
    <>
      <div className="analyticsMetricGrid summaryMetrics">
        {[
          ["Maç", report.team.matches, `${report.team.covered} geçerli skor`],
          [
            "Gol farkı",
            report.team.difference,
            `${numberLabel(report.team.goals)} atılan / ${numberLabel(report.team.conceded)} yenilen`,
          ],
          [
            "Puan / maç",
            report.team.pointsPerMatch,
            `Önceki: ${numberLabel(report.previousTeam.pointsPerMatch)}`,
          ],
          [
            "Pas başarısı",
            report.playerMetrics.passRate.value,
            `${report.playerMetrics.passRate.numerator ?? "—"} / ${report.playerMetrics.passRate.denominator ?? "—"} · insan kayıtları`,
          ],
        ].map(([label, value, note]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{numberLabel(value as number | null)}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="analyticsTwoCol">
        <ChartCard
          exportable
          title="Maç haritası"
          question="SONUÇ VE OYUN PROFİLİ NASIL DAĞILIYOR?"
          note="Renk: G/B/M; sonuç nokta etiketinde ve veri tablosunda da bulunur. İnsan şut/pas/olay toplamları AI dahil tam takım üretimi değildir. İlişki nedensellik göstermez."
          table={
            <table>
              <thead>
                <tr>
                  <th>Maç</th>
                  <th>Sonuç</th>
                  <th>X</th>
                  <th>Y</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button className="textBtn" onClick={() => onMatch(p.id)}>
                        {p.label}
                      </button>
                    </td>
                    <td>
                      {report.trend.find((m) => m.matchId === p.id)?.result ||
                        "Veri yok"}
                    </td>
                    <td>{numberLabel(p.x)}</td>
                    <td>{numberLabel(p.y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <label className="analysisSelect noPrint">
            Eksenler
            <select
              aria-label="Takım maç haritası"
              value={map}
              onChange={(e) => setMap(e.target.value)}
            >
              <option value="score">Atılan gol / yenilen gol</option>
              <option value="shots">İnsan oyuncu şutları / takım golü</option>
              <option value="passing">
                İnsan pas başarısı / insan şutları
              </option>
              <option value="losses">
                Savunma bölgesi kayıp / yenilen gol
              </option>
            </select>
          </label>
          <ScatterChart
            points={points}
            xLabel={
              map === "score"
                ? "Atılan gol"
                : map === "shots"
                  ? "İnsan şut toplamı"
                  : map === "passing"
                    ? "İnsan pas başarı %"
                    : "Savunma bölgesi kayıp"
            }
            yLabel={
              map === "score" || map === "losses"
                ? "Yenilen gol"
                : map === "passing"
                  ? "İnsan şut toplamı"
                  : "Atılan gol"
            }
            onSelect={(ids) =>
              ids.length === 1 ? onMatch(ids[0]) : setOverlaps(ids)
            }
          />
          {overlaps.length > 1 && (
            <div role="status">
              <p>Aynı koordinattaki maçlar:</p>
              <SourceMatches
                matches={matches.filter((m) =>
                  overlaps.includes(String(m.matchId)),
                )}
                onMatch={onMatch}
              />
            </div>
          )}
        </ChartCard>
        <ChartCard
          exportable
          title="Maçtan maça"
          question="OYUN NASIL DEĞİŞTİ?"
          note="Son 5 hareketli ortalama mevcut geçerli kapsamı kullanır. Oranlar ham pay/paydalardan havuzlanır; eksik maçta asıl çizgi kesilir. Pencere ve insan oyuncu kapsamı veri tablosunda görülebilir."
          table={
            <table>
              <thead>
                <tr>
                  <th>Maç</th>
                  <th>Değer</th>
                  <th>Son 5</th>
                  <th>Kapsam</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.map((m, i) => (
                  <tr key={m.matchId}>
                    <td>
                      <button onClick={() => onMatch(m.matchId)}>
                        {m.date} {m.opponent}
                      </button>
                    </td>
                    <td>{numberLabel(values[i])}</td>
                    <td>{numberLabel(rolling[i])}</td>
                    <td>
                      {metricId
                        ? `${m.metrics[metricId].covered}/${m.metrics[metricId].available}`
                        : "Takım skoru"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <label className="analysisSelect noPrint">
            Eğilim
            <select
              aria-label="Takım eğilim metriği"
              value={trend}
              onChange={(e) => setTrend(e.target.value)}
            >
              <option value="points">Puan / maç (3/1/0)</option>
              <option value="goals">Atılan gol</option>
              <option value="conceded">Yenilen gol</option>
              <option value="difference">Gol farkı</option>
              {(
                [
                  "passRate",
                  "accuracy",
                  "conversion",
                  "losses",
                  "wins",
                  "lostDefense",
                  "lostMidfield",
                  "lostAttack",
                  "wonDefense",
                  "wonMidfield",
                  "wonAttack",
                ] as MetricId[]
              ).map((id) => (
                <option key={id} value={id}>
                  {metrics[id].label}
                </option>
              ))}
            </select>
          </label>
          <TrendChart
            labels={report.trend.map((m) => m.date)}
            series={[
              { label: "Maç kaydı", color: "#e8bc68", values },
              { label: "Son 5 · hareketli", color: "#85bda8", values: rolling },
            ]}
            onSelect={(i) => onMatch(report.trend[i].matchId)}
          />
        </ChartCard>
      </div>
      <div className="analyticsTwoCol">
        <ChartCard
          exportable
          title="Dağılımlar"
          question="AYNI BÜTÜN NASIL PAYLAŞILIYOR?"
          note="Yalnız birbirini dışlayan kategoriler. Oyuncu golleri insan kayıtlarıdır, takım gol toplamı değildir. Pas dağılımında tutarsız satırlar dışlanır; gol+asist aynı bütünde toplanmaz."
          table={
            <table>
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Sayı</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((s) => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <select
            aria-label="Dağılım"
            value={dist}
            onChange={(e) => setDist(e.target.value)}
          >
            <option value="results">G / B / M</option>
            <option value="losses">Bölgesel top kaybı</option>
            <option value="wins">Bölgesel top kazanma</option>
            <option value="goals">Oyuncu golleri</option>
            <option value="passing">Doğrulanmış pas yönü</option>
          </select>
          <Distribution slices={slices} />
        </ChartCard>
        <ChartCard
          title="Sonuca göre oyun profili"
          question="G / B / M ÖRNEKLEMLERİ NE ANLATIYOR?"
          note="Şut ve savunma kaybı insan toplamı / bu metriği olan maçtır. Oranlar havuzlanır. Gruplar küçük veya farklı kadro/rakipteyse neden-sonuç yorumu yapılmaz."
        >
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Grup</th>
                  <th>Maç</th>
                  {(
                    [
                      "shots",
                      "accuracy",
                      "forwardRate",
                      "lostDefense",
                      "tackleRate",
                    ] as MetricId[]
                  ).map((id) => (
                    <th key={id}>{metrics[id].label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["G", "B", "M"].map((result) => {
                  const group = matches.filter(
                    (m) => matchInfo(m).result === result,
                  );
                  return (
                    <tr key={result}>
                      <th>{result}</th>
                      <td>{group.length}</td>
                      {(
                        [
                          "shots",
                          "accuracy",
                          "forwardRate",
                          "lostDefense",
                          "tackleRate",
                        ] as MetricId[]
                      ).map((id) => {
                        const r = summarize(
                          filterPlayerRows(group, report.filters),
                          id,
                        );
                        return (
                          <td key={id}>
                            {numberLabel(
                              metrics[id].kind === "count"
                                ? r.matchIds.length && r.total !== null
                                  ? r.total / r.matchIds.length
                                  : null
                                : r.value,
                            )}
                            <small>
                              {r.covered}/{r.available} kayıt ·{" "}
                              {r.matchIds.length} maç
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
      <ContributionShares report={report} onPlayer={onPlayer} />
      <PassProfile matches={matches} sample={rows} />
      <ZoneBalance matches={matches} sample={rows} onPlayer={onPlayer} />
      <ChartCard
        title="Kanıtlı denemeler"
        question="SONRAKİ SEANSTA NEYİ ÖLÇELİM?"
      >
        <EvidenceCards items={report.evidence} onMatch={onMatch} />
      </ChartCard>
    </>
  );
}

function ContributionShares({
  report,
  onPlayer,
}: {
  report: AnalyticsReport;
  onPlayer: (id: string) => void;
}) {
  return (
    <ChartCard
      title="Görev yükünün dağılımı"
      question="KATKI KİMLERE DAĞILIYOR?"
      note="Ayrı %100 çubuklar; aynı geçerli insan kayıtlarının toplamı kullanılır. Yüksek pay otomatik sorun değildir; oyuncu yokluğunun etkisi çıkarılmaz."
    >
      {(["goals", "assists", "forwardMade", "wins"] as MetricId[]).map((id) => {
        const eligible = report.players.filter(
            (p) => p.metrics[id].total !== null,
          ),
          total = eligible.reduce((a, p) => a + p.metrics[id].total!, 0),
          all = report.playerMetrics[id].total;
        return (
          <div className="contributionShare" key={id}>
            <div>
              <strong>{metrics[id].label}</strong>
              <span>
                {total} insan olayı · kapsam dışında{" "}
                {all === null ? "Veri yok" : all - total}
              </span>
            </div>
            <div className="shareTrack">
              {total > 0 &&
                eligible
                  .filter((p) => p.metrics[id].total! > 0)
                  .map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      style={{
                        width: `${(p.metrics[id].total! / total) * 100}%`,
                        background: playerColor(p.id),
                      }}
                      aria-label={`${p.name}: ${p.metrics[id].total}, yüzde ${numberLabel((p.metrics[id].total! / total) * 100)}`}
                      title={p.name}
                      onClick={() => onPlayer(p.id)}
                    >
                      {p.metrics[id].total! / total >= 0.12
                        ? p.name.slice(0, 9)
                        : ""}
                    </button>
                  ))}
            </div>
            {!total && (
              <p className="quiet">
                {eligible.length
                  ? "Gözlenen toplam 0; yüzdeler tanımsız."
                  : "Veri yok."}
              </p>
            )}
            <div className="analyticsLegend">
              {eligible.map((p) => (
                <button type="button" key={p.id} onClick={() => onPlayer(p.id)}>
                  <i style={{ background: playerColor(p.id) }} />
                  {p.name}: {p.metrics[id].total}{" "}
                  {total
                    ? `(%${numberLabel((p.metrics[id].total! / total) * 100, 1)})`
                    : ""}{" "}
                  · {p.metrics[id].covered}/{p.metrics[id].available}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </ChartCard>
  );
}

function SessionView({
  all,
  filters,
  report,
  onMatch,
  update,
  journal,
}: {
  all: Match[];
  filters: AnalyticsFilters;
  report: AnalyticsReport;
  onMatch: (id: string) => void;
  update: (patch: Partial<AnalyticsFilters>) => void;
  journal: Journal;
}) {
  const sessions = groupSessions(all, filters.gapMinutes),
    session = sessions.find((s) => s.key === filters.key) || sessions[0];
  if (filters.scope !== "session")
    return (
      <section className="panel">
        <h3>Maç gecesi raporu</h3>
        <p>
          Gece yarısını aşan maçlar aynı seans içinde kalır. Aradaki en fazla{" "}
          {filters.gapMinutes} dakikalık boşlukla gruplanır.
        </p>
        <div className="sourceLinks">
          {sessions.map((s) => (
            <button
              key={s.key}
              onClick={() => update({ scope: "session", key: s.key })}
            >
              {s.label} · {s.matches.length} maç
            </button>
          ))}
        </div>
      </section>
    );
  const chronological = [...report.trend],
    half = Math.ceil(chronological.length / 2),
    current = report.players;
  const parts = [chronological.slice(0, half), chronological.slice(half)];
  return (
    <>
      <ChartCard
        exportable
        title="Gecenin akışı"
        question="SEANSIN İLK VE SON BÖLÜMÜ NASILDI?"
        note="Maç sırası zaman eksenidir. Değişiklikler otomatik yorgunluk/moral/tilt olarak yorumlanmaz. Tek maçta ikinci bölüm veya değişim sonucu üretilmez."
        table={
          <table>
            <thead>
              <tr>
                <th>Bölüm</th>
                <th>Maç</th>
                <th>Puan / maç</th>
                <th>Gol farkı / maç</th>
                <th>Pas %</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, i) => {
                const scored = part.filter((m) => m.points !== null);
                const n = part.reduce(
                    (a, m) => a + (m.metrics.passRate.numerator || 0),
                    0,
                  ),
                  d = part.reduce(
                    (a, m) => a + (m.metrics.passRate.denominator || 0),
                    0,
                  );
                return (
                  <tr key={i}>
                    <th>{i ? "Son bölüm" : "İlk bölüm"}</th>
                    <td>{part.length}</td>
                    <td>
                      {numberLabel(
                        scored.length
                          ? scored.reduce((a, m) => a + m.points!, 0) /
                              scored.length
                          : null,
                      )}
                    </td>
                    <td>
                      {numberLabel(
                        scored.length
                          ? scored.reduce(
                              (a, m) => a + m.goals! - m.conceded!,
                              0,
                            ) / scored.length
                          : null,
                      )}
                    </td>
                    <td>{numberLabel(d ? (n / d) * 100 : null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        }
      >
        <h4>{session?.label}</h4>
        <p>
          {report.team.wins} G / {report.team.draws} B / {report.team.losses} M
          · Gol farkı {numberLabel(report.team.difference)} ·{" "}
          {numberLabel(report.team.pointsPerMatch)} puan/maç · önceki seans{" "}
          {numberLabel(report.previousTeam.pointsPerMatch)}
        </p>
        <TrendChart
          labels={chronological.map((_, i) => `${i + 1}. maç`)}
          series={[
            {
              label: "Puan (3/1/0)",
              color: "#daba80",
              values: chronological.map((m) => m.points),
            },
          ]}
          onSelect={(i) => onMatch(chronological[i].matchId)}
        />
      </ChartCard>
      <ChartCard title="Seans katkıları" question="KİM HANGİ GÖREVİ ÜSTLENDİ?">
        <div className="tableWrap">
          <MetricTable
            players={current}
            ids={[
              "goals",
              "assists",
              "passRate",
              "interceptions",
              "wins",
              "lostDefense",
            ]}
            mode={filters.mode}
          />
        </div>
      </ChartCard>
      <SourceMatches
        matches={all.filter((m) => report.matchIds.includes(String(m.matchId)))}
        onMatch={onMatch}
      />
      <EvidenceCards items={report.evidence} onMatch={onMatch} />
      {session && (
        <JournalEditor
          key={"session:" + session.key}
          entity={"session:" + session.key}
          journal={journal}
        />
      )}
    </>
  );
}

function CompareView({
  report,
  matches,
  onPlayer,
  onMatch,
  initialIds = [],
}: {
  report: AnalyticsReport;
  matches: Match[];
  initialIds?: string[];
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
}) {
  const [ids, setIds] = useState<string[]>(initialIds),
    [common, setCommon] = useState(false),
    [metric, setMetric] = useState<MetricId>("rating");
  const chosen = (
    ids.length ? ids : report.players.slice(0, 2).map((p) => p.id)
  ).slice(0, 3);
  const sample = common
    ? matches.filter((m) =>
        chosen.every((id) => playerRows([m]).some((r) => r.playerId === id)),
      )
    : matches;
  const players = playerSummaries(sample, {
    ...report.filters,
    minMatches: 1,
  })
    .filter((p) => chosen.includes(p.id))
    .map((p) => ({
      ...p,
      roles:
        report.players.find((identity) => identity.id === p.id)?.roles ||
        p.roles,
    }));
  const radarMetrics: MetricId[] = [
    "goals",
    "assists",
    "shots",
    "passRate",
    "interceptions",
    "tackleRate",
  ];
  const cohort = playerSummaries(sample, {
    ...report.filters,
    playerIds: [],
    minMatches: 1,
  }).map((p) => ({
    ...p,
    roles:
      report.players.find((identity) => identity.id === p.id)?.roles || p.roles,
  }));
  const radar =
    players.length === 2 && players[0].role === players[1].role
      ? players.map((p) =>
          radarMetrics.map((id) => rolePercentile(cohort, p, id)),
        )
      : [];
  const validRadar =
    radar.length === 2 && radar.every((row) => row.every(Boolean));
  return (
    <>
      <div className="analyticsFilters noPrint">
        <label>
          En fazla 3 oyuncu
          <select
            aria-label="Karşılaştırılan oyuncular"
            multiple
            value={chosen}
            onChange={(e) =>
              setIds(
                [...e.target.selectedOptions].map((o) => o.value).slice(0, 3),
              )
            }
          >
            {report.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="commonToggle">
          <input
            type="checkbox"
            checked={common}
            onChange={(e) => setCommon(e.target.checked)}
          />
          Ortak oynanan maçlar
        </label>
      </div>
      <ChartCard
        exportable
        title="İki noktalı karşılaştırma"
        question="AYNI ÖLÇEKTE NE FARKLI?"
        note="Her satır kendi metriğinin gerçek ölçeğidir. Oranlar pay/payda; sayımlar seçili toplam/maç başına görünümüdür. İlk iki oyuncu kullanılır."
        table={
          <MetricTable
            players={players.slice(0, 2)}
            ids={radarMetrics}
            mode={report.filters.mode}
            onPlayer={onPlayer}
          />
        }
      >
        {players.length >= 2 ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              data-chart="true"
              viewBox="0 0 600 360"
              width="600"
              height="360"
              className="analyticsSvg"
              role="img"
              aria-label="İki oyuncunun ayrı metrik ölçeklerindeki gerçek değerleri"
            >
              <rect width="600" height="360" fill="#141518" />
              {radarMetrics.map((id, i) => {
                const a = displayValue(
                    players[0].metrics[id],
                    id,
                    report.filters.mode,
                  ),
                  b = displayValue(
                    players[1].metrics[id],
                    id,
                    report.filters.mode,
                  ),
                  max = Math.max(1, a || 0, b || 0),
                  y = 40 + i * 49;
                return (
                  <g key={id}>
                    <text x="12" y={y} fill="#c4c6cc" fontSize="11">
                      {metrics[id].label}
                    </text>
                    <line
                      x1="210"
                      x2="570"
                      y1={y - 4}
                      y2={y - 4}
                      stroke="#ffffff22"
                    />
                    {a !== null && (
                      <circle
                        cx={210 + (a / max) * 360}
                        cy={y - 4}
                        r="6"
                        fill="#e8bc68"
                      />
                    )}
                    {b !== null && (
                      <rect
                        x={205 + (b / max) * 360}
                        y={y - 9}
                        width="10"
                        height="10"
                        fill="#87a9dc"
                      />
                    )}
                    <text x="210" y={y + 17} fill="#a8adb8" fontSize="10">
                      {numberLabel(a)} / {numberLabel(b)} · fark{" "}
                      {numberLabel(a === null || b === null ? null : a - b)}{" "}
                      {metricUnit(id, report.filters.mode)}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className="analyticsLegend">
              ● {players[0].name} · ■ {players[1].name}
            </p>
          </>
        ) : (
          <p className="empty">İki oyuncunun bu örneklemde kaydı gerekir.</p>
        )}
      </ChartCard>
      <ChartCard
        exportable
        title="Rol içi radar"
        question="BENZER ROL KOHORTUNA GÖRE PROFİL NEREDE?"
        note="Yüzdelik yöntemi: bağlar için orta sıra, 0–100. Aynı EA rolünde en az 5 oyuncu ve her eksende en az 3 geçerli maç; rol değişimi olan oyuncuda radar yok. Aynı altı eksen; birleşik kalite puanı üretilmez."
      >
        {validRadar ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              data-chart="true"
              viewBox="0 0 600 360"
              width="600"
              height="360"
              className="analyticsSvg"
              role="img"
              aria-label="Rol içi yüzdelik radar"
            >
              <rect width="600" height="360" fill="#141518" />
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <polygon
                  key={f}
                  points={radarMetrics
                    .map(
                      (_, i) =>
                        `${300 + 120 * f * Math.cos((i * Math.PI) / 3 - Math.PI / 2)},${175 + 120 * f * Math.sin((i * Math.PI) / 3 - Math.PI / 2)}`,
                    )
                    .join(" ")}
                  stroke="#ffffff22"
                  fill="none"
                />
              ))}
              {radarMetrics.map((id, i) => (
                <text
                  key={id}
                  x={300 + 140 * Math.cos((i * Math.PI) / 3 - Math.PI / 2)}
                  y={180 + 140 * Math.sin((i * Math.PI) / 3 - Math.PI / 2)}
                  fill="#bbbfc8"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {metrics[id].label}
                </text>
              ))}
              {radar.map((row, index) => (
                <polygon
                  key={index}
                  points={row
                    .map(
                      (r, i) =>
                        `${300 + ((120 * r!.value) / 100) * Math.cos((i * Math.PI) / 3 - Math.PI / 2)},${175 + ((120 * r!.value) / 100) * Math.sin((i * Math.PI) / 3 - Math.PI / 2)}`,
                    )
                    .join(" ")}
                  stroke={index ? "#87a9dc" : "#e8bc68"}
                  fill={index ? "#87a9dc22" : "#e8bc6822"}
                  strokeDasharray={index ? "5 3" : undefined}
                />
              ))}
            </svg>
            <p>
              {players
                .slice(0, 2)
                .map(
                  (p, i) =>
                    `${p.name}: ${roles[p.role]}, eksen kohortları ${radar[i].map((r) => r!.size).join("/")}`,
                )
                .join(" · ")}
            </p>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Metrik</th>
                    {players.slice(0, 2).map((p) => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {radarMetrics.map((id, i) => (
                    <tr key={id}>
                      <td>{metrics[id].label}</td>
                      {radar.map((row, j) => (
                        <td key={j}>
                          {numberLabel(row[i]!.value)}. yüzdelik · N=
                          {row[i]!.size}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="empty">
            Ortak rol ve yeterli kohort yok; yanıltıcı yüzdelik yerine
            yukarıdaki ham değerli karşılaştırmayı kullan.
          </p>
        )}
      </ChartCard>
      <ChartCard
        exportable
        title="Ortak zaman çizgisi"
        question="FORM AYNI MAÇ EKSENİNDE NASILDI?"
        note="En fazla üç oyuncu. Oynamadı/eksik veri null olduğunda çizgi kesilir; sıfıra indirilmez."
      >
        <select
          aria-label="Oyuncu çizgisi metriği"
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricId)}
        >
          {(
            [
              "rating",
              "goals",
              "contributions",
              "passRate",
              "interceptions",
              "losses",
              "tackleRate",
            ] as MetricId[]
          ).map((id) => (
            <option key={id} value={id}>
              {metrics[id].label}
            </option>
          ))}
        </select>
        <TrendChart
          labels={[...sample].reverse().map((m) => matchInfo(m).date)}
          series={players.slice(0, 3).map((p) => ({
            label: p.name,
            color: playerColor(p.id),
            values: [...sample].reverse().map(
              (m) =>
                summarize(
                  playerRows([m]).filter(
                    (r) =>
                      r.playerId === p.id &&
                      (report.filters.role === "all" ||
                        r.role === report.filters.role),
                  ),
                  metric,
                ).value,
            ),
          }))}
          onSelect={(i) => onMatch([...sample].reverse()[i].matchId)}
        />
      </ChartCard>
    </>
  );
}

function MatrixView({
  report,
  matches,
  onSelect,
}: {
  report: AnalyticsReport;
  matches: Match[];
  onSelect: (playerId: string, matchId: string) => void;
}) {
  const [metric, setMetric] = useState<MetricId>("rating"),
    [sort, setSort] = useState("name"),
    [cell, setCell] = useState<{ playerId: string; matchId: string } | null>(
      null,
    );
  const rows = playerRows(matches),
    chronological = [...matches].reverse(),
    players = [...report.players].sort((a, b) =>
      sort === "value"
        ? (b.metrics[metric].value ?? -Infinity) -
          (a.metrics[metric].value ?? -Infinity)
        : a.name.localeCompare(b.name, "tr"),
    );
  const values = rows
      .map((r) => summarize([r], metric).value)
      .filter((v): v is number => v !== null),
    max = Math.max(1, ...values);
  return (
    <ChartCard
      title="Oyuncu × maç matrisi"
      question="HANGİ KAYITTA NE GÖRÜLDÜ?"
      note="— Oynamadı/rol filtresi dışında · Veri yok: satır var, metrik yok · 0: gerçek sıfır. Renk yoğunluğu yalnız büyüklük; top kaybında yüksek değer iyi değildir. Mobilde tablo yatay kaydırılır."
    >
      <div className="analyticsFilters noPrint">
        <label>
          Metrik
          <select
            aria-label="Matris metriği"
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricId)}
          >
            {(
              [
                "rating",
                "contributions",
                "passRate",
                "interceptions",
                "losses",
                "tackleRate",
              ] as MetricId[]
            ).map((id) => (
              <option key={id} value={id}>
                {metrics[id].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sıralama
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">İsim</option>
            <option value="value">Metrik değeri</option>
          </select>
        </label>
      </div>
      <div
        className="tableWrap matrixScroll"
        tabIndex={0}
        aria-label="Yatay kaydırılabilir oyuncu maç matrisi"
      >
        <table>
          <thead>
            <tr>
              <th>Oyuncu</th>
              {chronological.map((m, i) => (
                <th key={m.matchId}>
                  {i + 1}. maç
                  <small>
                    {matchInfo(m).date}
                    <br />
                    {matchInfo(m).opponent}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <th>{p.name}</th>
                {chronological.map((m) => {
                  const sample = rows.filter(
                      (r) =>
                        r.playerId === p.id &&
                        r.matchId === String(m.matchId) &&
                        (report.filters.role === "all" ||
                          r.role === report.filters.role),
                    ),
                    r = summarize(sample, metric);
                  return (
                    <td key={m.matchId}>
                      <button
                        type="button"
                        disabled={!sample.length}
                        style={{
                          background:
                            r.value === null
                              ? undefined
                              : `rgba(218,186,128,${0.06 + (r.value / max) * 0.4})`,
                        }}
                        onClick={() =>
                          setCell({
                            playerId: p.id,
                            matchId: String(m.matchId),
                          })
                        }
                        aria-label={`${p.name}, ${matchInfo(m).date}, ${metrics[metric].label}: ${sample.length ? numberLabel(r.value) : "Oynamadı veya filtre dışında"}`}
                      >
                        {sample.length ? numberLabel(r.value) : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cell && (
        <section aria-label="Oyuncu maç hücresi" className="analyticsAdvanced">
          <h4>
            {players.find((p) => p.id === cell.playerId)?.name} · #
            {cell.matchId}
          </h4>
          <p>
            {metrics[metric].label}:{" "}
            {numberLabel(
              summarize(
                rows.filter(
                  (r) =>
                    r.playerId === cell.playerId && r.matchId === cell.matchId,
                ),
                metric,
              ).value,
            )}
          </p>
          <p>
            {metrics[metric].source.join(", ")} · {metrics[metric].formula}
          </p>
          <details>
            <summary>Asıl oyuncu-maç JSON kaydı</summary>
            <pre>
              {JSON.stringify(
                rows.find(
                  (r) =>
                    r.playerId === cell.playerId && r.matchId === cell.matchId,
                )?.raw,
                null,
                2,
              )}
            </pre>
          </details>
          <button
            type="button"
            className="textBtn"
            onClick={() => onSelect(cell.playerId, cell.matchId)}
          >
            Tam maç raporunu aç
          </button>
          <button
            type="button"
            className="textBtn"
            onClick={() => setCell(null)}
          >
            Hücre detayını kapat
          </button>
        </section>
      )}
    </ChartCard>
  );
}

function PairsView({
  matches,
  filters,
  onMatch,
}: {
  matches: Match[];
  filters: AnalyticsFilters;
  onMatch: (id: string) => void;
}) {
  const pairs = pairSummaries(matches, filters),
    players = playerSummaries(matches, { ...filters, minMatches: 1 }),
    [selected, setSelected] = useState<string>("");
  const detail = pairs.find((p) => p.a.id + ":" + p.b.id === selected);
  return (
    <ChartCard
      title="Birlikte oynama"
      question="AYNI KADRODAKİ ÖRNEKLEM NE GÖSTERİYOR?"
      note={`Minimum ${filters.minMatches} ortak maç. Az örneklemde sıralama veya en iyi ikili hükmü yok. Aynı maçta bulunmak pas bağlantısı/kanıtlanmış uyum değildir; rakip, kadro ve rol etkisi ayrıştırılmaz.`}
    >
      <div className="tableWrap matrixScroll" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Oyuncu</th>
              {players.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((a) => (
              <tr key={a.id}>
                <th>{a.name}</th>
                {players.map((b) => {
                  const pair = pairs.find(
                    (p) =>
                      (p.a.id === a.id && p.b.id === b.id) ||
                      (p.a.id === b.id && p.b.id === a.id),
                  );
                  return (
                    <td key={b.id}>
                      {pair ? (
                        <button
                          onClick={() =>
                            setSelected(pair.a.id + ":" + pair.b.id)
                          }
                        >
                          {pair.matches} maç
                          <small>
                            {pair.sufficient
                              ? numberLabel(pair.pointsPerMatch) + " puan/maç"
                              : "Az örneklem"}
                          </small>
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <div role="status">
          <h4>
            {detail.a.name} + {detail.b.name}
          </h4>
          <p>
            {detail.matches} ortak maç · {numberLabel(detail.pointsPerMatch)}{" "}
            puan/maç · {numberLabel(detail.goals)}:
            {numberLabel(detail.conceded)} gol ·{" "}
            {numberLabel(
              detail.difference === null || !detail.covered
                ? null
                : detail.difference / detail.covered,
            )}{" "}
            gol farkı/maç
          </p>
          <SourceMatches
            matches={matches.filter((m) =>
              detail.matchIds.includes(String(m.matchId)),
            )}
            onMatch={onMatch}
          />
        </div>
      )}
    </ChartCard>
  );
}

function DevelopmentView({
  report,
  matches,
  all,
  journal,
  onMatch,
  initialId = "",
}: {
  report: AnalyticsReport;
  matches: Match[];
  all: Match[];
  journal: Journal;
  initialId?: string;
  onMatch: (id: string) => void;
}) {
  const [id, setId] = useState(initialId);
  const player = report.players.find((p) => p.id === id) || report.players[0];
  if (!player) return <p className="empty">Bu örneklemde oyuncu kaydı yok.</p>;
  const prior = report.previousPlayers.find((p) => p.id === player.id),
    ordered = [...matches].reverse(),
    rows = playerRows(matches).filter(
      (r) =>
        r.playerId === player.id &&
        (report.filters.role === "all" || r.role === report.filters.role),
    ),
    priorMatches = all.filter((m) =>
      report.previousMatchIds.includes(String(m.matchId)),
    ),
    previousRows = playerRows(priorMatches).filter(
      (r) =>
        r.playerId === player.id &&
        (report.filters.role === "all" || r.role === report.filters.role),
    );
  const ids: MetricId[] =
    player.role === "defender" || player.role === "midfielder"
      ? [
          "passRate",
          "interceptions",
          "wins",
          "tackleRate",
          "lostDefense",
          "forwardRate",
        ]
      : player.role === "goalkeeper"
        ? ["saves", "passRate", "losses", "rating"]
        : ["goals", "assists", "shots", "conversion", "passRate", "losses"];
  const findings = evidenceFor(matches, priorMatches, rows, previousRows);
  return (
    <>
      <label className="formLabel noPrint">
        Oyuncu gelişimi
        <select
          aria-label="Gelişim oyuncusu"
          value={player.id}
          onChange={(e) => setId(e.target.value)}
        >
          {report.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <ChartCard
        title={player.name + " · gelişim"}
        question="AYNI TANIMLA İKİ DÖNEM NASIL FARKLI?"
        note={`EA rolü: ${player.roles.map((r) => roles[r]).join(" / ")}. Önceki roller: ${prior?.roles.map((r) => roles[r]).join(" / ") || "Veri yok"}. Ad değişiklikleri: ${player.aliases.join(" / ")}. Rol/kadro/rakip etkileri ayrı değerlendirilmelidir.`}
      >
        <ComparisonBars
          left="Mevcut"
          right="Önceki"
          rows={ids.map((id) => ({
            label: metrics[id].label,
            a: displayValue(player.metrics[id], id, "perMatch"),
            b: prior ? displayValue(prior.metrics[id], id, "perMatch") : null,
            unit: metrics[id].kind === "rate" ? "%" : "",
          }))}
        />
        <div className="tableWrap">
          <MetricTable
            players={[player, ...(prior ? [prior] : [])]}
            ids={ids}
            mode="perMatch"
          />
        </div>
      </ChartCard>
      <ChartCard
        exportable
        title="Form çizgisi"
        question="PUANLAR NASIL DEĞİŞTİ?"
        note="EA puanı performansın tek ölçüsü değildir. Eksik veya oynanmayan maçlarda çizgi kesilir."
      >
        <TrendChart
          labels={ordered.map((m) => matchInfo(m).date)}
          series={[
            {
              label: player.name,
              color: playerColor(player.id),
              values: ordered.map(
                (m) =>
                  summarize(
                    rows.filter((r) => r.matchId === String(m.matchId)),
                    "rating",
                  ).value,
              ),
            },
          ]}
          onSelect={(i) => onMatch(ordered[i].matchId)}
        />
      </ChartCard>
      <PlayerMaps
        report={report}
        selected={player.id}
        onSelect={(ids) => {
          if (ids[0]) setId(ids[0]);
        }}
      />
      <ChartCard
        title="Güçlü bulgu ve deneme hedefi"
        question="SONRAKİ SEANSTA NEYİ SINAYALIM?"
      >
        <EvidenceCards items={findings} onMatch={onMatch} />
        <p className="bodyText">
          Ölçülebilir deneme: {metrics[ids[0]].label} mevcut{" "}
          {numberLabel(
            displayValue(player.metrics[ids[0]], ids[0], "perMatch"),
          )}{" "}
          ({player.metrics[ids[0]].covered}/{player.metrics[ids[0]].available}).
          Sonraki seansı aynı rol/kapsamda bununla karşılaştır; eksik veri varsa
          hedef sonucu üretme.
        </p>
      </ChartCard>
      <JournalEditor
        key={"player:" + player.id}
        entity={"player:" + player.id}
        journal={journal}
      />
    </>
  );
}

export function AnalyticsComparison({
  matches,
  leftName,
  rightName,
  onMatch,
}: {
  matches: Match[];
  leftName: string;
  rightName: string;
  onMatch: (id: string) => void;
}) {
  const report = useMemo(
    () => buildAnalyticsReport(matches, defaultFilters, ""),
    [matches],
  );
  const ids = [leftName, rightName].flatMap((name) => {
    const p = report.players.find((p) => p.aliases.includes(name));
    return p ? [p.id] : [];
  });
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <section className="analyticsDashboard">
      <h3>Kayıtlı maçlardan görsel karşılaştırma</h3>
      <p className="footnote">
        Kulüp kariyer toplamlarından bağımsızdır. Ortak maç, ham değer ve rol
        kohortu kapsamı kullanılır.
      </p>
      <CompareView
        key={ids.join(":")}
        initialIds={ids}
        report={report}
        matches={matches}
        onPlayer={(id) => setSelected([id])}
        onMatch={onMatch}
      />
      {selected.length > 0 && (
        <PlayerDrawer
          players={report.players.filter((p) => selected.includes(p.id))}
          allPlayers={report.players}
          report={report}
          matches={matches}
          onClose={() => setSelected([])}
          onSelect={(id) => setSelected([id])}
          onMatch={onMatch}
          journal={{}}
        />
      )}
    </section>
  );
}

export function AnalyticsPlayerDevelopment({
  matches,
  name,
  onMatch,
}: {
  matches: Match[];
  name: string;
  onMatch: (id: string) => void;
}) {
  const allPlayers = playerSummaries(matches, defaultFilters),
    player = allPlayers.find((p) => p.aliases.includes(name));
  const journalRaw = useSyncExternalStore(
      subscribeJournal,
      readJournal,
      () => emptyJournal,
    ),
    journal = useMemo(() => parseJournal(journalRaw), [journalRaw]);
  if (!player)
    return (
      <p className="footnote">
        Bu oyuncuyla eşleşen kayıtlı maç kimliği henüz yok.
      </p>
    );
  const filters = {
    ...defaultFilters,
    scope: "last5" as const,
    playerIds: [player.id],
    view: "development" as const,
  };
  const report = buildAnalyticsReport(matches, filters, "", journal),
    pool = matches.filter((m) => report.matchIds.includes(String(m.matchId)));
  return (
    <details className="analyticsAdvanced">
      <summary>Oyuncu gelişimi · son 5 / önceki 5 uygun maç</summary>
      <div className="analyticsDashboard">
        <DevelopmentView
          initialId={player.id}
          report={report}
          matches={pool}
          all={matches}
          journal={journal}
          onMatch={onMatch}
        />
      </div>
    </details>
  );
}

export function NightPerformance({
  matches,
  day,
  onMatch,
}: {
  matches: Match[];
  day: string;
  onMatch: (id: string) => void;
}) {
  const sessions = groupSessions(matches).filter((s) =>
      s.matches.some((m) => matchInfo(m).date === day),
    ),
    [chosen, setChosen] = useState("");
  const session = sessions.find((s) => s.key === chosen) || sessions[0];
  const journalRaw = useSyncExternalStore(
      subscribeJournal,
      readJournal,
      () => emptyJournal,
    ),
    journal = useMemo(() => parseJournal(journalRaw), [journalRaw]);
  if (!session)
    return (
      <p className="footnote">
        Seçili tarihte henüz arşivlenmiş seans yok. Katılım beyanları performans
        verisi değildir.
      </p>
    );
  const filters = {
    ...defaultFilters,
    scope: "session" as const,
    key: session.key,
    view: "session" as const,
  };
  const report = buildAnalyticsReport(matches, filters, "", journal);
  return (
    <section className="analyticsDashboard">
      <h3>Maç gecesi · performans</h3>
      {sessions.length > 1 && (
        <label className="formLabel">
          Seans
          <select
            value={session.key}
            onChange={(e) => setChosen(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <SessionView
        all={matches}
        filters={filters}
        report={report}
        onMatch={onMatch}
        update={() => {}}
        journal={journal}
      />
    </section>
  );
}

function PlayerDrawer({
  players,
  allPlayers,
  report,
  matches,
  onClose,
  onSelect,
  onMatch,
  journal,
}: {
  players: PlayerSummary[];
  allPlayers: PlayerSummary[];
  report: AnalyticsReport;
  matches: Match[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onMatch: (id: string) => void;
  journal: Journal;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const controls = ref.current?.querySelectorAll<HTMLElement>(
          "button,select,input,textarea,summary",
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [onClose]);
  return (
    <div className="modalBackdrop drawerBackdrop noPrint" onClick={onClose}>
      <section
        className="modal playerModal analyticsPlayerDrawer"
        role="dialog"
        aria-modal="true"
        aria-label="Analiz oyuncu detayı"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close"
          aria-label="Analiz detayını kapat"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <p className="eyebrow">
          KOORDİNATLARI AYNI OLAN OYUNCULAR / KAYIT DETAYI
        </p>
        {players.length > 1 && (
          <div className="sourceLinks">
            {players.map((p) => (
              <button key={p.id} onClick={() => onSelect(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        {players.map((p) => (
          <article key={p.id}>
            <h3>{p.name}</h3>
            <p>
              #{p.id} · {p.roles.map((r) => roles[r]).join(" / ")} · {p.matches}{" "}
              maç
            </p>
            <p className="footnote">
              İsim geçmişi:{" "}
              {allPlayers.find((a) => a.id === p.id)?.aliases.join(" / ") ||
                p.name}
              . Önceki EA roller:{" "}
              {report.previousPlayers
                .find((a) => a.id === p.id)
                ?.roles.map((r) => roles[r])
                .join(" / ") || "Veri yok"}
              .
            </p>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Metrik</th>
                    <th>Mevcut</th>
                    <th>Önceki / fark</th>
                    <th>Pay / payda ve kapsam</th>
                  </tr>
                </thead>
                <tbody>
                  {metricIds.map((id) => {
                    const r = p.metrics[id],
                      previous = report.previousPlayers.find(
                        (a) => a.id === p.id,
                      )?.metrics[id],
                      value = displayValue(r, id, "perMatch"),
                      old = previous
                        ? displayValue(previous, id, "perMatch")
                        : null;
                    return (
                      <tr key={id}>
                        <th>
                          {metrics[id].label}
                          <small>{metricUnit(id)}</small>
                        </th>
                        <td>{numberLabel(value)}</td>
                        <td>
                          {numberLabel(old)} /{" "}
                          {numberLabel(
                            value === null || old === null ? null : value - old,
                          )}
                        </td>
                        <td>
                          {r.numerator ?? r.total ?? "—"} /{" "}
                          {r.denominator ?? r.covered} · {r.covered}/
                          {r.available}
                          <small>
                            Önceki {previous?.covered ?? 0}/
                            {previous?.available ?? 0}
                          </small>
                          <div className="sourceLinks">
                            {r.matchIds.map((matchId) => (
                              <button
                                key={matchId}
                                onClick={() => {
                                  onClose();
                                  onMatch(matchId);
                                }}
                              >
                                #{matchId.slice(-6)}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <SourceMatches
              matches={matches.filter((m) =>
                playerRows([m]).some((r) => r.playerId === p.id),
              )}
              onMatch={(id) => {
                onClose();
                onMatch(id);
              }}
            />
            <JournalEditor entity={"player:" + p.id} journal={journal} />
          </article>
        ))}
        {!players.length && (
          <p className="empty">
            Oyuncu mevcut filtrelerin dışında. Filtreleri genişletebilirsin.
          </p>
        )}
      </section>
    </div>
  );
}
