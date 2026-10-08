"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
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
      <Link className="awardAllLink" href="/analiz/unvanlar?scope=last7">
        Takımın unvanları →
      </Link>
      <p className="weeklyNote">
        LEO XI’ye özel takım içi eğlence endeksleri; başarı yüzdesi veya
        bilimsel oyuncu kalitesi değildir. Eşik, ortak veri ve en az dört uygun
        aday olmadan unvan verilmez. Son 7 gün, takvim haftasından farklıdır.
      </p>
    </section>
  );
}
