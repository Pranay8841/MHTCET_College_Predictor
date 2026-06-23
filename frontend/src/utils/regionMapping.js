/**
 * Extract and normalize city names from college names.
 * Maharashtra college names typically end with the city after the last comma.
 * 
 * This utility handles the messy real-world data from PDF parsing:
 * - Trailing periods: "Pune." → "Pune"
 * - Dist. prefixes: "Dist. Latur" → "Latur"
 * - Tal. prefixes: "Tal. Haveli" → "Haveli"
 * - ALL CAPS: "NASHIK" → "Nashik"
 * - Compound locations: "Navi Mumbai" kept as-is
 */

/**
 * Normalize a raw city string extracted from a college name.
 * Cleans up common formatting issues from PDF parsing.
 */
function normalizeCity(raw) {
  if (!raw) return 'Other';

  let city = raw.trim();

  // Remove trailing periods
  city = city.replace(/\.+$/, '').trim();

  // Remove leading "Dist.", "Dist-", "District", "Tal.", "Tal-", "Taluka" prefixes
  city = city.replace(/^(?:Dist(?:rict)?[\.\-:\s]+|Tal(?:uka)?[\.\-:\s]+)/i, '').trim();

  // Remove trailing "Dist.*" or "Tal.*" suffixes (e.g., "Pusad Dist. Yavatmal" → "Pusad")
  city = city.replace(/\s+(?:Dist|Tal)[\.\-:\s].*$/i, '').trim();

  // Skip entries that look like pin codes, institution names, or garbage
  if (/^\d+$/.test(city)) return 'Other';
  if (city.length < 2) return 'Other';
  if (/institute|technology|management|group|campus|knowledge city/i.test(city)) return 'Other';

  // Capitalize properly: "NASHIK" → "Nashik", "latur" → "Latur"
  city = city.replace(/\b\w+/g, w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );

  // Apply known corrections for common messy entries
  const CORRECTIONS = {
    'Aurangbad': 'Aurangabad',
    'Chhatrapati Sambhajinagar': 'Chhatrapati Sambhajinagar',
    'Nadurbar': 'Nandurbar',
    'Ichalkaranji': 'Ichalkaranji',
    'Ambejogai': 'Ambajogai',
    'Brambhapuri': 'Brahmapuri',
    'Panvel': 'Panvel',
    'New Panvel': 'Panvel',
    'Kharghar Navi Mumbai': 'Navi Mumbai',
    'Thane (E)': 'Thane',
    'Thane (e)': 'Thane',
    'Badlapur(W)': 'Badlapur',
    'Badlapur(w)': 'Badlapur',
    'Solapur(North)': 'Solapur',
    'Solapur(north)': 'Solapur',
    'Virar(E)': 'Virar',
    'Virar(e)': 'Virar',
  };

  if (CORRECTIONS[city]) {
    city = CORRECTIONS[city];
  }

  return city || 'Other';
}

/**
 * Extract the city from a college name.
 * College names typically end with ", City" or ", City Dist. District".
 */
export function extractCityFromCollegeName(collegeName) {
  if (!collegeName) return 'Other';

  // Split by comma, take the last segment
  const parts = collegeName.split(',');
  if (parts.length < 2) return 'Other';

  const rawCity = parts[parts.length - 1];
  return normalizeCity(rawCity);
}

/**
 * Get unique cities from a list of predictions.
 * Returns sorted array of city names.
 */
export function getCitiesFromPredictions(predictions) {
  const cities = new Set();
  predictions.forEach(p => {
    const city = extractCityFromCollegeName(p.collegeName);
    if (city !== 'Other') cities.add(city);
  });

  // Add "Other" at the end if there are any unmatched colleges
  const hasOther = predictions.some(p => extractCityFromCollegeName(p.collegeName) === 'Other');

  const sorted = Array.from(cities).sort();
  if (hasOther) sorted.push('Other');
  return sorted;
}
