'use client';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { locationFromSearch, routeSearch } from '../lib/club-routes';
const event = 'leo-location-change';
const InitialSearch = createContext('');
export function LocationProvider({initialSearch,children}:{initialSearch:string;children:ReactNode}) {
  return <InitialSearch.Provider value={initialSearch}>{children}</InitialSearch.Provider>;
}
export function readSearch() {
  return typeof window === 'undefined' ? '' : routeSearch(window.location.pathname, window.location.search) || '';
}
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(event, callback);
  };
}
export function useLocationSearch() {
  const initialSearch = useContext(InitialSearch);
  return useSyncExternalStore(subscribe, readSearch, () => initialSearch);
}
export function replaceSearch(search: string) {
  const target = locationFromSearch(search);
  if (target === window.location.pathname + window.location.search) return;
  window.history.pushState(null, '', target);
  window.dispatchEvent(new Event(event));
}
export function setLocationTab(tab: string) {
  const p = new URLSearchParams(readSearch());
  p.set('leo_tab', tab);
  replaceSearch(p.toString());
}
