declare const __BUILD_ID__: string;

export const BUILD_ID: string = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

const GUARD_KEY = "skinflow:reloaded-for";

/**
 * Reloads the page once when the server runs a newer deploy than this client
 * (Telegram and browsers can keep an old copy of the app open for a long time).
 */
export function reloadIfOutdated(serverBuild: string | null | undefined): boolean {
  if (!serverBuild || serverBuild === BUILD_ID || BUILD_ID.startsWith("dev-") || BUILD_ID === "dev") return false;
  try {
    if (sessionStorage.getItem(GUARD_KEY) === serverBuild) return false; // never loop
    sessionStorage.setItem(GUARD_KEY, serverBuild);
  } catch {
    /* storage blocked: still reload once per page load */
  }
  window.location.reload();
  return true;
}

export async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch("/api/config", { cache: "no-store", credentials: "same-origin" });
    if (res.ok) reloadIfOutdated(((await res.json()) as { build?: string | null }).build);
  } catch {
    /* offline — try again later */
  }
}
