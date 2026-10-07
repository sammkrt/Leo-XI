import {amsterdamDay} from './club-model.mjs';
import type {Match} from './club-types';

export const RAW_EXPORT_TIMEZONE = 'Europe/Amsterdam';
export type RawExportScope = 'all-time' | 'session' | 'match' | 'week' | 'month';
export type RawExportSelection =
  | {scope: 'all-time'}
  | {scope: Exclude<RawExportScope, 'all-time'>; key: string};
export type RawExportOption = {key: string; label: string; matchCount: number};

const dayLabel = new Intl.DateTimeFormat('tr-TR', {
  timeZone: RAW_EXPORT_TIMEZONE, day: '2-digit', month: 'long', year: 'numeric',
});
const matchTimeLabel = new Intl.DateTimeFormat('tr-TR', {
  timeZone: RAW_EXPORT_TIMEZONE, day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
const monthLabel = new Intl.DateTimeFormat('tr-TR', {
  timeZone: RAW_EXPORT_TIMEZONE, month: 'long', year: 'numeric',
});

// Keep whole records. Unlike analytical filters, export must not require player
// coverage, event counters or other fields that can be absent in archived data.
export function uniqueRawMatches(matches: readonly Match[]): Match[] {
  const byId = new Map<string, Match>();
  for (const match of matches) byId.set(String(match.matchId), match);
  return [...byId.values()].sort((a, b) =>
    b.timestamp - a.timestamp || String(a.matchId).localeCompare(String(b.matchId), 'en'));
}

function calendarWeek(localDay: string): {key: string; monday: Date} {
  // Do civil-date arithmetic in UTC after extracting the Amsterdam date. This
  // avoids DST making a local day shorter/longer than 24 hours.
  const date = new Date(localDay + 'T00:00:00Z');
  const weekday = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - weekday + 1);
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return {key: `${year}-W${String(week).padStart(2, '0')}`, monday};
}

function groupKey(match: Match, scope: Exclude<RawExportScope, 'all-time'>): string {
  if (scope === 'match') return String(match.matchId);
  const day = amsterdamDay(match.timestamp * 1000);
  if (scope === 'session') return day;
  if (scope === 'month') return day.slice(0, 7);
  return calendarWeek(day).key;
}

function optionLabel(match: Match, scope: Exclude<RawExportScope, 'all-time'>): string {
  const date = new Date(match.timestamp * 1000);
  if (scope === 'session') return dayLabel.format(date);
  if (scope === 'month') return monthLabel.format(date);
  if (scope === 'week') {
    const {key, monday} = calendarWeek(amsterdamDay(match.timestamp * 1000));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return `${key} · ${dayLabel.format(monday)} – ${dayLabel.format(sunday)}`;
  }
  const ours = match.clubs['79638'];
  const opponent = Object.entries(match.clubs).find(([id]) => id !== '79638')?.[1];
  // Missing scores stay missing instead of being presented as observed zero.
  return `${matchTimeLabel.format(date)} · ${opponent?.details?.name || 'Rakip'} · ${ours?.goals ?? '—'}:${opponent?.goals ?? ours?.goalsAgainst ?? '—'} · #${match.matchId}`;
}

export function rawExportOptions(matches: readonly Match[], scope: RawExportScope): RawExportOption[] {
  if (scope === 'all-time') return [];
  const options = new Map<string, RawExportOption>();
  for (const match of uniqueRawMatches(matches)) {
    const key = groupKey(match, scope);
    const existing = options.get(key);
    if (existing) existing.matchCount++;
    else options.set(key, {key, label: optionLabel(match, scope), matchCount: 1});
  }
  // Insertion order follows the newest match in each group.
  return [...options.values()];
}

export function selectRawMatches(matches: readonly Match[], selection: RawExportSelection): Match[] {
  const unique = uniqueRawMatches(matches);
  if (selection.scope === 'all-time') return unique;
  return unique.filter(match => groupKey(match, selection.scope) === selection.key);
}

export function createRawExport(matches: readonly Match[], selection: RawExportSelection, exportedAt: string) {
  const selected = selectRawMatches(matches, selection);
  const key = selection.scope === 'all-time' ? '' : selection.key;
  const metadata: Record<string, string> = {};
  if (selection.scope === 'session') metadata.date = key;
  if (selection.scope === 'match') metadata.matchId = key;
  if (selection.scope === 'week') metadata.isoWeek = key;
  if (selection.scope === 'month') metadata.month = key;
  const envelope = {
    exportedAt, timezone: RAW_EXPORT_TIMEZONE, scope: selection.scope,
    selection: metadata, matchCount: selected.length, matches: selected,
  };
  return {
    filename: `leo-xi-raw-${selection.scope}${key ? '-' + key : ''}.json`,
    json: JSON.stringify(envelope, null, 2) + '\n',
  };
}
