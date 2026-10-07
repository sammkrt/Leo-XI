"use client";
import { useState } from "react";
import {
  ChartCard,
  ComparisonBars,
  ScatterChart,
  TrendChart,
  numberLabel,
} from "./analytics-charts";
import {
  defaultFilters,
  buildAnalyticsReport,
  metrics,
  metricIds,
  playerRows,
  summarize,
  passingProfile,
  roleColors,
  roles,
  evidenceFor,
  displayValue,
  matchInfo,
  playerSummaries,
  median,
  matchEvidence,
  teamMetricDictionary,
} from "../lib/club-analytics";
import type {
  AnalyticsReport,
  MetricId,
  PlayerRow,
} from "../lib/club-analytics";
import type { Match } from "../lib/club-types";

export function EvidenceCards({
  items,
  onMatch,
  emptyMessage = "Kanıtlı dönem yorumu için her iki dönemde en az iki farklı maç ve üç geçerli oyuncu-maç kaydı gerekir. Eksik geçmişten öneri üretilmez.",
}: {
  items: ReturnType<typeof evidenceFor>;
  onMatch: (id: string) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="evidenceGrid">
      {items.length ? (
        items.map((item) => (
          <article key={item.track}>
            <p className="eyebrow">KANIT → DENEME</p>
            <h4>{item.observation}</h4>
            <p>
              <strong>Kanıt:</strong> {item.evidence}
            </p>
            <p>
              <strong>Olası açıklama:</strong> {item.explanation}
            </p>
            <p>
              <strong>Deneme:</strong> {item.experiment}
            </p>
            <p>
              <strong>İzlenecek metrik:</strong> {metrics[item.track].label};
              sonraki seansta mevcut değerle karşılaştırın.
            </p>
            <small>{item.sample}</small>
            <div className="sourceLinks">
              {item.matchIds.map((id) => (
                <button type="button" key={id} onClick={() => onMatch(id)}>
                  #{id.slice(-6)}
                </button>
              ))}
            </div>
          </article>
        ))
      ) : (
        <p className="empty">{emptyMessage}</p>
      )}
    </div>
  );
}
export function PassProfile({
  matches,
  teamId = "79638",
  sample,
}: {
  matches: Match[];
  teamId?: string;
  sample?: PlayerRow[];
}) {
  const [percent, setPercent] = useState(false),
    rows = sample || playerRows(matches, teamId);
  return (
    <ChartCard
      title="Pas karakteri"
      question="TOP NASIL İLERLETİLDİ?"
      note="Yön ve uzunluk ayrı sınıflamalardır; birlikte toplanmaz. Sınıflama toplamı olay pas toplamını aşan satırlar dışlanır. İnsan oyuncu olay kayıtlarıdır; standart EA pas tablosundan farklı kapsamı olabilir."
    >
      <div className="segmented noPrint">
        <button
          className={!percent ? "chosen" : ""}
          onClick={() => setPercent(false)}
        >
          Sayı
        </button>
        <button
          className={percent ? "chosen" : ""}
          onClick={() => setPercent(true)}
        >
          Başarı oranı
        </button>
      </div>
      <div className="analyticsTwoCol">
        {(["direction", "length"] as const).map((category) => {
          const profile = passingProfile(rows, category);
          return (
            <div key={category}>
              <h4>{category === "direction" ? "Yön" : "Uzunluk / tür"}</h4>
              <p className="footnote">
                {profile.covered}/{profile.available} geçerli oyuncu-maç
              </p>
              {profile.rows.map((row) => {
                const total =
                  row.made === null || row.failed === null
                    ? null
                    : row.made + row.failed;
                return (
                  <div className="passingStack" key={row.label}>
                    <span>{row.label}</span>
                    <div className="stackTrack">
                      <i
                        style={{
                          width: `${total ? (row.made! / total) * 100 : 0}%`,
                        }}
                      />
                      <i
                        style={{
                          width: `${total ? (row.failed! / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {percent
                        ? total
                          ? "%" + numberLabel((row.made! / total) * 100, 1)
                          : "Veri yok"
                        : `${numberLabel(row.made, 0)} / ${numberLabel(row.failed, 0)}`}
                    </strong>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="analyticsLegend">
        <span>● Başarılı</span>
        <span>◆ Hatalı</span>
      </p>
    </ChartCard>
  );
}
export function ZoneBalance({
  matches,
  teamId = "79638",
  onPlayer,
  sample,
}: {
  matches: Match[];
  teamId?: string;
  onPlayer?: (id: string) => void;
  sample?: PlayerRow[];
}) {
  const [zone, setZone] = useState(0),
    rows = sample || playerRows(matches, teamId);
  const names = ["Savunma", "Orta saha", "Hücum"],
    losses: MetricId[] = ["lostDefense", "lostMidfield", "lostAttack"],
    wins: MetricId[] = ["wonDefense", "wonMidfield", "wonAttack"];
  const players = [
    ...new Map(
      [...rows]
        .reverse()
        .map((row) => [row.playerId, { id: row.playerId, name: row.name }]),
    ).values(),
  ];
  return (
    <ChartCard
      title="Bölgesel top dengesi"
      question="TOP HANGİ BÖLGEDE KAYBEDİLDİ / KAZANILDI?"
      note="Bunlar üç kategori toplamıdır; olay koordinatı veya ayrıntılı heatmap değildir. Kazanım−kayıp bir kalite puanı değildir."
    >
      <div className="zonePitch" role="group" aria-label="Üç saha bölgesi">
        {names.map((name, i) => {
          const a = summarize(rows, losses[i]),
            b = summarize(rows, wins[i]);
          return (
            <button
              type="button"
              key={name}
              className={i === zone ? "chosen" : ""}
              onClick={() => setZone(i)}
            >
              <span>{name}</span>
              <strong>
                +{numberLabel(b.total, 0)} / −{numberLabel(a.total, 0)}
              </strong>
              <small>
                Fark{" "}
                {a.total === null || b.total === null
                  ? "Veri yok"
                  : numberLabel(b.total - a.total, 0)}
              </small>
              <small>
                {Math.min(a.covered, b.covered)}/{rows.length} kayıt
              </small>
            </button>
          );
        })}
      </div>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>{names[zone]} · Oyuncu</th>
              <th>Kayıp</th>
              <th>Kazanma</th>
              <th>Kapsam</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const a = summarize(
                  rows.filter((r) => r.playerId === p.id),
                  losses[zone],
                ),
                b = summarize(
                  rows.filter((r) => r.playerId === p.id),
                  wins[zone],
                );
              return (
                <tr key={p.id}>
                  <td>
                    {onPlayer ? (
                      <button
                        className="textBtn"
                        onClick={() => onPlayer(p.id)}
                      >
                        {p.name}
                      </button>
                    ) : (
                      <span>{p.name}</span>
                    )}
                  </td>
                  <td>{numberLabel(a.total)}</td>
                  <td>{numberLabel(b.total)}</td>
                  <td>
                    {a.covered}/{a.available}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
export default function MatchReport({
  match,
  history,
  onMatch,
}: {
  match: Match;
  history: Match[];
  onMatch?: (id: string) => void;
}) {
  const [teamId, setTeamId] = useState("79638"),
    [selected, setSelected] = useState<string[]>([]);
  const opponentId =
    Object.keys(match.clubs).find((id) => id !== "79638") || "";
  const report = buildAnalyticsReport(
      [match],
      { ...defaultFilters, minMatches: 1, mode: "total" },
      "",
    ),
    info = matchInfo(match);
  const rows = playerRows([match], teamId),
    opponentRows = playerRows([match], opponentId);
  const prior = history.filter((m) => m.timestamp < match.timestamp);
  const older = playerRows(prior, teamId),
    players = playerSummaries([match], defaultFilters);
  const open = (id: string) => onMatch?.(id);
  const basic: MetricId[] = [
    "shots",
    "onTarget",
    "passRate",
    "tackleRate",
    "interceptions",
  ];
  const evidence = matchEvidence(match, prior, teamId);
  const points = players.flatMap((p) => {
    const x = p.metrics.passAttempts.value,
      y = p.metrics.passRate.value;
    return x === null || y === null
      ? []
      : [
          {
            id: p.id,
            label: p.name,
            x,
            y,
            color: roleColors[p.role],
            role: p.role,
            detail: `${p.name}: ${numberLabel(x)} pas, %${numberLabel(y)}; ${p.metrics.passRate.numerator}/${p.metrics.passRate.denominator}`,
          },
        ];
  });
  return (
    <section className="professionalMatchReport">
      <div className="reportHeading">
        <p className="eyebrow">MAÇIN ANATOMİSİ · #{match.matchId}</p>
        <h3>Bir maç, farklı sorular.</h3>
        <p>
          {new Date(match.timestamp * 1000).toLocaleString("tr-TR", {
            timeZone: "Europe/Amsterdam",
          })}{" "}
          · LEO XI {numberLabel(info.goals, 0)}:{numberLabel(info.conceded, 0)}{" "}
          {info.opponent}
        </p>
        <p className="footnote">
          Takım skorları takım-maç kaydıdır. Diğer sayılar insan oyuncu
          satırlarıdır; iki takımın kadro kapsamı {rows.length} /{" "}
          {opponentRows.length} kayıt.
        </p>
      </div>
      <ChartCard
        title="Maç dengesi"
        question="İKİ KADRO NE ÜRETTİ?"
        note="İki tarafın insan oyuncu toplamlarıdır; AI dahil tam takım karşılaştırması değildir. Kapsam ve aynı tanım dikkate alınmalıdır."
      >
        <ComparisonBars
          right={info.opponent}
          rows={[
            { label: "Takım skoru", a: info.goals, b: info.conceded },
            ...basic.map((id) => ({
              label: metrics[id].label,
              a: summarize(playerRows([match]), id).value,
              b: summarize(opponentRows, id).value,
              unit: metrics[id].kind === "rate" ? "%" : "",
            })),
          ]}
        />
        <p className="footnote">
          {basic
            .map(
              (id) =>
                `${metrics[id].label}: LEO ${summarize(playerRows([match]), id).covered}/${playerRows([match]).length} · rakip ${summarize(opponentRows, id).covered}/${opponentRows.length}`,
            )
            .join(" | ")}
        </p>
      </ChartCard>
      <div className="segmented noPrint">
        <button
          className={teamId === "79638" ? "chosen" : ""}
          onClick={() => setTeamId("79638")}
        >
          LEO XI
        </button>
        <button
          className={teamId === opponentId ? "chosen" : ""}
          disabled={!opponentId}
          onClick={() => setTeamId(opponentId)}
        >
          Rakip
        </button>
      </div>
      <ChartCard
        title="Hücum üretimi"
        question="ŞUTLAR NEYE DÖNÜŞTÜ?"
        note="Şut, isabetli şut ve gol bağımsız sayaçlar olarak gösterilir. Olay şutları ve adlandırılmış alanlar aynı kapsamda değilse ortak huni kurulmaz."
      >
        <div className="analyticsMetricGrid">
          {(
            [
              "shots",
              "onTarget",
              "goals",
              "accuracy",
              "conversion",
            ] as MetricId[]
          ).map((id) => {
            const r = summarize(rows, id);
            return (
              <div key={id}>
                <span>{metrics[id].label}</span>
                <strong>
                  {numberLabel(r.value)}
                  {metrics[id].kind === "rate" ? "%" : ""}
                </strong>
                <small>
                  {r.numerator === null
                    ? ""
                    : `${r.numerator}/${r.denominator} · `}
                  {r.covered}/{r.available} kayıt
                </small>
              </div>
            );
          })}
        </div>
      </ChartCard>
      <PassProfile matches={[match]} teamId={teamId} />
      <ZoneBalance matches={[match]} teamId={teamId} />
      <ChartCard
        exportable
        title="Oyuncu katkısı"
        question="LEO XI PAS YÜKÜ KİMDEYDİ?"
        table={
          <table>
            <thead>
              <tr>
                <th>Oyuncu</th>
                <th>Pas</th>
                <th>Pas %</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button onClick={() => setSelected([p.id])}>
                      {p.name}
                    </button>
                  </td>
                  <td>{numberLabel(p.metrics.passAttempts.value)}</td>
                  <td>{numberLabel(p.metrics.passRate.value)}</td>
                  <td>{roles[p.role]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ScatterChart
          points={points}
          xLabel="Pas denemesi · tek maç"
          yLabel="Pas başarı %"
          onSelect={setSelected}
        />
        {selected.length > 0 && (
          <p role="status">
            {players
              .filter((p) => selected.includes(p.id))
              .map(
                (p) =>
                  p.name +
                  ": " +
                  numberLabel(p.metrics.goals.value) +
                  " gol / " +
                  numberLabel(p.metrics.assists.value) +
                  " asist; " +
                  roles[p.role],
              )
              .join(" · ")}
          </p>
        )}
      </ChartCard>
      <ChartCard
        title="Normalimize göre bu maç"
        question="ÖNCEKİ KAYITLARDAN NE FARKLI?"
        note="Referans yalnız bu maçtan önceki kayıtlardır; mevcut maç dahil edilmez. En az üç geçerli geçmiş maçta medyan ve min–maks aralık gösterilir; güven aralığı değildir."
      >
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Metrik</th>
                <th>Bu maç</th>
                <th>Önceki medyan</th>
                <th>Min–maks</th>
                <th>Geçmiş maç</th>
              </tr>
            </thead>
            <tbody>
              {basic.map((id) => {
                const sample = prior
                  .map((m) => summarize(playerRows([m], teamId), id).value)
                  .filter((v): v is number => v !== null);
                return (
                  <tr key={id}>
                    <td>{metrics[id].label}</td>
                    <td>{numberLabel(summarize(rows, id).value)}</td>
                    <td>
                      {sample.length >= 3
                        ? numberLabel(median(sample))
                        : "Yetersiz geçmiş"}
                    </td>
                    <td>
                      {sample.length >= 3
                        ? `${numberLabel(Math.min(...sample))} – ${numberLabel(Math.max(...sample))}`
                        : "—"}
                    </td>
                    <td>{sample.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
      <ChartCard
        title="Kanıtlı maç değerlendirmesi"
        question="SONRAKİ MAÇTA NEYİ DENEYELİM?"
        note="Tek maç bulguları betimleyicidir. Yorgunluk, moral veya taktik etkisi çıkarılmaz."
      >
        <EvidenceCards
          items={evidence}
          onMatch={open}
          emptyMessage="Bu maçın geçerli metriği ve aynı tanımda en az üç önceki geçerli maç gerekir. Eksik geçmişten maç yorumu üretilmez."
        />
        {!evidence.length && (
          <p className="bodyText">
            Gözlem: kayıtlı skor {numberLabel(info.goals, 0)}:
            {numberLabel(info.conceded, 0)}; insan oyuncu pas kaydı{" "}
            {summarize(rows, "passRate").covered}/{rows.length}. Karşılaştırma
            için daha fazla geçerli geçmiş gerekebilir.
          </p>
        )}
      </ChartCard>
      {(rows.some((r) => r.role === "goalkeeper") ||
        summarize(rows, "corners").total !== null) && (
        <details className="analyticsAdvanced">
          <summary>Kaleci ve duran top alanları</summary>
          <div className="analyticsMetricGrid">
            {(["saves", "corners", "crosses"] as MetricId[]).map((id) => (
              <div key={id}>
                <span>{metrics[id].label}</span>
                <strong>{numberLabel(summarize(rows, id).total)}</strong>
                <small>{metrics[id].limitation}</small>
              </div>
            ))}
          </div>
        </details>
      )}
      <details className="analyticsAdvanced">
        <summary>Ham oyuncu-maç alanları ve kimlikler</summary>
        <p className="footnote">
          Bu maçtaki EA rolleri ve kimlikler. Gözlenmeyen alanlar eklenmez.
        </p>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Oyuncu</th>
                <th>Rol</th>
                <th>Ham JSON</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.playerId}</td>
                  <td>{row.name}</td>
                  <td>{roles[row.role]}</td>
                  <td>
                    <details>
                      <summary>Kaydı aç</summary>
                      <pre>{JSON.stringify(row.raw, null, 2)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="footnote">
        {report.coverage} {older.length} önceki insan oyuncu-maç kaydı mevcut.
      </p>
    </section>
  );
}

export function PrintableReport({ report }: { report: AnalyticsReport }) {
  const viewLabels: Record<string, string> = {
    team: "Takım",
    players: "Oyuncular",
    match: "Maç",
    session: "Seans",
    compare: "Karşılaştırma",
    matrix: "Oyuncu × maç",
    pairs: "Birlikte oynama",
    development: "Gelişim",
  };
  const periodLabels: Record<string, string> = {
    all: "Tüm kayıtlı maçlar",
    match: "Tek maç",
    session: "Seans",
    week: "Takvim haftası",
    month: "Takvim ayı",
    last5: "Son 5 maç",
    last10: "Son 10 maç",
    last20: "Son 20 maç",
    custom: "Özel tarih aralığı",
  };
  return (
    <div className="printReport">
      <section>
        <h1>LEO XI · Performans raporu</h1>
        <p>
          {viewLabels[report.filters.view]} /{" "}
          {periodLabels[report.filters.scope]} {report.filters.key} ·
          Europe/Amsterdam
        </p>
        <p>
          {report.filters.from} – {report.filters.to} · {report.matchCount}{" "}
          kayıtlı maç
        </p>
        <p>{report.coverage}</p>
        <p>
          EA rolü: {roles[report.filters.role] || "Tümü"} · sonuç:{" "}
          {report.filters.result === "all" ? "G/B/M" : report.filters.result} ·
          oyuncu ID’leri: {report.filters.playerIds.join(", ") || "Tümü"} ·
          minimum oyuncu maç: {report.filters.minMatches} · seans boşluğu:{" "}
          {report.filters.gapMinutes} dk · taktik etiketi:{" "}
          {report.filters.tag || "Yok"}
        </p>
        <p>
          Rapor zamanı:{" "}
          {report.exportedAt
            ? new Date(report.exportedAt).toLocaleString("tr-TR", {
                timeZone: report.timezone,
              })
            : "Tarayıcı yazdırma zamanı"}{" "}
          · kaynak maçlar: {report.matchIds.join(", ")}
        </p>
        <div className="analyticsMetricGrid">
          {Object.entries(report.team).map(([key, value]) => (
            <div key={key}>
              <span>
                {teamMetricDictionary.find((m) => m.id === key)?.label || key}
              </span>
              <strong>{numberLabel(value)}</strong>
            </div>
          ))}
        </div>
        <h2>Takım oyuncu kayıtları</h2>
        <p>
          Sayım değerleri{" "}
          {report.filters.mode === "perMatch"
            ? "geçerli oyuncu-maç başına"
            : "toplam"}
          ; oranlar toplam pay/payda, EA puanları geçerli kayıt ortalamasıdır.
          İnsan kayıtları tam takım toplamı değildir.
        </p>
        <table>
          <thead>
            <tr>
              <th>Metrik</th>
              <th>Değer</th>
              <th>Pay / payda</th>
              <th>Kapsam</th>
            </tr>
          </thead>
          <tbody>
            {metricIds.map((id) => (
              <tr key={id}>
                <td>
                  {metrics[id].label} ({metrics[id].unit})
                </td>
                <td>
                  {numberLabel(
                    displayValue(
                      report.playerMetrics[id],
                      id,
                      report.filters.mode,
                    ),
                  )}
                </td>
                <td>
                  {numberLabel(report.playerMetrics[id].numerator)} /{" "}
                  {numberLabel(report.playerMetrics[id].denominator)}
                </td>
                <td>
                  {report.playerMetrics[id].covered}/
                  {report.playerMetrics[id].available} oyuncu-maç
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Oyuncu raporu</h2>
        <p>
          Her metrik kendi geçerli maç sayısını kullanır. Sayımlar{" "}
          {report.filters.mode === "perMatch"
            ? "geçerli oyuncu-maç başına"
            : "toplam"}
          ; oranlar havuzlanmış pay/payda.
        </p>
        {report.players.map((p) => (
          <article key={p.id}>
            <h3>
              {p.name} · #{p.id} · {p.roles.map((r) => roles[r]).join(", ")} ·{" "}
              {p.matches} maç
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Metrik</th>
                  <th>Değer</th>
                  <th>Geçerli / mevcut</th>
                  <th>Kaynak maçlar</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    "goals",
                    "assists",
                    "shots",
                    "passRate",
                    "forwardRate",
                    "tackleRate",
                    "interceptions",
                    "losses",
                    "wins",
                    "rating",
                  ] as MetricId[]
                ).map((id) => (
                  <tr key={id}>
                    <td>
                      {metrics[id].label} ({metrics[id].unit})
                    </td>
                    <td>
                      {numberLabel(
                        displayValue(p.metrics[id], id, report.filters.mode),
                      )}
                    </td>
                    <td>
                      {p.metrics[id].covered}/{p.metrics[id].available}
                    </td>
                    <td>
                      {p.metrics[id].matchIds
                        .map((s) => s.slice(-6))
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </section>
      <section>
        <h2>Maçlar ve kanıtlı gözlemler</h2>
        <TrendChart
          labels={report.trend.map((m) => m.date)}
          series={[
            {
              label: "Takım puanı · 3/1/0",
              color: "#e8bc68",
              values: report.trend.map((m) => m.points),
            },
          ]}
        />
        <table>
          <thead>
            <tr>
              <th>Tarih (Amsterdam)</th>
              <th>Rakip</th>
              <th>Skor</th>
              <th>Puan</th>
              <th>Maç ID</th>
            </tr>
          </thead>
          <tbody>
            {report.trend.map((m) => (
              <tr key={m.matchId}>
                <td>
                  {new Date(m.timestamp * 1000).toLocaleString("tr-TR", {
                    timeZone: report.timezone,
                  })}
                </td>
                <td>{m.opponent}</td>
                <td>
                  {numberLabel(m.goals)}:{numberLabel(m.conceded)}
                </td>
                <td>{numberLabel(m.points)}</td>
                <td>{m.matchId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.evidence.map((e) => (
          <article key={e.track}>
            <h3>{e.observation}</h3>
            <p>{e.evidence}</p>
            <p>{e.explanation}</p>
            <p>{e.experiment}</p>
            <p>{e.sample}</p>
          </article>
        ))}
        <p>
          Önceki dönem: {report.previousMatchIds.join(", ") || "Veri yok"}. Pas
          ağı/şut koordinatları/takip verisi mevcut değildir. Resmî Opta ürünü
          değildir.
        </p>
      </section>
    </div>
  );
}
