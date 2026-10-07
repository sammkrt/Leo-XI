'use client';
import {useMemo,useState} from 'react';
import {comparisonSample,deepGroups,deepMetric} from '../lib/club-deep-comparison.mjs';
import type {Match,MatchPlayer} from '../lib/club-types';
type Props={matches:Match[];left:Record<string,unknown>;right:Record<string,unknown>;single?:boolean};
const num=(n:number|null,d=2)=>n===null?'—':n.toLocaleString('tr-TR',{maximumFractionDigits:d});
const roles:Record<string,string>={forward:'Forvet',midfielder:'Orta saha',defender:'Defans',goalkeeper:'Kaleci'};
const day=(n:number)=>new Date(n*1000).toLocaleDateString('tr-TR',{timeZone:'Europe/Amsterdam',day:'2-digit',month:'short'});
const notes:Record<string,string>={
 attack:'Şut isabeti olay sayaçlarından hesaplanır; engellenen şutlar isabetli sayaca dahil olabilir. Gol türleri örtüşebilir; ayrı goller olarak toplanmaz. Bu veriler xG değildir.',
 passing:'Ofsayt pasları genel pas denemesine dahil değildir. İleri pas, mesafe bilgisi olmadan progresif pas olarak yorumlanmaz. Başarılı ve başarısız ortaların duran top kapsamı farklıdır; orta başarı yüzdesi hesaplanmaz. Yön paylarının paydası yalnız yönü sınıflanmış başarılı paslardır.',
 defense:'Müdahaleler, alt türleri, rakipten top alma ve bölgesel top kazanma aynı olayı anlatabilir; tek bir top kazanma toplamı oluşturulmaz. Hava topu deneme sayısı olmadığı için başarı yüzdesi verilmez.',
 possession:'Yalnız bölgesi sınıflanmış top olaylarıdır. Top kayıpları, rakibin golüne neden olan hatalar olarak yorumlanmaz.',
 dribbling:'Tamamlanan dripling sayısı geçilen rakip sayısı değildir. Dribbles carried araştırmadaki etiketiyle gösterilir. Doğrulanmış deneme sayısı olmadığı için dripling başarı yüzdesi verilmez.',
 discipline:'E96 güvenilir bir kırmızı kart eşleştirmesi değildir; bu bölümde kırmızı kart türetilmez. Maç sayıları yalnız oyuncunun kayıtlı maçlarını kapsar.',
 position:'Pozisyon sayaçları oyun içi geri bildirim olaylarıdır; süreyi ya da saha koordinatlarını göstermez. Karar geri bildirimleri doğrulanmış bir karar kalitesi puanına dönüştürülmez.'
};
export default function MatchComparison({matches,left,right,single=false}:Props){
 const [window,setWindow]=useState(single?'10':'all'),[common,setCommon]=useState(false),[position,setPosition]=useState('all'),[group,setGroup]=useState('attack'),[distribution,setDistribution]=useState(false);
 const types=Array.from(new Set(matches.map(m=>m.matchType||'leagueMatch')));
 const [matchType,setMatchType]=useState('leagueMatch');const selectedType=types.includes(matchType)?matchType:types[0]||'leagueMatch';
 const sample=useMemo(()=>comparisonSample(matches,String(left.name),String(right.name),{window,common,position,matchType:selectedType}),[matches,left.name,right.name,window,common,position,selectedType]);
 const active=deepGroups.find(g=>g.id===group)!;
 const names=single?[String(left.proName||left.name)]:[String(left.proName||left.name),String(right.proName||right.name)];
 const rowSets=single?[sample.left]:[sample.left,sample.right];
 const contribution=deepGroups[0].metrics.find(m=>m.id==='contributions')!;
 const summary=(rows:MatchPlayer[])=>deepMetric(rows,contribution);
 return <div className="matchComparison">
  <div className="deepFilters"><label>Maç örneklemi<select value={window} onChange={e=>setWindow(e.target.value)}><option value="all">Tüm kayıtlar</option><option value="5">Son 5 uygun maç</option><option value="10">Son 10 uygun maç</option></select></label><label>Kayıttaki pozisyon<select value={position} onChange={e=>setPosition(e.target.value)}><option value="all">Tüm pozisyonlar</option>{Object.entries(roles).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Maç türü<select value={selectedType} onChange={e=>setMatchType(e.target.value)}>{types.map(type=><option key={type} value={type}>{type==='leagueMatch'?'Lig maçları':type}</option>)}</select></label>{!single&&<label className="commonToggle"><input type="checkbox" checked={common} onChange={e=>setCommon(e.target.checked)}/>Yalnız ortak maçlar</label>}</div>
  <div className="deepCoverage"><strong>{sample.matches.length} uygun maç{!single&&` · ${sample.commonCount} ortak maç`}</strong><span>{names[0]}: {sample.left.length} kayıt{!single&&` · ${names[1]}: ${sample.right.length} kayıt`}</span>{sample.matches.length>0&&<span>{day(sample.matches[sample.matches.length-1].timestamp)} – {day(sample.matches[0].timestamp)}</span>}</div>
  <p className="footnote">{single?'Son 5/10 filtresi, bu oyuncunun seçili pozisyon ve maç türünde oynadığı en yeni kayıtlı maçları seçer.':'Son 5/10 filtresi, seçili pozisyon ve maç türünde oyunculardan en az birinin oynadığı en yeni maçları seçer; ortak maç seçiliyken ikisinin de oynaması gerekir.'} Tüm sezonu temsil etmez.</p>
  <div className="deepTabs" role="tablist" aria-label="Maç istatistiği kategorileri">{deepGroups.map(g=><button key={g.id} id={'deep-tab-'+g.id} role="tab" aria-selected={group===g.id} aria-controls="deep-metrics" className={group===g.id?'chosen':''} onClick={()=>setGroup(g.id)}>{g.label}</button>)}</div>
  <div role="tabpanel" id="deep-metrics" aria-labelledby={'deep-tab-'+group}>
   <p className="deepNote">{notes[group]}</p>
   <label className="distributionToggle"><input type="checkbox" checked={distribution} onChange={e=>setDistribution(e.target.checked)}/>Medyan ve tutarlılığı göster</label>
   <div className="tableWrap"><table className={single?"deepTable playerDeepTable":"deepTable"}><thead><tr><th>GÖSTERGE</th>{names.map((name,i)=><th key={i}>{name}</th>)}</tr></thead><tbody>{active.metrics.map(definition=>{
    const isRate='denominator' in definition;const results=rowSets.map(rows=>deepMetric(rows,definition));return <tr key={definition.id}><th scope="row">{definition.label}</th>{results.map((r,i)=><td key={i}><strong>{num(r.value,isRate?1:0)}{isRate&&r.value!==null?'%':''}</strong>{isRate?<small>{num(r.total,0)} / {num(r.denominator,0)} olay</small>:<small>{num(r.perMatch)} / maç · {num(r.total,0)} toplam</small>}<small className="metricCoverage">{r.covered} / {r.available} maç verisi</small>{r.inconsistent>0&&<small className="amberText">{r.inconsistent} tutarsız kayıt hariç</small>}{distribution&&<small>Medyan {num(r.median)} · Std. sapma {num(r.deviation)}</small>}</td>)}</tr>;
   })}</tbody></table></div>
   {!sample.matches.length&&<p className="empty">Bu filtrelerde uygun kayıtlı maç yok. {single?'Maç örneklemini veya pozisyon filtresini değiştirebilirsin.':'Pozisyon veya ortak maç filtresini değiştirebilirsin.'}</p>}
  </div>
  <section className="deepForm"><h3>Gol + asist · yakın dönem</h3><p className="footnote">{single?'Oyuncunun seçili örneklemdeki en yeni kayıtları kullanılır.':'Seçili örneklemde her oyuncunun kendi en yeni kayıtları kullanılır; bu bölüm aynı maç penceresi anlamına gelmez.'} Sayılar maç başınadır. Yeterli kayıt yoksa mevcut kapsam gösterilir.</p><div className={single?"deepFormGrid playerFormGrid":"deepFormGrid"}>{rowSets.map((rows,i)=>{
   const current=summary(rows.slice(0,5)),previous=summary(rows.slice(5,10)),ten=summary(rows.slice(0,10));const difference=current.perMatch!==null&&previous.perMatch!==null?current.perMatch-previous.perMatch:null;
   return <article key={i}><h4>{names[i]}</h4><dl><div><dt>Son 5 · hareketli ortalama</dt><dd>{num(current.perMatch)}<small>{current.covered} maç</small></dd></div><div><dt>Önceki 5</dt><dd>{num(previous.perMatch)}<small>{previous.covered} maç</small></dd></div><div><dt>Değişim</dt><dd>{difference!==null&&difference>0?'+':''}{num(difference)}<small>gol + asist / maç</small></dd></div><div><dt>Son 10 · hareketli ortalama</dt><dd>{num(ten.perMatch)}<small>{ten.covered} maç</small></dd></div></dl></article>;
  })}</div></section>
  <details className="comparisonRaw"><summary>Hesaplama ve veri kapsamı</summary><p className="footnote">Yüzdeler toplam pay / toplam paydadan hesaplanır; maç yüzdelerinin ortalaması alınmaz. Her gösterge kendi geçerli maç sayısına bölünür. Doğrulanmış olay yanıtında bulunmayan kod sıfırdır; eksik veya bozuk olay yanıtı veri dışıdır. Gol, asist ve şut eşleştirmeleri varsa isimli EA alanlarıyla kontrol edilir. Alt kategoriler toplamı aşarsa fark sıfırlanmaz; ilgili kayıt tutarsız sayılır.</p><p className="footnote">Medyan ve standart sapma maç değerlerinden hesaplanır. Yüzdelerde denemesi olmayan maçlar dağılımdan çıkarılır. Standart sapma küçükse değerler birbirine yakındır; bu bir oyuncu kalitesi puanı değildir. Güvenilir dakika doğrulaması olmadan 90 dakika başına değer üretilmez.</p><p className="footnote">Eşleştirmeler <a href="https://github.com/Interactive-63/eafc-pro-clubs-api-research" target="_blank" rel="noreferrer">topluluk araştırmasına ↗</a> dayanır; resmi EA açıklaması değildir. Ham maç yanıtları kalıcı arşivde korunur. Eski kayıtlar yalnız lig maçı kaynağından alınmıştır.</p></details>
 </div>;
}
