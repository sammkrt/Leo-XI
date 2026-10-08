"use client";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Download, ChevronDown } from "lucide-react";
import { median } from "../lib/club-analytics";

export const numberLabel = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "Veri yok"
    : value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
export function downloadFile(
  contents: string | Blob,
  filename: string,
  type = "application/json",
) {
  const blob =
    contents instanceof Blob
      ? contents
      : new Blob([contents], { type: type + ";charset=utf-8" });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ChartCard({
  title,
  question,
  children,
  table,
  note,
  exportable = false,
}: {
  title: string;
  question: string;
  children: ReactNode;
  table?: ReactNode;
  note?: string;
  exportable?: boolean;
}) {
  const ref = useRef<HTMLElement>(null),
    [error, setError] = useState("");
  async function exportChart(format: "svg" | "png") {
    const svg = ref.current?.querySelector("svg[data-chart]");
    if (!svg) {
      setError("Bu grafikte indirilecek geçerli veri yok.");
      return;
    }
    setError("");
    const serialized = new XMLSerializer().serializeToString(svg),
      filename =
        "leo-xi-" +
        title.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-") +
        "-" +
        new Date().toISOString().slice(0, 10) +
        "." +
        format;
    if (format === "svg") {
      downloadFile(serialized, filename, "image/svg+xml");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([serialized], { type: "image/svg+xml" }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Canvas");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("PNG");
      downloadFile(blob, filename);
    } catch {
      setError("Grafik indirilemedi. SVG seçeneğini deneyebilirsin.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <section ref={ref} className="panel analyticsCard">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">{question}</p>
          <h3>{title}</h3>
        </div>
        {exportable && (
          <div className="chartExport noPrint">
            <button
              type="button"
              aria-label={title + " SVG indir"}
              onClick={() => void exportChart("svg")}
            >
              <Download size={13} /> SVG
            </button>
            <button
              type="button"
              aria-label={title + " PNG indir"}
              onClick={() => void exportChart("png")}
            >
              PNG
            </button>
          </div>
        )}
      </div>
      {children}
      {note && <p className="footnote">{note}</p>}
      {error && <p role="alert">{error}</p>}
      {table && (
        <details className="chartTable">
          <summary>
            <ChevronDown size={14} /> Erişilebilir veri tablosu ve kaynaklar
          </summary>
          <div className="tableWrap">{table}</div>
        </details>
      )}
    </section>
  );
}
const chartBase = {
  xmlns: "http://www.w3.org/2000/svg",
  fontFamily: "Arial, sans-serif",
  width: 600,
  height: 360,
  viewBox: "0 0 600 360",
  "data-chart": "true",
};
export type ScatterPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  role?: string;
  detail: string;
};
export function ScatterChart({
  points,
  xLabel,
  yLabel,
  onSelect,
  selected,
  previous = [],
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  onSelect: (ids: string[]) => void;
  selected?: string;
  previous?: ScatterPoint[];
}) {
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const prior = previous.filter((p) => p.id === selected),
    all = [...points, ...prior];
  if (!points.length)
    return (
      <p className="empty">
        İki eksen için birlikte geçerli kayıt bulunmuyor. Filtreleri veya
        minimum deneme sayısını değiştirebilirsin.
      </p>
    );
  const bounds = (values: number[]) => {
    const min = Math.min(0, ...values),
      max = Math.max(1, ...values);
    return [min - (max - min) * 0.08, max + (max - min) * 0.13];
  };
  const [minX, maxX] = bounds(all.map((p) => p.x)),
    [minY, maxY] = bounds(all.map((p) => p.y));
  const x = (n: number) => 68 + ((n - minX) / (maxX - minX)) * 485,
    y = (n: number) => 294 - ((n - minY) / (maxY - minY)) * 232;
  const mx = median(points.map((p) => p.x))!,
    my = median(points.map((p) => p.y))!;
  const groups = new Map<string, ScatterPoint[]>();
  for (const point of points) {
    const key = String(point.x) + ":" + String(point.y);
    groups.set(key, [...(groups.get(key) || []), point]);
  }
  const marker = (point: ScatterPoint, cx: number, cy: number, opacity = 1) =>
    point.role === "forward" ? (
      <path
        d={`M${cx},${cy - 7} l7,13 h-14 z`}
        fill={point.color}
        opacity={opacity}
      />
    ) : point.role === "defender" ? (
      <rect
        x={cx - 6}
        y={cy - 6}
        width="12"
        height="12"
        fill={point.color}
        opacity={opacity}
      />
    ) : (
      <circle cx={cx} cy={cy} r="6" fill={point.color} opacity={opacity} />
    );
  return (
    <div className="chartViewport">
      <svg
        {...chartBase}
        className="analyticsSvg"
        role="img"
        aria-label={`${xLabel} ve ${yLabel}. ${points.length} nokta; kesikli çizgiler seçili kohort medyanı.`}
      >
        <rect width="600" height="360" fill="#ffffff" rx="12" />
        <defs>
          <marker
            id="analytics-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10z" fill="#173de8" />
          </marker>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1="68"
              x2="553"
              y1={62 + f * 232}
              y2={62 + f * 232}
              stroke="#dbe0e9"
            />
            <text
              x="58"
              y={66 + f * 232}
              textAnchor="end"
              fill="#596476"
              fontSize="10"
            >
              {numberLabel(maxY - f * (maxY - minY), 1)}
            </text>
            <text
              x={68 + f * 485}
              y="314"
              textAnchor="middle"
              fill="#596476"
              fontSize="10"
            >
              {numberLabel(minX + f * (maxX - minX), 1)}
            </text>
          </g>
        ))}
        <line
          x1={x(mx)}
          x2={x(mx)}
          y1="62"
          y2="294"
          stroke="#173de866"
          strokeDasharray="4 5"
        />
        <line
          x1="68"
          x2="553"
          y1={y(my)}
          y2={y(my)}
          stroke="#173de866"
          strokeDasharray="4 5"
        />
        <text x="72" y="40" fill="#596476" fontSize="9">
          Düşük X / yüksek Y
        </text>
        <text x="549" y="40" textAnchor="end" fill="#596476" fontSize="9">
          Yüksek X / yüksek Y
        </text>
        <text x="72" y="285" fill="#596476" fontSize="9">
          Düşük X / düşük Y
        </text>
        <text x="549" y="285" textAnchor="end" fill="#596476" fontSize="9">
          Yüksek X / düşük Y
        </text>
        {prior.map((p) => {
          const next = points.find((n) => n.id === p.id);
          return next ? (
            <g key={p.id}>
              {marker(p, x(p.x), y(p.y), 0.3)}
              <line
                x1={x(p.x)}
                y1={y(p.y)}
                x2={x(next.x)}
                y2={y(next.y)}
                stroke="#173de8"
                strokeWidth="2"
                markerEnd="url(#analytics-arrow)"
              />
              <title>{`${p.label}: önceki ${numberLabel(p.x)} / ${numberLabel(p.y)} → mevcut ${numberLabel(next.x)} / ${numberLabel(next.y)}`}</title>
            </g>
          ) : null;
        })}
        {[...groups].map(([key, group]) => {
          const p = group.find((item) => item.id === selected) || group[0],
            label = group.length > 1 ? `${group.length} oyuncu/kayıt` : p.label;
          return (
            <g
              key={key}
              className="chartPoint"
              tabIndex={0}
              role="button"
              aria-label={group.map((p) => p.detail).join("; ")}
              onMouseEnter={() => setFocusedGroup(key)}
              onMouseLeave={() => setFocusedGroup(null)}
              onFocus={() => setFocusedGroup(key)}
              onBlur={() => setFocusedGroup(null)}
              onClick={() => onSelect(group.map((p) => p.id))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(group.map((p) => p.id));
                }
              }}
            >
              <circle cx={x(p.x)} cy={y(p.y)} r="22" fill="transparent" />
              {marker(p, x(p.x), y(p.y))}
              {p.id === selected && (
                <circle
                  cx={x(p.x)}
                  cy={y(p.y)}
                  r="10"
                  stroke="#fff"
                  fill="none"
                />
              )}
              <title>{group.map((p) => p.detail).join("\n")}</title>
              {(p.id === selected || focusedGroup === key) && <text
                x={Math.min(530, x(p.x) + 10)}
                y={Math.max(54, y(p.y) - 12)}
                fill="#151f30"
                fontSize="13"
                stroke="#ffffff"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {label.length > 22 ? label.slice(0, 20) + "…" : label}
              </text>}
            </g>
          );
        })}
        <text x="310" y="343" textAnchor="middle" fill="#173de8" fontSize="11">
          {xLabel}
        </text>
        <text
          transform="translate(17 180) rotate(-90)"
          textAnchor="middle"
          fill="#173de8"
          fontSize="11"
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}
export type TrendSeries = {
  label: string;
  color: string;
  values: (number | null)[];
};
export function TrendChart({
  labels,
  series,
  onSelect,
}: {
  labels: string[];
  series: TrendSeries[];
  onSelect?: (index: number) => void;
}) {
  if (!labels.length || !series.some((s) => s.values.some((v) => v !== null)))
    return <p className="empty">Bu eğilim için geçerli kayıt yok.</p>;
  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    x = (i: number) => 60 + (495 * i) / Math.max(1, labels.length - 1),
    y = (n: number) => 290 - ((n - min) / (max - min)) * 230;
  return (
    <>
      <div className="chartViewport">
        <svg
          {...chartBase}
          className="analyticsSvg"
          role="img"
          aria-label={
            series.map((s) => s.label).join(", ") +
            " zaman çizgisi. Eksik verilerde çizgi kesilir."
          }
        >
          <rect width="600" height="360" fill="#ffffff" />
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1="60"
                x2="555"
                y1={60 + 230 * f}
                y2={60 + 230 * f}
                stroke="#dbe0e9"
              />
              <text
                x="50"
                y={64 + 230 * f}
                fill="#596476"
                textAnchor="end"
                fontSize="11"
              >
                {numberLabel(max - (max - min) * f)}
              </text>
            </g>
          ))}
          {series.map((s, index) => {
            const paths: string[] = [];
            let path = "";
            s.values.forEach((v, i) => {
              if (v === null) {
                if (path) paths.push(path);
                path = "";
              } else path += `${path ? " L" : "M"}${x(i)} ${y(v)}`;
            });
            if (path) paths.push(path);
            return (
              <g key={s.label}>
                {paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    stroke={s.color}
                    strokeWidth="2"
                    strokeDasharray={index ? "5 3" : undefined}
                    fill="none"
                  />
                ))}
                {s.values.map((v, i) =>
                  v === null ? null : (
                    <g
                      key={i}
                      role={onSelect ? "button" : undefined}
                      tabIndex={onSelect ? 0 : undefined}
                      className="chartPoint"
                      aria-label={`${labels[i]} ${s.label} ${numberLabel(v)}`}
                      onClick={() => onSelect?.(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect?.(i);
                        }
                      }}
                    >
                      <circle cx={x(i)} cy={y(v)} r="22" fill="transparent" />
                      <circle cx={x(i)} cy={y(v)} r="4" fill={s.color} />
                      <title>{`${labels[i]} · ${s.label}: ${numberLabel(v)}`}</title>
                    </g>
                  ),
                )}
              </g>
            );
          })}
          {labels.map((label, i) =>
            i % Math.max(1, Math.ceil(labels.length / 5)) === 0 ||
            i === labels.length - 1 ? (
              <text
                key={i}
                x={x(i)}
                y="320"
                textAnchor="middle"
                fill="#596476"
                fontSize="10"
              >
                {label.slice(0, 15)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <div className="analyticsLegend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <details className="chartTable">
        <summary>Zaman çizgisi veri tablosu</summary>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Maç / tarih</th>
                {series.map((s) => (
                  <th key={s.label}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, i) => (
                <tr key={i}>
                  <th>
                    {onSelect ? (
                      <button type="button" onClick={() => onSelect(i)}>
                        {label} · {i + 1}. kayıt
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                  {series.map((s) => (
                    <td key={s.label}>{numberLabel(s.values[i])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export type DistributionSlice = { label: string; value: number; color: string };
export function Distribution({
  slices,
  onSelect,
}: {
  slices: DistributionSlice[];
  onSelect?: (index: number) => void;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!slices.length || !total)
    return (
      <p className="empty">
        Gözlenen toplam {slices.length ? "0" : "yok"}; dağılım yüzdesi tanımsız.
      </p>
    );
  return (
    <div className="distributionLayout">
      <svg
        {...chartBase}
        viewBox="0 0 600 360"
        className="analyticsSvg donutSvg"
        role="img"
        aria-label={
          "Toplam " +
          total +
          "; " +
          slices.map((s) => s.label + " " + s.value).join(", ")
        }
      >
        <rect width="600" height="360" fill="#ffffff" />
        {slices.map((slice, i) => {
          const start =
            (slices.slice(0, i).reduce((a, s) => a + s.value, 0) / total) * 360;
          const angle = start + (slice.value / total) * 360;
          const coords = (degrees: number) => [
            300 + 116 * Math.cos(((degrees - 90) * Math.PI) / 180),
            180 + 116 * Math.sin(((degrees - 90) * Math.PI) / 180),
          ];
          const a = coords(start),
            b = coords(angle - 0.001);
          return (
            <path
              key={i + ":" + slice.label}
              d={`M300 180 L${a} A116 116 0 ${angle - start > 180 ? 1 : 0} 1 ${b} Z`}
              fill={slice.color}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={slice.label + " " + slice.value}
              onClick={() => onSelect?.(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(i);
                }
              }}
            >
              <title>{`${slice.label}: ${slice.value} (%${numberLabel((slice.value / total) * 100, 1)})`}</title>
            </path>
          );
        })}
        <circle cx="300" cy="180" r="77" fill="#ffffff" />
        <text x="300" y="179" textAnchor="middle" fill="#151f30" fontSize="32">
          {total}
        </text>
        <text x="300" y="204" textAnchor="middle" fill="#596476" fontSize="12">
          gözlenen toplam
        </text>
      </svg>
      <div className="distributionLegend">
        {slices.map((s, i) => (
          <button
            key={i + ":" + s.label}
            type="button"
            onClick={() => onSelect?.(i)}
            disabled={!onSelect}
          >
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>
              {s.value} · %{numberLabel((s.value / total) * 100, 1)}
            </strong>
          </button>
        ))}
      </div>
    </div>
  );
}
export function ComparisonBars({
  rows,
  left = "LEO XI",
  right = "Rakip",
}: {
  rows: { label: string; a: number | null; b: number | null; unit?: string }[];
  left?: string;
  right?: string;
}) {
  return (
    <div className="comparisonBars">
      <p className="analyticsLegend">
        <span>{left} ●</span>
        <span>{right} ◆</span>
      </p>
      {rows.map((row) => {
        const max = Math.max(1, row.a || 0, row.b || 0);
        return (
          <div className="comparisonBarRow" key={row.label}>
            <strong>
              {numberLabel(row.a)}
              {row.unit}
            </strong>
            <div>
              <span
                style={{
                  width: `${row.a === null ? 0 : (row.a / max) * 100}%`,
                }}
              />
            </div>
            <span>{row.label}</span>
            <div>
              <span
                style={{
                  width: `${row.b === null ? 0 : (row.b / max) * 100}%`,
                }}
              />
            </div>
            <strong>
              {numberLabel(row.b)}
              {row.unit}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

