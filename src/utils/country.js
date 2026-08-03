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

export function countryKey(name) {
  return (name || '').trim().toLowerCase();
}

export function extractCountry(location) {
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
