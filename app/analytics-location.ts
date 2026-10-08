"use client";
import { useSyncExternalStore } from "react";
const event = "leo-location-change";
export function readSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(event, callback);
  };
}
export function useLocationSearch() {
  return useSyncExternalStore(subscribe, readSearch, () => "");
}
export function replaceSearch(search: string) {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(event));
}
export function setLocationTab(tab: string) {
  const p = new URLSearchParams(readSearch());
  p.set("leo_tab", tab);
  replaceSearch(p.toString());
}
