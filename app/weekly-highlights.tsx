"use client";
import { useMemo, useState, useEffect } from "react";
import { replaceSearch } from "./analytics-location";
import { locationFromSearch } from "../lib/club-routes";
import { weeklyCards } from "../lib/weekly-cards";
import { AwardCards } from "./team-titles";
import type { Match, Player } from "../lib/club-types";
const titlesSearch = "leo_tab=Analiz&leo_view=titles&leo_scope=last7";
export default function WeeklyHighlights({
  matches,
  members,
  onPlayer,
  onMatch,
  asOf,
  rosterAsOf,
}: {
  matches: Match[];
  members: Player[];
  onPlayer: (player: Player) => void;
  onMatch: (id: string) => void;
  asOf: string;
  rosterAsOf: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const report = useMemo(() => {
    return weeklyCards(matches, members, now, { asOf, rosterAsOf });
  }, [matches, members, asOf, rosterAsOf, now]);
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
      <a className="awardAllLink" href={locationFromSearch(titlesSearch)} onClick={event => {
        if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          replaceSearch(titlesSearch);
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }}>
        Takımın unvanları →
      </a>
      <p className="weeklyNote">
        LEO XI’ye özel takım içi eğlence endeksleri; başarı yüzdesi veya
        bilimsel oyuncu kalitesi değildir. Eşik, ortak veri ve en az dört uygun
        aday olmadan unvan verilmez. Son 7 gün, takvim haftasından farklıdır.
      </p>
    </section>
  );
}
