import { notFound, permanentRedirect } from 'next/navigation';
import Home from './clubhouse';
import { locationFromSearch, routeSearch } from '../lib/club-routes';
export function renderClubhouse(path: string, values: Record<string,string|string[]|undefined>) {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key,item));
    else if (value !== undefined) query.append(key,value);
  }
  const search = routeSearch(path,query.toString());
  if (search === null) notFound();
  const canonical = locationFromSearch(search);
  if (canonical !== path + (query.size ? '?' + query.toString() : '')) permanentRedirect(canonical);
  return <Home initialSearch={search}/>;
}
