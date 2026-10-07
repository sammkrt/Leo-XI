'use client';
import {useMemo,useState} from 'react';
import {eventSummary} from '../lib/club-events.mjs';
import type {Match} from '../lib/club-types';
export default function EventAnalysis({matches,teamId='79638'}:{matches:Match[];teamId?:string}){
 const [selection,setSelection]=useState('all');
 const players=useMemo(()=>{const byId=new Map<string,string>();for(const m of matches)for(const [id,p]of Object.entries(m.players?.[teamId]||{}))byId.set(id,p!.playername||id);return [...byId].sort((a,b)=>a[1].localeCompare(b[1]))},[matches,teamId]);
 const playerId=players.some(([id])=>id===selection)?selection:'all';
 const stats=useMemo(()=>eventSummary(matches,teamId,playerId),[matches,teamId,playerId]);
 const goals=[['Toplam şut',stats.shots],['İsabetli şut',stats.onTarget],['Başarılı dripling',stats.dribbles],['Pas arası',stats.interceptions],['İkinci asist',stats.secondAssists],['Pozisyon uyarısı',stats.outOfPosition]] as const;
 return <section className="eventAnalysis" aria-label="Gelişmiş maç analizi"><div className="sectionHead"><div><p className="eyebrow">KAYITLI MAÇLARDAN</p><h3>Oyunun detayları.</h3></div><label className="analysisSelect">Oyuncu<select aria-label="Analiz oyuncusu" value={playerId} onChange={e=>setSelection(e.target.value)}><option value="all">Takım toplamı</option>{players.map(([id,name])=><option value={id} key={id}>{name}</option>)}</select></label></div>
 <p className="analysisCoverage">{stats.matches} maç · {stats.covered}/{stats.appearances} oyuncu-maç kaydında kullanılabilir olay verisi{stats.covered<stats.appearances?' · Eksik veya uyuşmayan kayıtlar hariç':''}</p>
 {!stats.covered?<p className="empty">Bu seçim için kullanılabilir olay verisi yok.</p>:<><div className="eventStatGrid">{goals.map(([label,value])=><div className="eventStat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
 <div className="eventPassTotal"><span>Olay tabanlı paslar</span><strong>{stats.completed} başarılı <small>/ {stats.failed} hatalı</small></strong></div>
 <div className="eventGrid"><PassBreakdown title="Pas yönü" labels={['İleri','Geri','Yana']} rows={stats.directions} other={stats.directionOther}/><PassBreakdown title="Pas uzunluğu" labels={['Kısa','Orta','Uzun','Orta yapma']} rows={stats.lengths} other={stats.lengthOther}/></div>
 <div className="eventZones"><div className="sectionHead"><div><p className="eyebrow">SAHANIN ÜÇ BÖLGESİ</p><h4>Top kazanma & kaybetme</h4></div><span className="miniTag">Olay sayısı</span></div><div className="zoneGrid">{['Savunma','Orta saha','Hücum'].map((name,i)=><article key={name}><span>{name}</span><div><strong className="greenText">+{stats.won[i]}</strong><strong className="lossText">−{stats.lost[i]}</strong></div><small>Kazanılan / kaybedilen</small></article>)}</div></div></>}
 <details className="analysisMethod"><summary>Veriler nasıl hesaplanıyor?</summary><p>EA maç kayıtlarındaki olay sayaçları, <a href="https://github.com/Interactive-63/eafc-pro-clubs-api-research" target="_blank" rel="noreferrer">topluluk araştırmasının yüksek güvenli eşleştirmeleri ↗</a> ile yorumlanır. Resmî EA tanımları değildir. Gol, asist ve şut eşleştirmeleri varsa adlandırılmış EA alanlarıyla kontrol edilir; uyuşmayan ve bozuk kayıtlar analize alınmaz.</p><p>Pas sayıları ofsayt paslarını dışlar; standart pas tablosundan farklı olabilir. Yön ve uzunluk alt kategorileri her zaman toplamla bire bir örtüşmez. İsabetli şut olayları bloklanan şutları da içerebilir. İkinci asist son pas öncesi katkıyı, pozisyon uyarısı oyun içi uyarı sayısını ifade eder; süre veya kesin saha konumu değildir. Sonuçlar yalnız seçili kayıtların toplamıdır.</p></details>
 </section>;
}
function PassBreakdown({title,labels,rows,other}:{title:string;labels:string[];rows:number[][];other:(number|null)[]}){
 const max=Math.max(1,...rows.map(p=>p[0]+p[1]));
 return <section className="passBreakdown"><h4>{title}</h4><div className="passLegend"><span><i/>Başarılı</span><span><i/>Hatalı</span></div>{labels.map((label,i)=><div className="passRow" key={label}><div><span>{label}</span><strong>{rows[i][0]} <small>/ {rows[i][1]}</small></strong></div><div className="eventBar" aria-hidden="true"><i style={{width:rows[i][0]/max*100+'%'}}/><b style={{width:rows[i][1]/max*100+'%'}}/></div></div>)}<p className="footnote">Sınıflandırılmamış: {other[0]??'—'} / {other[1]??'—'}{other.some(n=>n===null)?' · Alt kategori toplamı pas toplamını aşıyor; bu bölümün kalanı hesaplanamıyor.':''}</p></section>;
}
