// Map common cities to their country for better filtering
const CITY_TO_COUNTRY = {
  'colombo': 'Sri Lanka', 'kandy': 'Sri Lanka', 'galle': 'Sri Lanka', 'jaffna': 'Sri Lanka',
  'bangalore': 'India', 'mumbai': 'India', 'delhi': 'India', 'hyderabad': 'India', 'pune': 'India', 'chennai': 'India', 'kolkata': 'India',
  'london': 'UK', 'manchester': 'UK', 'edinburgh': 'UK', 'birmingham': 'UK',
  'san francisco': 'USA', 'new york': 'USA', 'seattle': 'USA', 'austin': 'USA', 'los angeles': 'USA', 'boston': 'USA', 'chicago': 'USA',
  'toronto': 'Canada', 'vancouver': 'Canada', 'montreal': 'Canada',
  'berlin': 'Germany', 'munich': 'Germany', 'hamburg': 'Germany', 'frankfurt': 'Germany',
  'paris': 'France', 'lyon': 'France',
  'tokyo': 'Japan', 'osaka': 'Japan',
  'sydney': 'Australia', 'melbourne': 'Australia', 'brisbane': 'Australia',
  'beijing': 'China', 'shanghai': 'China', 'shenzhen': 'China', 'hangzhou': 'China',
  'são paulo': 'Brazil', 'rio de janeiro': 'Brazil',
  'amsterdam': 'Netherlands',
  'stockholm': 'Sweden',
  'singapore': 'Singapore',
  'seoul': 'South Korea',
  'tel aviv': 'Israel',
  'istanbul': 'Turkey',
  'lagos': 'Nigeria',
  'nairobi': 'Kenya',
  'cape town': 'South Africa',
  'jakarta': 'Indonesia',
  'bangkok': 'Thailand',
  'kuala lumpur': 'Malaysia',
};

// Canonical names for the same country written differently by GitHub users and
// by the Natural Earth GeoJSON used for the globe polygons (properties.ADMIN).
const COUNTRY_ALIASES = {
  'united states of america': 'USA', 'united states': 'USA', 'usa': 'USA', 'us': 'USA',
  'u.s.': 'USA', 'u.s.a.': 'USA', 'america': 'USA',
  'united kingdom': 'UK', 'great britain': 'UK', 'england': 'UK', 'scotland': 'UK',
  'wales': 'UK', 'northern ireland': 'UK', 'uk': 'UK',
  'republic of korea': 'South Korea', 'korea': 'South Korea',
  'russian federation': 'Russia',
  'czechia': 'Czech Republic',
  "people's republic of china": 'China', 'prc': 'China',
  'republic of india': 'India',
  'deutschland': 'Germany',
  'brasil': 'Brazil',
  'españa': 'Spain', 'espana': 'Spain',
  'the netherlands': 'Netherlands', 'nederland': 'Netherlands', 'holland': 'Netherlands',
  'united arab emirates': 'UAE', 'uae': 'UAE',
  'viet nam': 'Vietnam',
  'islamic republic of iran': 'Iran',
  'united republic of tanzania': 'Tanzania',
  'democratic republic of the congo': 'DR Congo', 'republic of the congo': 'Congo',
  'türkiye': 'Turkey', 'turkiye': 'Turkey',
  'republic of serbia': 'Serbia',
  'bosnia and herzegovina': 'Bosnia',
  'hong kong s.a.r.': 'Hong Kong',
  'macedonia': 'North Macedonia',
};

// Canonical names for common city aliases and alternate spellings.
const CITY_ALIASES = {
  'bangalore': 'Bengaluru',
  'bombay': 'Mumbai',
  'delhi': 'New Delhi',
  'nyc': 'New York',
  'new york city': 'New York',
  'san fran': 'San Francisco',
  'sf': 'San Francisco',
};

export function normalizeCountry(name) {
  if (!name) return '';
  const trimmed = name.trim();
  return COUNTRY_ALIASES[trimmed.toLowerCase()] || trimmed;
}

// Comparable form — use whenever two country names from different sources are matched
export function countryKey(name) {
  return normalizeCountry(name).toLowerCase();
}

export function normalizeCity(name) {
  if (!name) return '';
  const normalized = name.trim().replace(/\s+/g, ' ');
  return CITY_ALIASES[normalized.toLowerCase()] || normalized;
}

// Comparable form — use whenever city names from different locations are matched
export function cityKey(name) {
  return normalizeCity(name).toLowerCase();
}

export function extractCountry(location) {
  if (!location) return '';
  const parts = location.split(/[,\-–]/).map(s => s.trim());
  const lastPart = parts[parts.length - 1];

  // Check if last part is already a recognizable country
  if (lastPart && lastPart.length > 2) {
    // Normalize common abbreviations
    if (/^(US|USA|U\.S\.?A?\.?)$/i.test(lastPart)) return 'USA';
    if (/^(UK|United Kingdom|England|Scotland|Wales)$/i.test(lastPart)) return 'UK';
  }

  // If only one part (just a city), look up in city map
  if (parts.length === 1) {
    const mapped = CITY_TO_COUNTRY[lastPart.toLowerCase()];
    if (mapped) return mapped;
  }

  // Try matching last part against city map (e.g. "Colombo 02, Sri Lanka" → "Sri Lanka")
  const mapped = CITY_TO_COUNTRY[lastPart.toLowerCase()];
  if (mapped) return mapped;

  return lastPart;
}

export function extractCity(location) {
  if (!location) return '';
  const parts = location.split(/[,\-–]/).map(s => s.trim()).filter(Boolean);
  return parts[0] || '';
}
