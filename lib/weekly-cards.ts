import { periodMatches, uniqueMatches, CLUB_ID } from './club-model.mjs';
import { playerEvents, decodedPlayer } from './club-events.mjs';
import type { Match } from './club-types';
type Member = { name: string; proName: string };
type Totals = { member: Member; games: number; missed: number; missedCoverage: number; failedPasses: number; passCoverage: number; contributions: number; contributionCoverage: number; fouls: number; foulCoverage: number; cards: number; cardCoverage: number };
export type WeeklyCardResult = { players: Member[]; value: number; games: number } | null;
export type WeeklyCards = { washing: WeeklyCardResult; potato: WeeklyCardResult; absent: WeeklyCardResult; carrying: WeeklyCardResult; fouls: WeeklyCardResult; assassin: WeeklyCardResult };
const counter = (value: unknown): number | null => {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const identity = (name: string) => name.trim().toLocaleLowerCase('en-US');
/** Named counters and confirmed event mappings only; missing or contradictory player rows never become invented zeros. */
export function weeklyCards(matches: Match[], members: Member[], now = Date.now()): WeeklyCards {
  const empty: WeeklyCards = { washing: null, potato: null, absent: null, carrying: null, fouls: null, assassin: null };
  const history = uniqueMatches(matches) as Match[];
  const week = periodMatches(history, 'week', now) as Match[];
  if (!week.length || !members.length) return empty;
  const roster = new Map(members.map(member => [identity(member.name), member]));
  const memberIds = new Map<string, Member>();
  // Resolve stable player IDs against the current roster, newest records first.
  for (const match of history) for (const [id, player] of Object.entries(match.players?.[CLUB_ID] || {})) {
    if (!player || memberIds.has(id)) continue;
    const member = roster.get(identity(player.playername || ''));
    if (member) memberIds.set(id, member);
  }
  const rows = new Map<string, Totals>(members.map(member => [identity(member.name), {
    member, games: 0, missed: 0, missedCoverage: 0, failedPasses: 0, passCoverage: 0, contributions: 0, contributionCoverage: 0, fouls: 0, foulCoverage: 0, cards: 0, cardCoverage: 0,
  }]));
  let appearances = 0;
  for (const match of week) {
    const seen = new Set<string>();
    for (const [id, player] of Object.entries(match.players?.[CLUB_ID] || {})) {
      if (!player) continue;
      const member = memberIds.get(id) || roster.get(identity(player.playername || ''));
      if (!member) continue;
      const key = identity(member.name);
      if (seen.has(key)) continue;
      seen.add(key);
      const row = rows.get(key)!;
      row.games++; appearances++;
      const events = decodedPlayer(player) ? playerEvents(player) : null;
      if (events) {
        row.fouls += (events.get(2) || 0) + (events.get(3) || 0);
        row.foulCoverage++;
        const reds = counter(player.redcards);
        if (reds !== null) {
          row.cards += (events.get(95) || 0) + (events.get(213) || 0) + reds;
          row.cardCoverage++;
        }
      }
      const shots = counter(player.shots), goals = counter(player.goals), assists = counter(player.assists);
      const attempts = counter(player.passattempts), completed = counter(player.passesmade);
      if (shots !== null && goals !== null && shots >= goals) { row.missed += shots - goals; row.missedCoverage++; }
      if (attempts !== null && completed !== null && attempts >= completed) { row.failedPasses += attempts - completed; row.passCoverage++; }
      if (goals !== null && assists !== null) { row.contributions += goals + assists; row.contributionCoverage++; }
    }
  }
  if (!appearances) return empty;
  const all = [...rows.values()];
  function most(metric: 'missed' | 'failedPasses' | 'contributions' | 'fouls', coverage: 'missedCoverage' | 'passCoverage' | 'contributionCoverage' | 'foulCoverage'): WeeklyCardResult {
    const eligible = all.filter(row => row.games > 0 && row[coverage] === row.games);
    const value = Math.max(0, ...eligible.map(row => row[metric]));
    if (!value) return null;
    const tied = eligible.filter(row => row[metric] === value);
    return { value, players: tied.map(row => row.member), games: Math.min(...tied.map(row => row.games)) };
  }
  const eligible = all.filter(row => row.games > 0 && row.fouls > 0 && row.foulCoverage === row.games && row.cardCoverage === row.games);
  // Compare pooled weekly fractions exactly; never average per-match ratios.
  let best: Totals | undefined;
  for (const row of eligible) if (!best || BigInt(row.cards) * BigInt(best.fouls) < BigInt(best.cards) * BigInt(row.fouls)) best = row;
  const tied = best ? eligible.filter(row => BigInt(row.cards) * BigInt(best!.fouls) === BigInt(best!.cards) * BigInt(row.fouls)) : [];
  const least = Math.min(...all.map(row => row.games));
  return {
    fouls: most('fouls', 'foulCoverage'),
    assassin: best ? { value: best.cards / best.fouls, games: Math.min(...tied.map(row => row.games)), players: tied.map(row => row.member) } : null,
    washing: most('missed', 'missedCoverage'), potato: most('failedPasses', 'passCoverage'), carrying: most('contributions', 'contributionCoverage'),
    absent: { value: least, games: least, players: all.filter(row => row.games === least).map(row => row.member) },
  };
}
