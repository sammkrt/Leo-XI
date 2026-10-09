import specs from '../data/new-award-specs.json' with {type:'json'};
const positive=new Set(['carrying','assassin','vacuum','customs','forward','locksmith','quiet','provoker']);
const negative=new Set(['washing','potato','fouls','toll','backward','stowaway','crypto','asabi','gariban','defense-chaos','attack-chaos','butterfly','grenade','saban']);
export function awardTone(id:string):'positive'|'negative'|'neutral'{
 const spec=specs.cards.find(c=>'new-'+c.id===id);
 if(spec)return spec.category.includes('Övgü')?'positive':'negative';
 return positive.has(id)?'positive':negative.has(id)?'negative':'neutral';
}
