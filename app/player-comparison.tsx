'use client';
import {useState} from 'react';
import MatchComparison from './match-comparison';
import {comparisonGroups,comparisonValue,betterSide} from '../lib/club-comparison.mjs';
import type {Match} from '../lib/club-types';
type Member=Record<string,unknown>;
const format=(value:number|null,kind:string,mode:string)=>value===null?'—':value.toLocaleString('tr-TR',{minimumFractionDigits:kind==='rating'?1:kind==='count'&&mode==='perGame'?2:0,maximumFractionDigits:kind==='rating'?1:kind==='count'&&mode==='perGame'?2:2})+(kind==='percent'?'%':kind==='height'?' cm':'');
const raw=(value:unknown)=>value===undefined||value===null?'—':typeof value==='object'?JSON.stringify(value):String(value);
export default function PlayerComparison({left,right,matches}:{left:Member;right:Member;matches:Match[]}){
 const [mode,setMode]=useState('perGame');
 const [source,setSource]=useState('club');
 const keys=Array.from(new Set([...Object.keys(left),...Object.keys(right)])).sort();
 return <div className="expandedComparison">
  <div className="segmented comparisonSource" aria-label="Karşılaştırma veri kaynağı">{[['club','Kulüp toplamları'],['matches','Kayıtlı maçlar']].map(([value,label])=><button key={value} aria-pressed={source===value} className={source===value?'chosen':''} onClick={()=>setSource(value)}>{label}</button>)}</div>
  {source==='matches'?<MatchComparison matches={matches} left={left} right={right}/>:<>
  <div className="comparisonToolbar"><div className="segmented" aria-label="İstatistik görünümü">{[['perGame','Maç başına'],['total','Toplam']].map(([value,label])=><button key={value} aria-pressed={mode===value} className={mode===value?'chosen':''} onClick={()=>setMode(value)}>{label}</button>)}</div><span className="quiet">EA kulüp oyuncu kaydı</span></div>
  <p className="footnote">Kulüp oyuncu toplamlarıdır; tüm sezonun maç arşivi değildir. Maç başına görünümde sayılar oyuncunun oynadığı maç sayısına bölünür. Yüzdeler ve ortalama puan EA yanıtından doğrudan gelir.</p>
  {comparisonGroups.map(group=><section className="comparisonGroup" key={group.label}><h3>{group.label}</h3><div className="comparison">{group.metrics.map(([key,label,kind,direction])=>{
   const av=comparisonValue(left,key,kind,mode),bv=comparisonValue(right,key,kind,mode);const scale=Math.max(av??0,bv??0,1);const better=betterSide(av,bv,kind,direction);
   return <div className="comparisonRow expandedRow" key={key}><div className={better==='left'?'goldText':''}><strong>{format(av,kind,mode)}</strong><span className="bar"><i style={{width:`${(av??0)/scale*100}%`}}/></span></div><span>{label}{kind==='count'&&mode==='perGame'&&<small>maç başına</small>}</span><div className={better==='right'?'goldText':''}><strong>{format(bv,kind,mode)}</strong><span className="bar"><i style={{width:`${(bv??0)/scale*100}%`}}/></span></div></div>;
  })}</div></section>)}
  <p className="footnote">Mavi vurgu daha yüksek değeri gösterir; kırmızı kartta daha düşük değer öne çıkar. Boy, genel reyting ve maç sayısı tarafsız gösterilir. Eksik değer: —. Roller ve maç sayıları farklı olabilir; bu tablo bir oyuncu sıralaması değildir.</p>
  <details className="comparisonRaw"><summary>Ham EA alanları <span>{keys.length} alan</span></summary><p className="footnote">Seçili oyuncuların yanıtındaki tüm alanlar aşağıdadır. proPos, proStyle, proNationality ve prevGoals alanlarının anlamı doğrulanmadığı için kodları aynen gösterilir. prevGoals alanları tarihli maç geçmişi olarak yorumlanmaz.</p><div className="tableWrap"><table><thead><tr><th>EA ALANI</th><th>{raw(left.proName||left.name)}</th><th>{raw(right.proName||right.name)}</th></tr></thead><tbody>{keys.map(key=><tr key={key}><th scope="row">{key}</th><td>{raw(left[key])}</td><td>{raw(right[key])}</td></tr>)}</tbody></table></div></details>
 </>}
 </div>;
}
