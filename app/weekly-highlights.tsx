"use client";
import { useMemo, useState, useEffect } from "react";
import WeeklyGhost from "./weekly-ghost";
import {weeklyGhost,weeklyAttendanceRanking} from "../lib/weekly-ghost";
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
  const ghost=useMemo(()=>weeklyGhost(matches,members,now),[matches,members,now]);
  const attendance=useMemo(()=>weeklyAttendanceRanking(matches,members,now),[matches,members,now]);
  return (
    <section className="weeklyHighlights" aria-label="Haftanın kartları">
      <div className="weeklyHeading">
        <h3>Haftanın kartları</h3>
        <span>Son 7 gün · geçici · kayıtlı maçlar</span>
      </div>
      <AwardCards
        report={report}
        compact
        playerOptions={members}
        firstCardPlayers={ghost?.players.map(p=>p.name)||[]}
        firstCard={ghost?<WeeklyGhost candidates={attendance.slice(0,3)} result={ghost} onPlayer={person=>{const member=members.find(m=>m.name===person.name);if(member)onPlayer(member);}}/>:undefined}
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
