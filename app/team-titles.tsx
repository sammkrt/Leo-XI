"use client";
import { useMemo, useState } from "react";
import {awardTone} from "../lib/award-tone";
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
  awardMapPresets,
  awardCoordinates,
} from "../lib/award-presentation";
import { roles, roleColors, scopeOptions } from "../lib/club-analytics";
import type { AnalyticsFilters } from "../lib/club-analytics";
import type { Match } from "../lib/club-types";

function AwardDetail({result}:{result:AwardResult}) {
  const def=result.definition;
  return <details className="awardDetail"><summary>Neden kazandı?</summary>
        <div className="tableWrap">
          <table>
            <caption>
              İlk 3 uygun aday · farklar yuvarlanmadan hesaplanır
            </caption>
            <thead>
              <tr>
                <th>Oyuncu / ID</th>
                <th>Geçerli maç</th>
                <th>{def.totalField ? "Toplam olay" : "Unvan endeksi"}</th>
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
                  <td>{numberLabel(def.totalField ? c.totals[def.totalField] : c.index, 3)}</td>
                  <td>
                    {def.totalField
                      ? numberLabel(result.candidates[0].totals[def.totalField] - c.totals[def.totalField])
                      : c.index === null
                      ? "—"
                      : numberLabel(result.candidates[0].index! - c.index, 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
  </details>;
}
function TitleCard({
  result,
  candidate,
  report,
  onPlayer,
  shared = [],
}: {
  result: AwardResult;
  candidate: AwardCandidate;
  report: AwardReport;
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
  shared?: AwardCandidate[];
}) {
  const c = awardCardContent(result, candidate, report);
  return (
    <article className={"weeklyCard awardTone-" + awardTone(result.definition.id) + " weeklyCard-" + result.definition.id}>
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
      <p className="awardJoke">{c.joke}</p>
      <p className="awardDerived">{c.value}</p>
      <p className="awardPeriod">{c.period} · {c.matches} maç{shared.length>0?' · ortak unvan':''}</p>
      <div className="awardCardDetails"><AwardDetail result={result}/></div>
    </article>
  );
}
export function AwardCards({
  report,
  compact = false,
  firstCard,
  firstCardPlayers = [],
  playerOptions,
  onPlayer,
  onMatch,
}: {
  report: AwardReport;
  compact?: boolean;
  firstCard?: import("react").ReactNode;
  firstCardPlayers?: string[];
  playerOptions?: {name:string;proName:string}[];
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
}) {
  const [playerFilter,setPlayerFilter]=useState('');
  const options=playerOptions||[...new Map(report.results.flatMap(r=>r.candidates).map(p=>[p.name,{name:p.name,proName:p.proName}])).values()];
  const selected = (compact ? selectHomeAwards(report) : report.results).filter(r=>!playerFilter||r.winners.some(p=>p.name===playerFilter)).sort((a,b)=>{const rank={negative:0,positive:1,neutral:2};return rank[awardTone(a.definition.id)]-rank[awardTone(b.definition.id)];});
  const firstVisible=!playerFilter||firstCardPlayers.includes(playerFilter);
  return (
    <><div className="awardFilterBar"><label>Oyuncu<select aria-label="Kartları oyuncuya göre filtrele" value={playerFilter} onChange={e=>setPlayerFilter(e.target.value)}><option value="">Tüm oyuncular</option>{options.map(p=><option key={p.name} value={p.name}>{p.proName} · {p.name}</option>)}</select></label><button type="button" onClick={()=>setPlayerFilter('')} disabled={!playerFilter}>Filtreleri temizle</button><span>Yeşil: olumlu · Kırmızı: olumsuz</span></div>
    <div className="weeklyCards awardCards">
      {firstCard&&<div className="awardFirstSlot" hidden={!firstVisible}>{firstCard}</div>}
      {selected.map((result) => (
        <div className="awardGroup" key={result.definition.id}>
          {result.winners.length ? (
            [playerFilter?result.winners.find(p=>p.name===playerFilter)!:result.winners[0]].map((c) => (
              <TitleCard
                shared={result.winners.filter(p=>p.playerId!==c.playerId)}
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
      {!selected.length && (!firstCard||!firstVisible) && (
        <p className="empty">
          {playerFilter?"Bu oyuncunun bu dönemde kazandığı kart yok.":"Bu dönem net kazanan yok. Yeterli ortak veri bekleniyor."}
        </p>
      )}
    </div></>
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
  research,
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
  research?: import("../lib/research-types").ResearchContext;
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
        research,
        provisional:
          filters.scope !== "week" || awardPeriodIsCurrentWeek(matches),
      }),
    [matches, members, history, filters, asOf, rosterAsOf, research],
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
