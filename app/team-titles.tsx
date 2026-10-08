"use client";
import { useMemo, useState } from "react";
import PlayerAvatar from "./player-avatar";
import MatchReport from "./analytics-report";
import {
  ChartCard,
  ScatterChart,
  downloadFile,
  numberLabel,
} from "./analytics-charts";
import {
  buildAwardReport,
  selectHomeAwards,
  awardPeriodIsCurrentWeek,
} from "../lib/derived-awards";
import type {
  AwardReport,
  AwardResult,
  AwardCandidate,
  AwardMember,
  AwardSnapshot,
} from "../lib/derived-awards";
import {
  awardCardContent,
  awardCardSVG,
  awardMapPresets,
  awardCoordinates,
} from "../lib/award-presentation";
import { roles, roleColors, scopeOptions } from "../lib/club-analytics";
import type { AnalyticsFilters } from "../lib/club-analytics";
import type { Match } from "../lib/club-types";

async function cardPNG(
  result: AwardResult,
  candidate: AwardCandidate,
  report: AwardReport,
  share: boolean,
) {
  const url = URL.createObjectURL(
    new Blob([awardCardSVG(result, candidate, report)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight * 2;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Canvas kullanılamıyor.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw Error("PNG oluşturulamadı.");
    const filename = `leo-xi-${result.definition.id}-${candidate.playerId}-${report.asOf.slice(0, 10)}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (share && navigator.canShare?.({ files: [file] }))
      await navigator.share({ files: [file], title: result.definition.title });
    else downloadFile(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function AwardDetail({
  result,
  candidate,
  report,
  onMatch,
}: {
  result: AwardResult;
  candidate: AwardCandidate;
  report: AwardReport;
  onMatch: (id: string) => void;
}) {
  const def = result.definition;
  return (
    <details className="awardDetail">
      <summary>Neden kazandı?</summary>
      <div>
        <p>{def.formula}</p>
        <p className="footnote">
          {report.version} / {def.variant}. adjRate = (başarı + k ×
          baseline)/(deneme + k). adjMatch = (sayı + {report.rules.priorMatches}{" "}
          × baseline)/(M + {report.rules.priorMatches}). Priorlar
          değiştirilebilir ürün parametreleridir.
        </p>
        <p>
          <strong>Ortak kapsam:</strong> {candidate.M}/{candidate.available}{" "}
          oyuncu-maç · {candidate.roles.map((r) => roles[r]).join(" / ")}.
          Başlangıç eşikleri: M≥
          {Math.max(report.rules.minMatches, def.thresholds.M || 0)};{" "}
          {Object.entries(def.thresholds)
            .filter(([k]) => k !== "M")
            .map(([k, v]) => `${k}≥${v}`)
            .join(", ")}
          {Object.entries(def.max || {}).map(([k, v]) => `; ${k}≤${v}`)}. En az{" "}
          {report.rules.minCandidates} uygun aday.
        </p>
        <div className="tableWrap">
          <table>
            <caption>Ham değer, düzeltme ve ağırlıklar</caption>
            <thead>
              <tr>
                <th>Bileşen</th>
                <th>Ham pay/payda</th>
                <th>Ham</th>
                <th>Düzeltilmiş</th>
                <th>Baseline</th>
                <th>Prior</th>
                <th>P (0–1)</th>
                <th>Ağırlık</th>
              </tr>
            </thead>
            <tbody>
              {candidate.components.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td>
                    {numberLabel(c.numerator)}/{numberLabel(c.denominator)}
                  </td>
                  <td>{numberLabel(c.raw, 4)}</td>
                  <td>{numberLabel(c.adjusted, 4)}</td>
                  <td>{numberLabel(c.baseline, 4)}</td>
                  <td>{c.prior}</td>
                  <td>{numberLabel(c.percentile, 4)}</td>
                  <td>{numberLabel(c.weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {candidate.components
          .filter((c) => c.references.length)
          .map((c) => (
            <p className="footnote" key={c.key}>
              <strong>{c.label} referansı:</strong>{" "}
              {c.references
                .map(
                  (b) =>
                    `${roles[b.role]} → ${b.scope === "same-role" ? "aynı rol" : "genel takım"}; ${b.peers} başka oyuncu, ${b.observations} geçerli kayıt, payda ${numberLabel(b.attempts)}, değer ${numberLabel(b.value, 4)}, rol ağırlığı ${numberLabel(b.weight, 4)}`,
                )
                .join(" | ")}
              . Oyuncunun kendi kayıtları referanstan çıkarıldı.
            </p>
          ))}
        {def.id === "potato" && <p>{candidate.context}</p>}
        <div className="tableWrap">
          <table>
            <caption>
              İlk 3 uygun aday · farklar yuvarlanmadan hesaplanır
            </caption>
            <thead>
              <tr>
                <th>Oyuncu / ID</th>
                <th>Geçerli maç</th>
                <th>Unvan endeksi</th>
                <th>Lidere fark</th>
              </tr>
            </thead>
            <tbody>
              {result.candidates.slice(0, 3).map((c) => (
                <tr key={c.playerId}>
                  <td>
                    {c.proName} · #{c.playerId}
                  </td>
                  <td>{c.M}</td>
                  <td>{numberLabel(c.index, 3)}</td>
                  <td>
                    {c.index === null
                      ? "—"
                      : numberLabel(result.candidates[0].index! - c.index, 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          P uygun takım adayları arasında eşit değerlerde orta sıradır; olasılık
          veya güven değildir. Eşitlik toleransı{" "}
          {report.rules.equalityTolerance}; lider farkı en az{" "}
          {report.rules.minIndexGap} ve toplam endeks aralığı en az{" "}
          {report.rules.minIndexSpread} puan; türetilmiş değerler için göreli
          fark tabanı {report.rules.minRelativeDifference} × max(1, |değerler|).
          Tam eşit liderler unvanı paylaşır; çok küçük farkta net kazanan
          yoktur.
        </p>
        <details>
          <summary>Ham sayaçlar ve kapsam denetimi</summary>
          <pre>{JSON.stringify(candidate.totals, null, 2)}</pre>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Maç</th>
                  <th>Kayıtlı insan</th>
                  <th>İnsan gol</th>
                  <th>İnsan şut</th>
                  <th>İnsan G+A</th>
                </tr>
              </thead>
              <tbody>
                {candidate.sourceTotals.map((s) => (
                  <tr key={s.matchId}>
                    <td>{s.matchId}</td>
                    <td>{s.humanPlayers}</td>
                    <td>{numberLabel(s.goals)}</td>
                    <td>{numberLabel(s.shots)}</td>
                    <td>{numberLabel(s.contributions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <div className="sourceLinks">
          {candidate.matchIds.map((id) => (
            <button key={id} onClick={() => onMatch(id)}>
              Kaynak maç #{id}
            </button>
          ))}
        </div>
        <p>
          <strong>Neyi ölçmez?</strong> {def.limitation}
        </p>
        <p className="footnote">
          Veri tarihi: {report.asOf}. {report.coverage}
        </p>
      </div>
    </details>
  );
}
function TitleCard({
  result,
  candidate,
  report,
  onPlayer,
  onMatch,
  shared = [],
}: {
  result: AwardResult;
  candidate: AwardCandidate;
  report: AwardReport;
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
  shared?: AwardCandidate[];
}) {
  const c = awardCardContent(result, candidate, report),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(share: boolean) {
    setBusy(true);
    setError("");
    try {
      await cardPNG(result, candidate, report, share);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError("Kart indirilemedi. Tarayıcı indirme izinlerini kontrol et.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={"weeklyCard weeklyCard-" + result.definition.id}>
      <span className="weeklyIcon" aria-hidden="true">
        {result.definition.icon}
      </span>
      <h4>{c.title}</h4>
      <div className="weeklyNames">
        {[candidate, ...shared].map((person) => (
          <button
            key={person.playerId}
            onClick={() => onPlayer(person.playerId)}
          >
            <PlayerAvatar
              player={{ name: person.name, proName: person.proName }}
              className="small"
            />
            <span>{person.proName}</span>
          </button>
        ))}
      </div>
      {shared.length > 0 && (
        <p className="footnote">
          Unvan paylaşıldı. Aşağıdaki kanıt: {c.player}.
        </p>
      )}
      <p className="awardJoke">{c.joke}</p>
      <p className="awardDerived">{c.value}</p>
      <ul className="awardEvidence">
        {c.evidence.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <p className="awardPeriod">
        {c.period} · {c.matches} geçerli maç
      </p>
      <p className="awardIndex">{c.index}</p>
      <AwardDetail
        result={result}
        candidate={candidate}
        report={report}
        onMatch={onMatch}
      />
      <div className="awardActions">
        <button disabled={busy} onClick={() => void save(false)}>
          PNG indir
        </button>
        <button disabled={busy} onClick={() => void save(true)}>
          Paylaş
        </button>
      </div>
      {shared.map((person) => {
        const other = awardCardContent(result, person, report);
        return (
          <details className="awardDetail" key={person.playerId}>
            <summary>{person.proName} · paylaşılan unvanın kanıtı</summary>
            <p>{other.value}</p>
            <p>{other.evidence.join(" · ")}</p>
            <p>
              {other.index} · {person.M} geçerli maç
            </p>
            <AwardDetail
              result={result}
              candidate={person}
              report={report}
              onMatch={onMatch}
            />
            <button
              onClick={() => {
                void cardPNG(result, person, report, false).catch(() =>
                  setError("Kart indirilemedi."),
                );
              }}
            >
              PNG indir
            </button>
          </details>
        );
      })}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function AwardCards({
  report,
  compact = false,
  onPlayer,
  onMatch,
}: {
  report: AwardReport;
  compact?: boolean;
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
}) {
  const selected = compact ? selectHomeAwards(report) : report.results;
  return (
    <div className="weeklyCards awardCards">
      {selected.map((result) => (
        <div className="awardGroup" key={result.definition.id}>
          {result.winners.length ? (
            (compact ? [result.winners[0]] : result.winners).map((c) => (
              <TitleCard
                shared={compact ? result.winners.slice(1) : []}
                key={c.playerId}
                result={result}
                candidate={c}
                report={report}
                onPlayer={onPlayer}
                onMatch={onMatch}
              />
            ))
          ) : (
            <article className="weeklyCard">
              <span className="weeklyIcon" aria-hidden="true">
                {result.definition.icon}
              </span>
              <h4>{result.definition.title}</h4>
              <div className="weeklyEmpty">
                <strong>—</strong>
                <span>{result.reason || "Bu dönem net kazanan yok."}</span>
              </div>
              <details className="awardDetail">
                <summary>Veri ve adaylık koşulları</summary>
                <p>{result.definition.formula}</p>
                <p>
                  M≥
                  {Math.max(
                    report.rules.minMatches,
                    result.definition.thresholds.M || 0,
                  )}
                  ; {JSON.stringify(result.definition.thresholds)}.{" "}
                  {result.definition.limitation}
                </p>
                <p>{result.excluded.length} oyuncu-maç ilgili hesap dışında.</p>
              </details>
            </article>
          )}
        </div>
      ))}
      {compact && !selected.length && (
        <p className="empty">
          Bu dönem net kazanan yok. Yeterli ortak veri ve en az dört uygun aday
          bekleniyor.
        </p>
      )}
    </div>
  );
}
export function AwardMap({
  report,
  preset,
  onSelect,
}: {
  report: AwardReport;
  preset: string;
  onSelect: (ids: string[]) => void;
}) {
  const def =
      awardMapPresets.find((p) => p.id === preset) || awardMapPresets[0],
    result = report.results.find((r) => r.definition.id === def.award)!;
  const points = result.candidates.flatMap((c) => {
    const xy = awardCoordinates(result, c);
    return xy
      ? [
          {
            id: c.playerId,
            label: c.proName,
            ...xy,
            color: roleColors[c.roles[0]] || roleColors.unknown,
            role: c.roles.length === 1 ? c.roles[0] : "unknown",
            winner: result.winners.some((w) => w.playerId === c.playerId),
            detail: `${c.proName} · ${c.roles.map((r) => roles[r]).join("/")} · ${def.xLabel}: ${numberLabel(xy.x)}; ${def.yLabel}: ${numberLabel(xy.y)} · ${c.M}/${c.available} ortak geçerli maç${result.winners.some((w) => w.playerId === c.playerId) ? " · Unvan kazananı" : ""}`,
          },
        ]
      : [];
  });
  return (
    <ChartCard
      exportable
      title={def.label}
      question="HACİM VE VERİM AYNI KAPSAMDA NASIL BİRLEŞİYOR?"
      note={`${result.reason || "Halkalı noktalar unvan kazananlarını gösterir."} Yalnız uygun adaylar; tüm eksenler kartın aynı ortak kayıtlarından hesaplanır. Ham maç başına değerler ve düzeltilmiş oranlar ayrı etiketlidir.`}
      table={
        <table>
          <thead>
            <tr>
              <th>Oyuncu</th>
              <th>{def.xLabel}</th>
              <th>{def.yLabel}</th>
              <th>M</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>
                  <button onClick={() => onSelect([p.id])}>
                    {p.label}
                    {p.winner ? " · Kazanan" : ""}
                  </button>
                </td>
                <td>{numberLabel(p.x)}</td>
                <td>{numberLabel(p.y)}</td>
                <td>{result.candidates.find((c) => c.playerId === p.id)?.M}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ScatterChart
        points={points}
        xLabel={def.xLabel}
        yLabel={def.yLabel}
        onSelect={onSelect}
      />
    </ChartCard>
  );
}
export default function TeamTitles({
  matches,
  history,
  members,
  filters,
  onPlayer,
  onMatch,
  asOf,
  rosterAsOf,
  snapshots = [],
  archiveNotice = "",
}: {
  matches: Match[];
  history: Match[];
  members: AwardMember[];
  filters: AnalyticsFilters;
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
  asOf: string;
  rosterAsOf: string;
  snapshots?: AwardSnapshot[];
  archiveNotice?: string;
}) {
  const [preset, setPreset] = useState(awardMapPresets[0].id);
  const report = useMemo(
    () =>
      buildAwardReport(matches, members, {
        history,
        period:
          scopeOptions(history, filters).find((o) => o.key === filters.key)
            ?.label ||
          (
            {
              last7: "Son 7 gün",
              all: "Tüm kayıtlar",
              custom: `${filters.from} – ${filters.to}`,
            } as Record<string, string>
          )[filters.scope] ||
          filters.scope,
        asOf,
        playerIds: filters.playerIds,
        role: filters.role,
        allowCasper:
          filters.scope === "last7" ||
          (filters.scope === "week" && awardPeriodIsCurrentWeek(matches)),
        rosterAsOf,
        provisional:
          filters.scope !== "week" || awardPeriodIsCurrentWeek(matches),
      }),
    [matches, members, history, filters, asOf, rosterAsOf],
  );
  return (
    <section className="teamTitles">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">LEO XI · TAKIM İÇİ EĞLENCE</p>
          <h3>Takımın unvanları</h3>
        </div>
        <span className="miniTag">
          {report.provisional ? "Geçici dönem" : "Tamamlanmış hafta"}
        </span>
      </div>
      <p className="bodyText">
        {report.period}. {report.coverage}
      </p>
      {filters.scope === "match" && (
        <p className="notice">
          Tek maçta dönem şampiyonu ilan edilmez; haftalık eşikler gevşetilmez.
          Betimleyici değerler mevcut maç raporundadır.
        </p>
      )}
      {filters.scope === "match" && matches[0] && (
        <MatchReport
          match={matches[0]}
          history={history}
          filters={filters}
          onMatch={onMatch}
        />
      )}
      <AwardCards report={report} onPlayer={onPlayer} onMatch={onMatch} />
      <section className="panel awardCasper">
        <h4>👻 Casper</h4>
        {report.casper.length ? (
          report.casper.map((c) => (
            <p key={c.playerId}>
              {c.member.proName}: Bu dönemde arşivde görünmedi.
            </p>
          ))
        ) : (
          <p className="footnote">
            Gösterilecek doğrulanmış güncel kadro üyesi yok veya dönem/kadro
            kapsamı yeterli değil.
          </p>
        )}
        <p className="footnote">
          Endeks üretilmez. Arşiv gerçek hayatta gelmediğini kanıtlamaz; geçmiş
          kadro üyeliği bugünkü kadrodan çıkarılmaz. Katılım beyanları Maç
          gecesi panosunda ayrı gösterilir.
        </p>
      </section>
      <label className="formLabel">
        Unvan X–Y haritası
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          {awardMapPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <AwardMap
        report={report}
        preset={preset}
        onSelect={(ids) => {
          if (ids.length) onPlayer(ids[0]);
        }}
      />
      <details className="panel awardAudit">
        <summary>Tüm kazananların denetim tablosu ve kaynak verisi</summary>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Unvan / sürüm</th>
                <th>Kazanan</th>
                <th>Kanıt / ortak maç</th>
                <th>Endeks</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {report.results.map((r) => (
                <tr key={r.definition.id}>
                  <td>
                    {r.definition.title} / {r.definition.variant}
                  </td>
                  <td>{r.winners.map((c) => c.proName).join(", ") || "—"}</td>
                  <td>
                    {r.winners
                      .map((c) => {
                        const content = awardCardContent(r, c, report);
                        return content.evidence.join(" · ") + ` · ${c.M} maç`;
                      })
                      .join(" / ") || `${r.candidates.length} uygun aday`}
                  </td>
                  <td>
                    {r.winners.map((c) => numberLabel(c.index)).join(", ") ||
                      "—"}
                  </td>
                  <td>{r.reason || "Eşikler ve ayırt edici fark sağlandı"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() =>
            downloadFile(
              JSON.stringify(report, null, 2),
              "leo-xi-unvan-denetimi.json",
            )
          }
        >
          Denetim JSON indir
        </button>
        <p className="footnote">
          Ham / düzeltilmiş / endeks, dışlanan kayıtlar, kaynak maçlar ve
          baseline bu dosyada ayrı saklanır.
        </p>
      </details>
      <details className="panel awardArchive">
        <summary>Unvan arşivi · tamamlanmış haftalar</summary>
        {archiveNotice && <p role="alert">{archiveNotice}</p>}
        <p className="footnote">
          Kalıcı maç deposunda saklanan hesaplama sürümleri. Gecikmiş veya
          düzeltilmiş kayıtlar yeni revizyon oluşturur; eski sonuç korunur.
          Arşiv eksiksiz sezon değildir.
        </p>
        {snapshots
          .filter((s) => !s.report.provisional)
          .map((s) => (
            <details key={s.week + s.version}>
              <summary>
                {s.week} · {s.version} · revizyon {s.revision} ·{" "}
                {s.report.matchIds.length} maç
              </summary>
              <p>
                Veri tarihi: {s.asOf}
                {s.revision > 1
                  ? " · Gecikmiş veya düzeltilmiş veriyle revize edildi."
                  : ""}
              </p>
              <AwardCards
                report={s.report}
                onPlayer={onPlayer}
                onMatch={onMatch}
              />
              {s.previous.map((old) => (
                <details key={old.revision}>
                  <summary>
                    Önceki revizyon {old.revision} · {old.asOf}
                  </summary>
                  <AwardCards
                    report={old.report}
                    onPlayer={onPlayer}
                    onMatch={onMatch}
                  />
                </details>
              ))}
            </details>
          ))}
        {!snapshots.some((s) => !s.report.provisional) && (
          <p>Henüz kalıcı kayıtta tamamlanmış hafta yok.</p>
        )}
      </details>
    </section>
  );
}
