"use client";
import { useMemo, useState, useEffect } from "react";
import { weeklyCards } from "../lib/weekly-cards";
import { AwardCards } from "./team-titles";
import type { Match, Player } from "../lib/club-types";
export default function WeeklyHighlights({
  matches,
  members,
  onPlayer,
  onMatch,
  asOf,
  rosterAsOf,
  research,
}: {
  matches: Match[];
  members: Player[];
  onPlayer: (player: Player) => void;
  onMatch: (id: string) => void;
  asOf: string;
  rosterAsOf: string;
  research?: import("../lib/research-types").ResearchContext;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const report = useMemo(() => {
    return weeklyCards(matches, members, now, { asOf, rosterAsOf, research });
  }, [matches, members, asOf, rosterAsOf, research, now]);
  return (
    <section className="weeklyHighlights" aria-label="Haftanın kartları">
      <div className="weeklyHeading">
        <h3>Haftanın kartları</h3>
        <span>Son 7 gün · geçici · kayıtlı maçlar</span>
      </div>
      <AwardCards
        report={report}
        compact
        onPlayer={(id) => {
          const result = report.results
            .flatMap((r) => r.candidates)
            .find((p) => p.playerId === id);
          const member = members.find((m) => m.name === result?.name);
          if (member) onPlayer(member);
        }}
        onMatch={onMatch}
      />
      <p className="weeklyNote">
        Takım içi geyik; kişisel değerlendirme değil. Kazananı olan tüm kartlar burada.
      </p>
    </section>
  );
}
