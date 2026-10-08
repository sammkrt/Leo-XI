import { renderClubhouse } from './route-page';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return renderClubhouse('/', await searchParams);
}
