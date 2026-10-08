'use client';
import { useMemo } from 'react';
import { weeklyCards } from '../lib/weekly-cards';
import type { Match, Player } from '../lib/club-types';
export default function WeeklyHighlights({matches,members,onPlayer}:{matches:Match[];members:Player[];onPlayer:(player:Player)=>void}) {
  const results = useMemo(() => weeklyCards(matches, members), [matches,members]);
  const cards = [
    { id:'washing', title:'Haftanın Çamaşır Makinesi', icon:'🧺', value:results.washing?.value ?? null, unit:'golsüz şut', players:results.washing?.players || [], empty:'Bu hafta seçilemedi.' },
    { id:'potato', title:'Haftanın Patatesi', icon:'🥔', value:results.potato?.value ?? null, unit:'başarısız pas', players:results.potato?.players || [], empty:'Bu hafta seçilemedi.' },
    { id:'absent', title:'Haftanın En Gayi', icon:'👻', value:results.absent?.value ?? null, unit:'kayıtlı maç', players:results.absent?.players || [], empty:'Henüz kayıtlı maç yok.' },
    { id:'carrying', title:'Haftanın Eşek Yükü', icon:'🎒', value:results.carrying?.value ?? null, unit:'gol + asist', players:results.carrying?.players || [], empty:'Henüz gol + asist kaydı yok.' },
  ];
  return <section className="weeklyHighlights" aria-label="Haftanın kartları">
    <div className="weeklyHeading"><h3>Haftanın kartları</h3><span>Son 7 gün · kayıtlı maçlar</span></div>
    <div className="weeklyCards">{cards.map(card => <article className={'weeklyCard weeklyCard-'+card.id} key={card.id}>
      <span className="weeklyIcon" aria-hidden="true">{card.icon}</span><h4>{card.title}</h4>
      {card.value !== null ? <><div className="weeklyNames">{card.players.map(person => {
        const member = members.find(player => player.name === person.name);
        return member ? <button key={person.name} onClick={()=>onPlayer(member)} title={person.name}>{person.proName}</button> : <span key={person.name}>{person.proName}</span>;
      })}</div><div className="weeklyValue"><strong>{card.value}</strong><span>{card.unit}{card.players.length > 1 ? ' / oyuncu' : ''}</span></div></> : <div className="weeklyEmpty"><strong>—</strong><span>{card.empty}</span></div>}
    </article>)}</div>
    <p className="weeklyNote">Golsüz şut = şut − gol. Başarısız pas = denenen − başarılı pas. Eşitlikte unvan paylaşılır; yalnız kayıtlı maçlar sayılır.</p>
  </section>;
}
