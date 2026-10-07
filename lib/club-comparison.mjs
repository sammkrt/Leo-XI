export const comparisonGroups = [
 {label:'Genel performans',metrics:[['gamesPlayed','Oynanan maç','neutral'],['ratingAve','Ortalama puan','rating'],['winRate','Galibiyet oranı','percent'],['manOfTheMatch','Maçın oyuncusu','count']]},
 {label:'Hücum',metrics:[['goals','Gol','count'],['assists','Asist','count'],['contributions','Gol + asist','count'],['shotSuccessRate','Şut başarısı','percent']]},
 {label:'Pas oyunu',metrics:[['passesMade','Pas sayısı','count'],['passSuccessRate','Pas başarısı','percent']]},
 {label:'Savunma & disiplin',metrics:[['tacklesMade','Müdahale sayısı','count'],['tackleSuccessRate','Müdahale başarısı','percent'],['cleanSheetsDef','Gol yemeden bitirme · defans','count'],['cleanSheetsGK','Gol yemeden bitirme · kaleci','count'],['redCards','Kırmızı kart','count','lower']]},
 {label:'Pro özellikleri',metrics:[['proOverall','Genel reyting','neutral'],['proHeight','Boy','height']]}
];
export function numericField(value){
 if(value===null||value===undefined||typeof value==='boolean'||(typeof value!=='number'&&typeof value!=='string')||String(value).trim()==='')return null;
 const number=Number(value);return Number.isFinite(number)&&number>=0?number:null;
}
export function comparisonValue(player,key,kind,mode='total'){
 let value=key==='contributions'?null:numericField(player[key]);
 if(key==='contributions'){const goals=numericField(player.goals),assists=numericField(player.assists);value=goals!==null&&assists!==null?goals+assists:null;}
 if(value!==null&&kind==='count'&&mode==='perGame'){const games=numericField(player.gamesPlayed);return games!==null&&games>0?value/games:null;}
 return value;
}
export function betterSide(left,right,kind,direction){
 if(left===null||right===null||left===right||kind==='neutral'||kind==='height')return null;
 return (direction==='lower'?left<right:left>right)?'left':'right';
}
