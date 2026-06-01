// Lat/Lon for every seed city. Add new entries when seed data grows.
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
};

export function coordsFor(city: string, country: string): [number, number] | null {
  return CITY_COORDS[`${city}, ${country}`] ?? null;
}
