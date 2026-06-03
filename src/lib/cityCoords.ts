// Lat/Lon for known seed cities. Unknown cities are resolved at runtime via
// Nominatim (see geocodeCity) and cached in localStorage.
export const CITY_COORDS: Record<string, [number, number]> = {
  "Barcelona, Spain": [41.3874, 2.1686],
  "Amsterdam, Netherlands": [52.3676, 4.9041],
  "Las Vegas, USA": [36.1699, -115.1398],
  "Miami, USA": [25.7617, -80.1918],
  "San Diego, USA": [32.7157, -117.1611],
  "Berlin, Germany": [52.52, 13.405],
  "Bangkok, Thailand": [13.7563, 100.5018],
  "London, UK": [51.5074, -0.1278],
  "Dubai, UAE": [25.2048, 55.2708],
  "Fort Lauderdale, USA": [26.1224, -80.1373],
  "Lisbon, Portugal": [38.7223, -9.1393],
  // Common extras (avoid a network round-trip for popular venues)
  "New York, USA": [40.7128, -74.006],
  "San Francisco, USA": [37.7749, -122.4194],
  "Los Angeles, USA": [34.0522, -118.2437],
  "Chicago, USA": [41.8781, -87.6298],
  "Boston, USA": [42.3601, -71.0589],
  "Austin, USA": [30.2672, -97.7431],
  "Orlando, USA": [28.5383, -81.3792],
  "Atlanta, USA": [33.749, -84.388],
  "Washington, USA": [38.9072, -77.0369],
  "Seattle, USA": [47.6062, -122.3321],
  "Denver, USA": [39.7392, -104.9903],
  "Toronto, Canada": [43.6532, -79.3832],
  "Paris, France": [48.8566, 2.3522],
  "Madrid, Spain": [40.4168, -3.7038],
  "Munich, Germany": [48.1351, 11.582],
  "Frankfurt, Germany": [50.1109, 8.6821],
  "Hamburg, Germany": [53.5511, 9.9937],
  "Cologne, Germany": [50.9375, 6.9603],
  "Rome, Italy": [41.9028, 12.4964],
  "Milan, Italy": [45.4642, 9.19],
  "Zurich, Switzerland": [47.3769, 8.5417],
  "Geneva, Switzerland": [46.2044, 6.1432],
  "Vienna, Austria": [48.2082, 16.3738],
  "Stockholm, Sweden": [59.3293, 18.0686],
  "Copenhagen, Denmark": [55.6761, 12.5683],
  "Oslo, Norway": [59.9139, 10.7522],
  "Helsinki, Finland": [60.1699, 24.9384],
  "Dublin, Ireland": [53.3498, -6.2603],
  "Brussels, Belgium": [50.8503, 4.3517],
  "Warsaw, Poland": [52.2297, 21.0122],
  "Prague, Czech Republic": [50.0755, 14.4378],
  "Tel Aviv, Israel": [32.0853, 34.7818],
  "Singapore, Singapore": [1.3521, 103.8198],
  "Hong Kong, Hong Kong": [22.3193, 114.1694],
  "Tokyo, Japan": [35.6762, 139.6503],
  "Seoul, South Korea": [37.5665, 126.978],
  "Sydney, Australia": [-33.8688, 151.2093],
  "Melbourne, Australia": [-37.8136, 144.9631],
  "Mumbai, India": [19.076, 72.8777],
  "Bengaluru, India": [12.9716, 77.5946],
  "Bangalore, India": [12.9716, 77.5946],
  "New Delhi, India": [28.6139, 77.209],
  "Abu Dhabi, UAE": [24.4539, 54.3773],
  "Riyadh, Saudi Arabia": [24.7136, 46.6753],
  "São Paulo, Brazil": [-23.5505, -46.6333],
  "Mexico City, Mexico": [19.4326, -99.1332],
  "Cape Town, South Africa": [-33.9249, 18.4241],
};

export function coordsFor(city: string, country: string): [number, number] | null {
  return CITY_COORDS[`${city}, ${country}`] ?? null;
}

// ---- Runtime geocoder (browser-only) ----

const CACHE_KEY = "geocodeCache.v1";
const NEGATIVE = "__NONE__";

type CacheShape = Record<string, [number, number] | typeof NEGATIVE>;

function readCache(): CacheShape {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(c: CacheShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota / private mode — ignore */
  }
}

const inflight = new Map<string, Promise<[number, number] | null>>();

export async function geocodeCity(
  city: string,
  country: string,
): Promise<[number, number] | null> {
  const seeded = coordsFor(city, country);
  if (seeded) return seeded;
  if (typeof window === "undefined") return null;

  const key = `${city.trim().toLowerCase()}|${country.trim().toLowerCase()}`;
  const cache = readCache();
  const hit = cache[key];
  if (hit === NEGATIVE) return null;
  if (Array.isArray(hit)) return hit;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const q = encodeURIComponent(`${city}, ${country}`);
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`geocode ${res.status}`);
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      const next = readCache();
      if (data.length === 0) {
        next[key] = NEGATIVE;
        writeCache(next);
        return null;
      }
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      next[key] = coords;
      writeCache(next);
      return coords;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
