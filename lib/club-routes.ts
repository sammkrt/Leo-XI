import { filtersFromSearch, filtersToSearch } from './club-analytics.ts';

export const sectionPaths: Record<string, string> = {
  'Genel bakış': '/',
  'Maçlar': '/maclar',
  'Analiz': '/analiz',
  'Kadro': '/kadro',
  'Takım Laboratuvarı': '/laboratuvar',
  'Rövanş defteri': '/rovans',
  'Karşılaştır': '/karsilastir',
  'Maç gecesi': '/mac-gecesi',
};
const viewPaths: Record<string, string> = {
  team: '', players: 'oyuncular', match: 'mac', session: 'seans',
  compare: 'karsilastir', matrix: 'matris', pairs: 'ikili', development: 'gelisim', titles: 'unvanlar',
};
const filterKeys = [
  'scope', 'view', 'key', 'from', 'to', 'players', 'role', 'result',
  'opponent', 'type', 'minMatches', 'minAttempts', 'gap', 'mode',
  'compare', 'compareFrom', 'compareTo', 'tag',
];

/** Convert readable paths and queries into the filter format used by the model. */
export function routeSearch(pathname: string, search = ''): string | null {
  let parts: string[];
  try { parts = pathname.split('/').filter(Boolean).map(decodeURIComponent); }
  catch { return null; }
  const p = new URLSearchParams(search);
  for (const key of filterKeys) {
    if (p.has(key) && !p.has('leo_' + key)) p.set('leo_' + key, p.get(key)!);
    p.delete(key);
  }
  if (!parts.length) {
    if (!p.has('leo_tab') || !Object.hasOwn(sectionPaths, p.get('leo_tab')!)) p.set('leo_tab', 'Genel bakış');
    return p.toString();
  }
  const tab = Object.entries(sectionPaths).find(([, path]) => path === '/' + parts[0])?.[0];
  if (!tab) return null;
  p.set('leo_tab', tab);
  if (tab !== 'Analiz') return parts.length === 1 ? p.toString() : null;
  if (parts.length > 3) return null;
  const view = parts[1] ? Object.entries(viewPaths).find(([, slug]) => slug === parts[1])?.[0] : 'team';
  if (!view || (parts.length === 3 && view !== 'match' && view !== 'session')) return null;
  p.set('leo_view', view);
  if (view === 'match' || view === 'session') {
    p.set('leo_scope', view);
    if (parts[2]) {
      if (parts[2].includes('/') || (view === 'match' && !/^\d+$/.test(parts[2]))) return null;
      p.set('leo_key', parts[2]);
    }
  }
  return p.toString();
}

/** Canonical page URL. Defaults disappear; resource identifiers belong in paths. */
export function locationFromSearch(search: string): string {
  const original = new URLSearchParams(search);
  const tab = original.get('leo_tab') || 'Genel bakış';
  let path = sectionPaths[tab] || '/';
  const p = new URLSearchParams(filtersToSearch(filtersFromSearch(search), search));
  p.delete('leo_tab');
  if (tab !== 'Analiz') filterKeys.forEach(key => p.delete('leo_' + key));
  if (tab === 'Analiz') {
    const filters = filtersFromSearch(search);
    const view = viewPaths[filters.view];
    if (view) path += '/' + view;
    p.delete('leo_view');
    if ((filters.view === 'match' || filters.view === 'session') && filters.scope === filters.view) {
      p.delete('leo_scope');
      if (filters.key) {
        path += '/' + encodeURIComponent(filters.key);
        p.delete('leo_key');
      }
    }
  }
  const query = new URLSearchParams();
  for (const [key, value] of p) {
    query.append(key.startsWith('leo_') && filterKeys.includes(key.slice(4)) ? key.slice(4) : key, value);
  }
  return path + (query.size ? '?' + query.toString() : '');
}
