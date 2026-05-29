/**
 * Maidenhead grid locator → latitude/longitude.
 * Supports 4, 6 or 8 character locators (e.g. JO67, JO67bp, JO67bp12).
 * Returns the center of the grid square. Returns null for invalid input.
 *
 * Format:
 *  - chars 1-2: field, A-R (lon 20°, lat 10°)
 *  - chars 3-4: square, 0-9 (lon 2°, lat 1°)
 *  - chars 5-6: subsquare, A-X (lon 5', lat 2.5')
 *  - chars 7-8: extended square, 0-9 (lon 30", lat 15")
 */
export function maidenheadToLatLon(grid: string): { lat: number; lon: number } | null {
  if (!grid) return null;
  const g = grid.trim();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/i.test(g)) return null;
  const len = g.length;
  if (len !== 4 && len !== 6 && len !== 8) return null;

  const u = g.toUpperCase();
  const A = "A".charCodeAt(0);
  const Z0 = "0".charCodeAt(0);

  let lon = (u.charCodeAt(0) - A) * 20 - 180;
  let lat = (u.charCodeAt(1) - A) * 10 - 90;

  lon += (u.charCodeAt(2) - Z0) * 2;
  lat += (u.charCodeAt(3) - Z0) * 1;

  // Step sizes for current precision level (the unresolved cell size).
  let lonStep = 2;
  let latStep = 1;

  if (len >= 6) {
    // Subsquare uses lowercase by convention, but we already uppercased.
    lon += (u.charCodeAt(4) - A) * (5 / 60);
    lat += (u.charCodeAt(5) - A) * (2.5 / 60);
    lonStep = 5 / 60;
    latStep = 2.5 / 60;
  }
  if (len === 8) {
    lon += (u.charCodeAt(6) - Z0) * (5 / 60 / 10);
    lat += (u.charCodeAt(7) - Z0) * (2.5 / 60 / 10);
    lonStep = 5 / 60 / 10;
    latStep = 2.5 / 60 / 10;
  }

  // Return center of cell.
  return { lat: lat + latStep / 2, lon: lon + lonStep / 2 };
}

export function isValidMaidenhead(grid: string): boolean {
  return maidenheadToLatLon(grid) != null;
}
