import { renderClubhouse } from '../route-page';
export default async function Page({params,searchParams}:{
  params:Promise<{slug:string[]}>;
  searchParams:Promise<Record<string,string|string[]|undefined>>;
}) {
  const {slug} = await params;
  return renderClubhouse('/' + slug.map(encodeURIComponent).join('/'), await searchParams);
}
