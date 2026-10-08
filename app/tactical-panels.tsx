'use client';

import { useMemo, useState } from 'react';
import type { Match } from '../lib/club-types';
import {
 aggregate, bottleneck, dependency, evaluateTrial, playerProfiles, pressMap,
 reference, rematchRecipe, scoreReview, sessions, signalDefinitions, tacticalRows,
 value, type SignalKey, type TacticalExperiment, type TacticalRow,
} from '../lib/tactical-intelligence';

const fmt=(n:number|null|undefined)=>n==null||!Number.isFinite(n)?'—':n.toLocaleString('tr-TR',{maximumFractionDigits:2});
const date=(n:number)=>new Date(n*1000).toLocaleString('tr-TR',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'});
function Sources({ids,onMatch}:{ids:string[];onMatch:(id:string)=>void}){
 return <details className="tiSources"><summary>Kaynak maçlar ({new Set(ids).size})</summary><div>{[...new Set(ids)].map(id=><button key={id} onClick={()=>onMatch(id)}>Maç {id}</button>)}</div></details>;
}
type Point={id:string;label:string;x:number;y:number;size:number;ids:string[];detail:string};
function Scatter({points,xLabel,yLabel,xMid,yMid,onMatch}:{points:Point[];xLabel:string;yLabel:string;xMid?:number|null;yMid?:number|null;onMatch:(id:string)=>void}){
 const [selected,setSelected]=useState<string|null>(null);
 const xMin=Math.min(0,...points.map(p=>p.x)),xMax=Math.max(1,...points.map(p=>p.x));
 const yMin=Math.min(0,...points.map(p=>p.y)),yMax=Math.max(1,...points.map(p=>p.y));
 const padX=Math.max(1,(xMax-xMin)*.08),padY=Math.max(1,(yMax-yMin)*.08);
 const x=(n:number)=>65+((n-xMin+padX)/(xMax-xMin+2*padX))*600;
 const y=(n:number)=>285-((n-yMin+padY)/(yMax-yMin+2*padY))*235;
 // Group screen neighbours rather than altering measured coordinates with jitter.
 const groups=new Map<string,Point[]>();
 for(const p of points){const k=Math.round(x(p.x)/14)+':'+Math.round(y(p.y)/14);groups.set(k,[...(groups.get(k)||[]),p])}
 const active=selected?groups.get(selected):undefined;
 return <div className="tiChart">
 {!points.length?<p className="tiEmpty">Bu grafik için yeterli geçerli veri yok.</p>:<>
 <svg viewBox="0 0 720 355" role="group" aria-label={xLabel+' ve '+yLabel+' dağılımı'}>
  <title>{xLabel+' ve '+yLabel+'; her noktanın ayrıntısına klavye veya dokunmayla erişilebilir.'}</title>
  <rect x="65" y="35" width="600" height="250" rx="12" fill="#f4f6fc"/>
  {[0,.25,.5,.75,1].map(t=><g key={t}><line x1="65" x2="665" y1={285-t*235} y2={285-t*235} stroke="#dce2ee"/><text x="58" y={289-t*235} textAnchor="end">{fmt(yMin-padY+t*(yMax-yMin+2*padY))}</text><text x={65+t*600} y="307" textAnchor="middle">{fmt(xMin-padX+t*(xMax-xMin+2*padX))}</text></g>)}
  {xMid!=null&&<line x1={x(xMid)} x2={x(xMid)} y1="35" y2="285" stroke="#7a83a2" strokeDasharray="5 5"/>}
  {yMid!=null&&<line x1="65" x2="665" y1={y(yMid)} y2={y(yMid)} stroke="#7a83a2" strokeDasharray="5 5"/>}
  <text x="65" y="20">{yLabel}</text><text x="365" y="339" textAnchor="middle">{xLabel}</text>
  {[...groups].map(([key,items])=>{const cx=items.reduce((s,p)=>s+x(p.x),0)/items.length,cy=items.reduce((s,p)=>s+y(p.y),0)/items.length;
   return <g key={key} role="button" tabIndex={0} aria-label={items.map(p=>p.label+': '+fmt(p.x)+', '+fmt(p.y)).join('; ')} onClick={()=>setSelected(key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(key)}}}>
    <circle cx={cx} cy={cy} r={Math.min(17,7+Math.log2(1+items.reduce((s,p)=>s+p.size,0)))} fill={selected===key?'#182361':'#3554d8'} opacity=".8" stroke="white" strokeWidth="2"/>
    <title>{items.map(p=>p.label+' · '+p.detail).join('\n')}</title>
    {items.length>1&&<text x={cx} y={cy+4} textAnchor="middle" fill="white">{items.length}</text>}
   </g>})}
 </svg>
 <p className="footnote">Yakın noktalar sayılı balonda birleşir; seçerek tamamını aç. Kesikli çizgiler belirtilen medyan veya sıfır referansıdır.</p>
 {active&&<div className="tiSelection">{active.map(p=><article key={p.id}><strong>{p.label}</strong><p>{xLabel}: {fmt(p.x)} · {yLabel}: {fmt(p.y)}</p><p>{p.detail}</p><Sources ids={p.ids} onMatch={onMatch}/></article>)}</div>}
 <details><summary>Grafiğin veri tablosu ({points.length})</summary><div className="tiTable"><table><thead><tr><th>Kayıt</th><th>{xLabel}</th><th>{yLabel}</th><th>Kapsam</th></tr></thead><tbody>{points.map(p=><tr key={p.id}><td>{p.label}<Sources ids={p.ids} onMatch={onMatch}/></td><td>{fmt(p.x)}</td><td>{fmt(p.y)}</td><td>{p.detail}</td></tr>)}</tbody></table></div></details>
 </>}
 </div>;
}
function Signal({rows,metric,which='own'}:{rows:TacticalRow[];metric:SignalKey;which?:'own'|'other'}){
 const a=aggregate(rows,metric,which),d=signalDefinitions[metric];
 return <div className="tiStat"><span>{d.label}</span><strong>{fmt(a.value)} <small>{d.unit}</small></strong><small>{a.n} maç · {a.excluded} dışlandı · pay {fmt(a.num)} / payda {fmt(a.den)}</small></div>;
}
export function TacticalPanels({matches,ids,onMatch}:{matches:Match[];ids:string[];onMatch:(id:string)=>void}){
 const all=useMemo(()=>tacticalRows(matches),[matches]);
 const idKey=ids.join(',');
 const rows=useMemo(()=>{const selected=new Set(idKey.split(','));return all.filter(r=>selected.has(r.id))},[all,idKey]);
 const profiles=useMemo(()=>playerProfiles(rows,['noOption','forward']),[rows]),passProfiles=useMemo(()=>playerProfiles(rows,['ambition','adjusted']),[rows]),block=bottleneck(rows),press=pressMap(rows),deps=dependency(rows);
 const [matchId,setMatchId]=useState(''),[gap,setGap]=useState(90);
 const current=rows.find(r=>r.id===matchId)||rows[0],review=current?scoreReview(current,all):null;
 const sequence=sessions(rows,gap);
 const [focus,setFocus]=useState('diagnosis');
 const sections=[['diagnosis','Pas teşhisi'],['passing','Pas beklentisi'],['press','Pres dengesi'],['score','Skor ve oyun'],['dependency','Bağımlılık'],['sessions','Seans ritmi']];
 return <section className="tiArea">
 <div className="tiHeading"><p className="eyebrow">TAKTİK İÇGÖRÜLER</p><h3>Sayıdan takım kararına</h3><p>Kaynak maçları aç, hipotezi incele, bir sonraki maçlarda tek bir değişikliği sına.</p></div>
 <nav className="tiNav" aria-label="Taktik analiz görünümü">{sections.map(([id,label])=><button key={id} aria-pressed={focus===id} onClick={()=>setFocus(id)}>{label}</button>)}</nav>
 {focus==='diagnosis'&&<section className="panel"><h3>Pas hatası mı, seçenek yokluğu mu?</h3><p>{block.message}</p><div className="tiStats">{(['noOption','elsewhere','goodOption','forward'] as SignalKey[]).map(k=><Signal key={k} rows={rows} metric={k}/>)}</div>
 <Scatter points={profiles.flatMap(p=>{const x=p.signals.noOption.value,y=p.signals.forward.value;return x===null||y===null?[]:[{id:p.id,label:p.name,x,y,size:p.passes,ids:p.ids,detail:p.n+' maç · '+p.passes+' pas · '+p.roles.join(', ')+(p.n<3?' · az örneklem':'')}]})} xLabel="Seçenek yok /100 pas" yLabel="İleri pas başarısı (%)" onMatch={onMatch}/>
 <p className="footnote">Grafik oyuncu bazlıdır; teşhis cümlesi ortak geçerli maçların kendi medyanlarına dayanır. Oyun geri bildirimi tüm pozisyonları kapsamaz; bu eksik topsuz hareketin kanıtı değildir. Balon boyutu pas hacmini gösterir.</p><Sources ids={block.ids} onMatch={onMatch}/>
 </section>}
 {focus==='passing'&&<section className="panel"><h3>Güvenli pas yanılsaması</h3><p>İleri oynama tercihini, aynı kayıtlı pozisyondaki pas yönü beklentisine göre sonuçla birlikte oku.</p>
 <Scatter points={passProfiles.flatMap(p=>{const x=p.signals.ambition.value,y=p.signals.adjusted.adjusted;return x===null||y===null?[]:[{id:p.id,label:p.name,x,y,size:p.signals.adjusted.den,ids:p.ids,detail:p.n+' maç · '+p.signals.adjusted.records+' model kaydı · '+p.signals.adjusted.den+' yönü bilinen pas · ham fark '+fmt(p.signals.adjusted.value)+' yp'}]})} xLabel="İleri pas girişim payı (%)" yLabel="Düzeltilmiş beklenti farkı (yp)" yMid={0} onMatch={onMatch}/>
 <details><summary>Referans modeli nasıl çalışıyor?</summary><p>Beklenen başarı = yön başına deneme × aynı pozisyondaki referans oranı. Fark yalnız yönü bilinen paslarda hesaplanır; yön kapsamı en az %80 olmalı. Küçük örneklemde fark n/(n+50) ile sıfıra yaklaştırılır. Bu gösterge gerçek pas zorluğunu veya baskıyı ölçmez.</p><p>Kaynak: topluluk FC27 örneklemi; {reference.rawRows.toLocaleString('tr-TR')} ham, {reference.validRows.toLocaleString('tr-TR')} doğrulanmış kayıt. LEO XI eğitimden dışlandı. Eğitim: {reference.trainingRows.toLocaleString('tr-TR')} kayıt / {reference.trainingMatches} maç; sonraki kontrol grubu: {reference.holdout.rows} kayıt / {reference.holdout.matches} maç. Kontrol grubunda toplu oran farkı: {fmt(reference.holdout.calibrationErrorPP)} yp. Bu, bireysel tahmin doğruluğu değildir.</p><p>Eğitim sonu: {date(reference.trainedThrough)}. Daha eski maçlara model uygulanmaz. Kaynak sürümü: {reference.version}.</p><a href={reference.source} target="_blank" rel="noreferrer">Araştırma kaynağı</a></details>
 </section>}
 {focus==='press'&&<section className="panel"><h3>Pres mi, açık kapı mı?</h3><p>Önde top kazanımının yanında gerideki top kayıplarını birlikte incele. Bölümler kendi maçlarımızın medyanıyla ayrılır.</p>
 <Scatter points={press.rows.map(p=>({id:p.row.id,label:p.row.opponent+' · '+date(p.row.time),x:p.x,y:p.y,size:p.row.own.signals.regain.den,ids:[p.row.id],detail:p.label+' · savunmada kayıp '+p.row.own.signals.loss.num+'/'+p.row.own.signals.loss.den+' · hücumda kazanım '+p.row.own.signals.regain.num+'/'+p.row.own.signals.regain.den+' · ağır pozisyon dışı '+fmt(value(p.row.own.signals.severity))+'% · rakip kayıtlı şut '+fmt(p.row.other.shots)}))} xLabel="Savunma bölgesi kayıp payı (%)" yLabel="Hücum bölgesi kazanım payı (%)" xMid={press.x} yMid={press.y} onMatch={onMatch}/>
 <p className="footnote">{press.excluded} maç kapsam nedeniyle dışlandı. En az 5 maçtan sonra bölge etiketi üretilir. Balon: toplam bölgesel kazanım. Kayıplar ile sonraki şutların olay sırası bilinmiyor; nedensellik kurulmaz.</p></section>}
 {focus==='score'&&<section className="panel"><h3>Skor bizi kandırıyor mu?</h3><label>İncelenecek maç<select value={current?.id||''} onChange={e=>setMatchId(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{date(r.time)} · {r.opponent} · {r.gf}:{r.ga}</option>)}</select></label>
 {!current||!review?<p>Maç kaydı yok.</p>:<><p className="tiVerdict">{current.gf}:{current.ga} · {review.message}</p><div className="tiTable"><table><thead><tr><th>Gösterge</th><th>Bu maç</th><th>Önceki maçların medyanı</th><th>Örneklem</th></tr></thead><tbody>{review.metrics.map(m=><tr key={m.key}><td>{m.label} ({m.unit})</td><td>{fmt(m.current)}</td><td>{fmt(m.normal)}</td><td>{m.n} maç</td></tr>)}</tbody></table></div><p className="footnote">En fazla 20 daha eski maç; her göstergede en az 5 kayıt. Şutlar yalnız iki tarafta da tüm kayıtlı insan oyuncularının verisi geçerliyse gösterilir. Bu maçta insan oyuncu sayısı: {current.own.total} / {current.other.total}. AI şutları kapsanmaz; xG veya hak edilen skor hesaplanmaz.</p><Sources ids={[current.id,...review.ids]} onMatch={onMatch}/></>}
 </section>}
 {focus==='dependency'&&<section className="panel"><h3>Tek kişiye bağımlı mıyız?</h3><p>Üretim ne kadar kişiye yayılıyor? Eşit katkı veren dört oyuncu “4 etkin katkıcı” eder; tek kişide toplanırsa değer 1 olur.</p><div className="tiDependency">{deps.map(d=><article key={d.key}><h4>{d.label}</h4><strong>{fmt(d.effective)} <small>etkin katkıcı</small></strong><p>{d.total} aksiyon · {d.included} tam kapsamlı maç · {d.excluded} dışlandı</p>{d.contributors.map(p=><div className="tiShare" key={p.id}><span>{p.name}</span><meter min={0} max={100} value={p.share*100} aria-label={p.name+' katkı payı'}/><span>%{fmt(p.share*100)} ({p.count})</span></div>)}{!d.total&&<p>Katkı dağılımı için aksiyon yok.</p>}</article>)}</div><p className="footnote">Etkin katkıcı = 1 / Σ(katkı payı²). Az üretim, değişen katılım ve rol dağılımı sonucu etkiler. Bir oyuncunun yokluğundaki etki tahmini değildir.</p><Sources ids={rows.map(r=>r.id)} onMatch={onMatch}/></section>}
 {focus==='sessions'&&<section className="panel"><h3>Bir maç daha mı, mola mı?</h3><label>Yeni seans sayılacak ara<select value={gap} onChange={e=>setGap(Number(e.target.value))}>{[60,90,120].map(n=><option key={n} value={n}>{n} dakika</option>)}</select></label><p>{sequence.groups.length} seans · en az dört maç içeren {sequence.paired.length} seans. İlk iki ile son iki maç karşılaştırılır.</p><div className="tiStats">{sequence.summaries.map(s=><div className="tiStat" key={s.key}><span>{signalDefinitions[s.key].label}</span><strong>{fmt(s.delta)} <small>medyan değişim, yp</small></strong><small>{s.n} geçerli seans · {s.worsened} tanesinde kötüleşti</small><p>{s.n<5?'Tekrarlayan örüntü için en az 5 seans gerekiyor.':s.worsened/s.n>=.7?'Çoğu seansta düşüş var. Kısa molalı seanslarla bir takım deneyi yapın.':'Tutarlı bir düşüş örüntüsü oluşmadı.'}</p></div>)}</div>
 {sequence.paired.map(s=><details key={s.id}><summary>{date(s.rows[0].time)} · {s.rows.length} maç</summary><p>İlk/son kadro benzerliği: %{fmt(s.ownOverlap===null?null:s.ownOverlap*100)} · rakipler: {s.opponents.join(', ')}</p><div className="tiTable"><table><thead><tr><th>Gösterge</th><th>İlk 2</th><th>Son 2</th><th>Fark</th></tr></thead><tbody>{s.changes.map(c=><tr key={c.key}><td>{signalDefinitions[c.key].label}</td><td>{fmt(c.before)}</td><td>{fmt(c.after)}</td><td>{fmt(c.delta)}</td></tr>)}</tbody></table></div><Sources ids={s.rows.map(r=>r.id)} onMatch={onMatch}/></details>)}
 <p className="footnote">Seçili maç kapsamındaki seanslar incelenir; son N filtresi ilk seansı kırpabilir. Yorgunluk veya tilt teşhisi değildir. Rakip/kadro değişimi ve saat etkisi kontrol edilmiş bir deney değildir.</p></section>}
 </section>;
}

export function RematchIntelligence({matches,ids,experiments,onMatch}:{matches:Match[];ids:string[];experiments:TacticalExperiment[];onMatch:(id:string)=>void}){
 const all=useMemo(()=>tacticalRows(matches),[matches]),rows=all.filter(r=>ids.includes(r.id));
 const recipe=rematchRecipe(rows,all);if(!recipe)return null;
 const latest=rows[0],previous=rows[1];
 const trials=previous?experiments.filter(e=>e.start>previous.time&&e.start<=latest.time):[];
 return <section className="panel tiRecipe"><p className="eyebrow">30 SANİYELİK HAZIRLIK</p><h3>Rövanş reçetesi</h3><p className="tiVerdict">{recipe.message}</p>{recipe.changed&&<p className="tiWarning">Rakibin son iki insan kadrosu %50’den az örtüşüyor. Önceki reçetenin aktarılabilirliği düşük olabilir.</p>}<div className="tiStats"><div className="tiStat"><span>Bizim kadro benzerliği</span><strong>%{fmt(recipe.ours===null?null:recipe.ours*100)}</strong></div><div className="tiStat"><span>Rakip kadro benzerliği</span><strong>%{fmt(recipe.theirs===null?null:recipe.theirs*100)}</strong></div><div className="tiStat"><span>İleri pas başarısı: bu rakip / diğerleri</span><strong>{fmt(recipe.own.value)} / {fmt(recipe.normal.value)}</strong><small>{recipe.own.n} / {recipe.normal.n} geçerli maç · fark {fmt(recipe.difference)} yp</small></div></div><h4>Rakibin bize karşı kayıtlı oyun profili</h4><div className="tiStats">{(['inside','ambition','firstTime','regain'] as SignalKey[]).map(k=><Signal key={k} rows={rows} metric={k} which="other"/>)}</div><p className="footnote">Yalnız karşılaşmalarımızdaki kayıtlı insan oyuncularını kapsar. Rakibin genel veya güncel formu olarak sunulmaz.</p><h4>İki karşılaşma arasında başlatılan takım deneyleri</h4>{trials.length?trials.map(ex=><TrialAssessment key={ex.id} experiment={ex} matches={matches} onMatch={onMatch}/>):<p>Bu tarayıcıda bu aralığa ait deney yok.</p>}<Sources ids={[...ids,...recipe.normal.ids]} onMatch={onMatch}/></section>;
}

export function TrialAssessment({experiment,matches,onMatch}:{experiment:TacticalExperiment;matches:Match[];onMatch:(id:string)=>void}){
 const rows=useMemo(()=>tacticalRows(matches),[matches]),result=evaluateTrial(experiment,rows);
 if(!result)return <p className="footnote">Eski deney: önceden kaydedilmiş başarı ölçütü / güvenlik ölçütü yok. Otomatik başarı etiketi verilmez.</p>;
 return <div className="tiTrial"><h4>{experiment.title}</h4><p className="tiVerdict">{result.status} · {result.window.length}/{experiment.target} kayıtlı maç · {result.after.length} ortak geçerli maç</p><div className="tiTable"><table><thead><tr><th>Kontrol</th><th>Ölçüt</th><th>Önce</th><th>Sonra</th><th>Fark / %90 aralık</th></tr></thead><tbody>{([['Uygulandı mı?',result.implementation],['İşe yaradı mı?',result.primary],['Bedeli oldu mu?',result.guardrail]] as const).map(([label,c])=><tr key={label}><td>{label}</td><td>{signalDefinitions[c.key].label}</td><td>{fmt(c.before.value)}</td><td>{fmt(c.current.value)}</td><td>{fmt(c.delta)} yp · {c.interval?fmt(c.interval[0])+' … '+fmt(c.interval[1]):'aralık için en az 5+5 maç'}</td></tr>)}</tbody></table></div><p>Önceden seçilen uygulama yönü: {experiment.plan?.direction===1?'artış':'azalış'} · eşik {experiment.plan?.threshold} yp. Güvenlik ölçütünde aynı büyüklükte kötüleşme olumsuz sinyal sayılır.</p><p>Eşleşen bağlam: {result.matchedBaseline.length} önce / {result.matchedAfter.length} sonra. Aynı rakip ID ve iki takımda da en az %50 insan kadrosu benzerliği. {result.matchedInterval?'Başarı farkı %90 aralığı: '+fmt(result.matchedInterval[0])+' … '+fmt(result.matchedInterval[1])+' yp.':'Eşleşmiş sonuç için veri yetersiz.'}</p><p className="footnote">İlk hedef sayıdaki kayıtlı maç sabittir; eksik maçların yerine sonrakiler seçilmez. Etiket için en az 5+5 ortak geçerli maç ve bitmiş dönem aranır. Aralık maç bazlı bootstrap’tır; ardışık maç bağımlılığı ve seçim etkisini gidermez. Olumlu sinyal nedensel kanıt değildir.</p><Sources ids={[...result.baseline,...result.window].map(r=>r.id)} onMatch={onMatch}/></div>;
}
