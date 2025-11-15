/**
 * Google Places API Integration
 * Handles Text Search, Place Details, and result ranking
 */

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  throw new Error('GOOGLE_PLACES_API_KEY environment variable is required');
}

// ============================================================================
// Types
// ============================================================================

export interface FindCareParams {
  query?: string;
  location?: { lat: number; lng: number } | { city: string };
  radius_km?: number;
  top_k?: number;
  open_now?: boolean;
  min_rating?: number;
}

export interface CareProvider {
  name: string;
  address: string;
  rating: number;
  user_ratings_total: number;
  phone?: string;
  website?: string;
  place_id: string;
  url: string; // Google Maps URL
  types: string[];
  location: {
    lat: number;
    lng: number;
  };
}

// ============================================================================
// Specialization Mapping
// ============================================================================

/**
 * Map user concerns to provider types for more relevant results
 */
function mapConcernToTypes(query?: string): string[] {
  if (!query) {
    return ['psychologist', 'therapist', 'counselor', 'psychiatrist'];
  }

  const lowerQuery = query.toLowerCase();

  // Medication/prescriptions → psychiatrist
  if (lowerQuery.match(/medicati|prescript|psychiatric|psychiatrist/)) {
    return ['psychiatrist', 'psychiatric'];
  }

  // Couples/relationship → marriage counselor
  if (lowerQuery.match(/couple|marriage|relationship|partner/)) {
    return ['marriage counselor', 'relationship counselor', 'couples therapist'];
  }

  // Grief/loss → bereavement counselor
  if (lowerQuery.match(/grief|bereave|loss|mourning|death/)) {
    return ['bereavement counselor', 'grief counselor', 'therapist'];
  }

  // Substance abuse → addiction specialist
  if (lowerQuery.match(/addiction|substance|alcohol|drug/)) {
    return ['addiction counselor', 'substance abuse counselor'];
  }

  // Child/teen → child psychologist
  if (lowerQuery.match(/child|teen|adolescent|youth|kid/)) {
    return ['child psychologist', 'adolescent therapist', 'family therapist'];
  }

  // Trauma/PTSD → trauma specialist
  if (lowerQuery.match(/trauma|ptsd|abuse|assault/)) {
    return ['trauma therapist', 'ptsd specialist', 'psychologist'];
  }

  // Anxiety/depression → psychologist/therapist
  if (lowerQuery.match(/anxiety|depress|stress|panic|ocd/)) {
    return ['psychologist', 'therapist', 'anxiety specialist'];
  }

  // Default: general mental health providers
  return ['psychologist', 'therapist', 'counselor'];
}

// ============================================================================
// Location Resolution
// ============================================================================

/**
 * Convert city name to coordinates using Google Geocoding API
 */
async function geocodeCity(city: string): Promise<{ lat: number; lng: number }> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', city);
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY!);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.[0]) {
    throw new Error(`Could not geocode location: ${city}`);
  }

  const location = data.results[0].geometry.location;
  return { lat: location.lat, lng: location.lng };
}

// ============================================================================
// Google Places API Calls
// ============================================================================

/**
 * Search for places using Text Search API
 */
async function textSearch(
  query: string,
  location: { lat: number; lng: number },
  radiusMeters: number,
  openNow: boolean = false
): Promise<any[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${location.lat},${location.lng}`);
  url.searchParams.set('radius', radiusMeters.toString());
  url.searchParams.set('type', 'health');
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY!);

  if (openNow) {
    url.searchParams.set('opennow', 'true');
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Places Text Search API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API error: ${data.status} - ${data.error_message || ''}`);
  }

  return data.results || [];
}

/**
 * Get place details including phone, website
 */
async function getPlaceDetails(placeId: string): Promise<any> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set(
    'fields',
    'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,geometry,types,url'
  );
  url.searchParams.set('key', GOOGLE_PLACES_API_KEY!);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Places Details API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error(`Places Details API error: ${data.status}`);
  }

  return data.result;
}

// ============================================================================
// Ranking Logic
// ============================================================================

/**
 * Rank providers by: rating * log(1 + reviews)
 * This balances high ratings with review volume
 */
function rankProviders(providers: CareProvider[]): CareProvider[] {
  return providers
    .map((provider) => {
      const score = provider.rating * Math.log(1 + provider.user_ratings_total);
      return { ...provider, score };
    })
    .sort((a: any, b: any) => b.score - a.score);
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Find mental health care providers
 */
export async function findCareProviders(params: FindCareParams): Promise<CareProvider[]> {
  const {
    query = 'therapist mental health',
    location,
    radius_km = 35,
    top_k = 5,
    open_now = false,
    min_rating = 4.3,
  } = params;

  // Resolve location
  let coords: { lat: number; lng: number };
  if (!location) {
    throw new Error('Location is required (city or lat/lng)');
  }

  if ('city' in location) {
    coords = await geocodeCity(location.city);
  } else {
    coords = location;
  }

  // Map query to provider types
  const providerTypes = mapConcernToTypes(query);
  const radiusMeters = radius_km * 1000;

  // Search for each provider type
  const allResults: any[] = [];
  for (const providerType of providerTypes) {
    try {
      const searchQuery = `${providerType} ${query || ''}`.trim();
      const results = await textSearch(searchQuery, coords, radiusMeters, open_now);
      allResults.push(...results);
    } catch (error) {
      console.error(`Error searching for ${providerType}:`, error);
    }
  }

  // Deduplicate by place_id
  const uniqueResults = Array.from(
    new Map(allResults.map((r) => [r.place_id, r])).values()
  );

  // Filter by minimum rating
  const filtered = uniqueResults.filter(
    (r) => r.rating && r.rating >= min_rating && r.user_ratings_total > 0
  );

  // Fetch details for top candidates
  const providers: CareProvider[] = [];
  for (const result of filtered.slice(0, Math.min(filtered.length, top_k * 2))) {
    try {
      const details = await getPlaceDetails(result.place_id);

      providers.push({
        name: details.name,
        address: details.formatted_address,
        rating: details.rating || 0,
        user_ratings_total: details.user_ratings_total || 0,
        phone: details.formatted_phone_number,
        website: details.website,
        place_id: result.place_id,
        url: details.url || `https://www.google.com/maps/place/?q=place_id:${result.place_id}`,
        types: details.types || [],
        location: {
          lat: details.geometry?.location?.lat || result.geometry?.location?.lat || 0,
          lng: details.geometry?.location?.lng || result.geometry?.location?.lng || 0,
        },
      });
    } catch (error) {
      console.error(`Error fetching details for ${result.place_id}:`, error);
    }
  }

  // Rank and return top_k
  const ranked = rankProviders(providers);
  return ranked.slice(0, top_k);
}

