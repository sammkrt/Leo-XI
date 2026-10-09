import type {ResearchContext} from './research-types';
import type snapshot from "../data/snapshot.json";

export type Player = (typeof snapshot.members)[number];
type Counter = string | number | null | undefined;

export type MatchPlayer = {
  playername: string;
  pos: string;
  [field: string]: Counter;
};

export type MatchClub = {
  goals?: Counter;
  goalsAgainst?: Counter;
  wins?: Counter;
  ties?: Counter;
  details?: { name?: string; [field: string]: unknown };
  [field: string]: unknown;
};

export type Match = {
  matchId: string;
  timestamp: number;
  matchType?: string;
  // IDs are sparse; enumerable entries in the JSON payload contain actual records.
  clubs: Record<string, MatchClub | undefined>;
  players?: Record<string, Record<string, MatchPlayer | undefined> | undefined>;
  [field: string]: unknown;
};

export type ClubData = {
  research?: ResearchContext;
  club: typeof snapshot.club;
  overall: typeof snapshot.overall;
  members: Player[];
  matches: Match[];
  fetchedAt: string;
  mode: string;
  source: string;
  notice?: string;
  syncFailure?: { code: string; endpoint?: string; at: string };
};

export type MatchFeed = {
  research?: ResearchContext;
  clubId: string;
  matchType: string;
  matches: Match[];
  fetchedAt: string;
};
