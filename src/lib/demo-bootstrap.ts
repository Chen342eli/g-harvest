import { useEffect } from "react";
import snapshot from "./demo-snapshot.json";

// Bump this version whenever the embedded snapshot changes — every browser
// will re-bootstrap once when the version it last saw is different.
const BOOTSTRAP_FLAG = "grain-radar.demo-bootstrap.v2";

/**
 * On the first visit (per browser, per snapshot version), seed localStorage
 * from the embedded snapshot so anyone opening the published link sees the
 * fully populated workflow instead of an empty shell. Also wipes the older
 * seed flags / v1 keys so the per-store seeders don't immediately overwrite
 * the snapshot with their built-in defaults.
 */
export function useDemoBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(BOOTSTRAP_FLAG)) return;

    // Clean up older bootstrap flag + per-store seed flags so the snapshot wins.
    const stale = [
      "grain-radar.demo-bootstrap.v1",
      "grain-radar.people.v1",
      "grain-radar.people.v1.seeded",
      "grain-radar.people.v2.seeded",
      "grain-harvest.hot-accounts.v1.seeded",
    ];
    for (const k of stale) window.localStorage.removeItem(k);

    // Write the snapshot. Values in the file are already JSON strings — write
    // them verbatim so the stores parse them the same way they wrote them.
    for (const [key, value] of Object.entries(snapshot as Record<string, string>)) {
      window.localStorage.setItem(key, value);
    }
    // Mark per-store seeders as already done so they don't overwrite us.
    window.localStorage.setItem("grain-radar.people.v2.seeded", "1");
    window.localStorage.setItem("grain-harvest.hot-accounts.v1.seeded", "1");

    window.localStorage.setItem(BOOTSTRAP_FLAG, "1");
    // Reload so all useSyncExternalStore caches re-read from the fresh data.
    window.location.reload();
  }, []);
}
