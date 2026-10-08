import { buildAwardReport } from "./derived-awards.ts";
import type { AwardOptions, AwardMember } from "./derived-awards.ts";
import type { Match } from "./club-types";
/** Rolling seven-day entry point, distinct from Amsterdam calendar-week awards. */
export function weeklyCards(
  matches: readonly Match[],
  members: readonly AwardMember[],
  now = Date.now(),
  options: AwardOptions = {},
) {
  return buildAwardReport(
    matches.filter(
      (m) =>
        m.timestamp * 1000 >= now - 7 * 86400000 && m.timestamp * 1000 <= now,
    ),
    members,
    {
      ...options,
      history: matches,
      period: "Son 7 gün",
      now,
      allowCasper: true,
    },
  );
}
