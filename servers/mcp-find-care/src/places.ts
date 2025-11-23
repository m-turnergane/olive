/**
 * Google Places API (New) v1 Integration
 * Handles Text Search, Nearby Search, Place Details, and result ranking
 */

// ============================================================================
// Configuration
// ============================================================================

// Helper function to get API key (deferred check to allow dotenv to load)
function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY environment variable is required. Please create a .env file with your Google Places API key."
    );
  }
  return key;
}

const PLACES_SEARCH_RADIUS_METERS =
  Number(process.env.PLACES_SEARCH_RADIUS_METERS) || 35000;
const PLACES_MAX_RESULTS = Number(process.env.PLACES_MAX_RESULTS) || 10;
const MAX_PAGES = 3; // Pagination limit

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
  pageToken?: string; // For pagination
}

export interface TextSearchParams {
  reason?: string;
  radiusMeters?: number;
  pageToken?: string;
  location?: { lat: number; lng: number };
}

export interface NearbySearchParams {
  includedTypes?: string[];
  radiusMeters?: number;
  location?: { lat: number; lng: number };
}

export interface PlaceDetailsParams {
  placeId: string;
}

export interface CarePlace {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  lat: number;
  lon: number;
  rating?: number;
  ratingCount?: number;
  mapsUri?: string;
  types: string[];
  distanceMeters?: number;
  score: number;
}

export interface SearchResult {
  places: CarePlace[];
  nextPageToken?: string;
}

export interface GooglePlacesError {
  status: string;
  code: number;
  message: string;
  hint?: string;
}

// Legacy interface for backward compatibility
export interface CareProvider {
  name: string;
  address: string;
  rating: number;
  user_ratings_total: number;
  phone?: string;
  website?: string;
  place_id: string;
  url: string;
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
    return ["psychologist", "therapist", "counselor", "psychiatrist"];
  }

  const lowerQuery = query.toLowerCase();

  // Medication/prescriptions → psychiatrist
  if (lowerQuery.match(/medicati|prescript|psychiatric|psychiatrist/)) {
    return ["psychiatrist", "psychiatric"];
  }

  // Couples/relationship → marriage counselor
  if (lowerQuery.match(/couple|marriage|relationship|partner/)) {
    return [
      "marriage counselor",
      "relationship counselor",
      "couples therapist",
    ];
  }

  // Grief/loss → bereavement counselor
  if (lowerQuery.match(/grief|bereave|loss|mourning|death/)) {
    return ["bereavement counselor", "grief counselor", "therapist"];
  }

  // Substance abuse → addiction specialist
  if (lowerQuery.match(/addiction|substance|alcohol|drug/)) {
    return ["addiction counselor", "substance abuse counselor"];
  }

  // Child/teen → child psychologist
  if (lowerQuery.match(/child|teen|adolescent|youth|kid/)) {
    return ["child psychologist", "adolescent therapist", "family therapist"];
  }

  // Trauma/PTSD → trauma specialist
  if (lowerQuery.match(/trauma|ptsd|abuse|assault/)) {
    return ["trauma therapist", "ptsd specialist", "psychologist"];
  }

  // Anxiety/depression → psychologist/therapist
  if (lowerQuery.match(/anxiety|depress|stress|panic|ocd/)) {
    return ["psychologist", "therapist", "anxiety specialist"];
  }

  // Default: general mental health providers
  return ["psychologist", "therapist", "counselor"];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate ranking score for a place
 * score = w1 * normalizedRating + w2 * log1p(ratingCount) + w3 * distancePenalty
 */
function calculateScore(
  rating: number | undefined,
  ratingCount: number | undefined,
  distanceMeters: number | undefined,
  radiusMeters: number,
  name: string,
  types: string[]
): number {
  const w1 = 0.5;
  const w2 = 0.3;
  const w3 = 0.2;

  const normalizedRating = (rating || 0) / 5;
  const logRatingCount = Math.log1p(ratingCount || 0);
  const distancePenalty = distanceMeters
    ? 1 - Math.min(distanceMeters / radiusMeters, 1)
    : 0;

  let score =
    w1 * normalizedRating + w2 * logRatingCount + w3 * distancePenalty;

  // Boost score if name/types include mental health keywords
  const mentalHealthKeywords = /therapy|counsel|psycholog|psychiatr|mental/i;
  const hasKeyword =
    mentalHealthKeywords.test(name) ||
    types.some((type) => mentalHealthKeywords.test(type));

  if (hasKeyword) {
    score += 0.1;
  }

  return score;
}

/**
 * Convert city name to coordinates using Google Geocoding API
 */
async function geocodeCity(
  city: string
): Promise<{ lat: number; lng: number }> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", city);
  url.searchParams.set("key", getApiKey());

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error: GooglePlacesError = {
      status: "GEOCODING_ERROR",
      code: response.status,
      message: `Geocoding API error: ${response.status}`,
      hint: "Check your API key and ensure Geocoding API is enabled",
    };
    throw error;
  }

  const data = await response.json();
  if (data.status !== "OK" || !data.results?.[0]) {
    const error: GooglePlacesError = {
      status: data.status || "GEOCODING_FAILED",
      code: 400,
      message: `Could not geocode location: ${city}`,
      hint: "Provide a valid city name or use lat/lng coordinates",
    };
    throw error;
  }

  const location = data.results[0].geometry.location;
  return { lat: location.lat, lng: location.lng };
}

// ============================================================================
// Google Places API (New) v1 Calls
// ============================================================================

/**
 * Normalize a Google Place to CarePlace format
 */
function normalizePlace(
  place: any,
  userLat: number,
  userLon: number,
  radiusMeters: number
): CarePlace {
  const lat = place.location?.latitude || 0;
  const lon = place.location?.longitude || 0;
  const distanceMeters = calculateDistance(userLat, userLon, lat, lon);
  const name = place.displayName?.text || "Unknown";
  const types = place.types || [];
  const rating = place.rating;
  const ratingCount = place.userRatingCount;

  const score = calculateScore(
    rating,
    ratingCount,
    distanceMeters,
    radiusMeters,
    name,
    types
  );

  return {
    id: place.id || "",
    name,
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber,
    website: place.websiteUri,
    lat,
    lon,
    rating,
    ratingCount,
    mapsUri: place.googleMapsUri,
    types,
    distanceMeters,
    score,
  };
}

/**
 * Text Search (New) - Search for places using textQuery
 */
export async function textSearch(
  params: TextSearchParams
): Promise<SearchResult> {
  const {
    reason,
    radiusMeters = PLACES_SEARCH_RADIUS_METERS,
    pageToken,
    location,
  } = params;

  if (!location) {
    const error: GooglePlacesError = {
      status: "INVALID_REQUEST",
      code: 400,
      message: "Location is required for text search",
      hint: "Provide lat/lng coordinates",
    };
    throw error;
  }

  // Build textQuery from reason + mental health keywords
  const baseQuery =
    "therapist OR counselor OR psychologist OR psychiatrist mental health";
  const textQuery = reason ? `${reason} ${baseQuery}` : baseQuery;

  const requestBody: any = {
    textQuery,
    locationBias: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: radiusMeters,
      },
    },
    rankPreference: "POPULARITY",
    openNow: false,
    strictTypeFiltering: false,
    maxResultCount: PLACES_MAX_RESULTS,
  };

  if (pageToken) {
    requestBody.pageToken = pageToken;
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.location,places.types,places.rating,places.userRatingCount,places.googleMapsUri,nextPageToken",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: GooglePlacesError = {
      status: errorData.error?.status || "API_ERROR",
      code: response.status,
      message:
        errorData.error?.message || `Places API error: ${response.status}`,
      hint:
        errorData.error?.status === "INVALID_ARGUMENT"
          ? "Check field mask format and request body structure"
          : "Verify API key and ensure Places API (New) is enabled",
    };
    throw error;
  }

  const data = await response.json();
  const places = (data.places || []).map((place: any) =>
    normalizePlace(place, location.lat, location.lng, radiusMeters)
  );

  return {
    places,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Nearby Search (New) - Search for places near a location
 */
export async function nearbySearch(
  params: NearbySearchParams
): Promise<SearchResult> {
  const {
    includedTypes = ["doctor", "hospital", "psychiatric_hospital"],
    radiusMeters = PLACES_SEARCH_RADIUS_METERS,
    location,
  } = params;

  if (!location) {
    const error: GooglePlacesError = {
      status: "INVALID_REQUEST",
      code: 400,
      message: "Location is required for nearby search",
      hint: "Provide lat/lng coordinates",
    };
    throw error;
  }

  const requestBody = {
    includedTypes,
    locationRestriction: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius: radiusMeters,
      },
    },
    rankPreference: "POPULARITY",
    maxResultCount: PLACES_MAX_RESULTS,
  };

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.location,places.types,places.rating,places.userRatingCount,places.googleMapsUri",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: GooglePlacesError = {
      status: errorData.error?.status || "API_ERROR",
      code: response.status,
      message:
        errorData.error?.message ||
        `Nearby Search API error: ${response.status}`,
      hint: "Verify API key and ensure Places API (New) is enabled",
    };
    throw error;
  }

  const data = await response.json();
  const places = (data.places || []).map((place: any) =>
    normalizePlace(place, location.lat, location.lng, radiusMeters)
  );

  // Filter for mental health related places
  const mentalHealthKeywords = /therapy|counsel|psycholog|psychiatr|mental/i;
  const filteredPlaces = places.filter(
    (place: CarePlace) =>
      mentalHealthKeywords.test(place.name) ||
      place.types.some((type: string) => mentalHealthKeywords.test(type))
  );

  return {
    places: filteredPlaces,
  };
}

/**
 * Place Details (New) - Get detailed information about a specific place
 */
export async function placeDetails(
  params: PlaceDetailsParams
): Promise<CarePlace> {
  const { placeId } = params;

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,location,types,rating,userRatingCount,googleMapsUri,regularOpeningHours",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: GooglePlacesError = {
      status: errorData.error?.status || "API_ERROR",
      code: response.status,
      message:
        errorData.error?.message ||
        `Place Details API error: ${response.status}`,
      hint: "Verify place ID is valid",
    };
    throw error;
  }

  const place = await response.json();
  // For details, we don't have user location, so distance is undefined
  return normalizePlace(place, 0, 0, PLACES_SEARCH_RADIUS_METERS);
}

// ============================================================================
// Ranking & Filtering Logic
// ============================================================================

/**
 * Rank and filter places by score
 */
function rankPlaces(places: CarePlace[], minRating?: number): CarePlace[] {
  let filtered = places;

  // Filter by minimum rating if specified
  if (minRating !== undefined) {
    filtered = filtered.filter(
      (place) => place.rating !== undefined && place.rating >= minRating
    );
  }

  // Sort by score (descending)
  return filtered.sort((a, b) => b.score - a.score);
}

/**
 * Convert CarePlace to legacy CareProvider format
 */
function carePlaceToProvider(place: CarePlace): CareProvider {
  return {
    name: place.name,
    address: place.address,
    rating: place.rating || 0,
    user_ratings_total: place.ratingCount || 0,
    phone: place.phone,
    website: place.website,
    place_id: place.id,
    url:
      place.mapsUri ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        place.name
      )}`,
    types: place.types,
    location: {
      lat: place.lat,
      lng: place.lon,
    },
  };
}

// ============================================================================
// Main Function (Legacy Interface)
// ============================================================================

/**
 * Find mental health care providers (legacy interface for backward compatibility)
 * Returns just the providers array (for backward compatibility)
 */
export async function findCareProviders(
  params: FindCareParams
): Promise<CareProvider[]> {
  const result = await findCareProvidersWithMetadata(params);
  return result.providers;
}

/**
 * Find mental health care providers with metadata (geocoded location, etc.)
 */
export async function findCareProvidersWithMetadata(
  params: FindCareParams
): Promise<{
  providers: CareProvider[];
  geocoded_location?: { lat: number; lng: number };
}> {
  const {
    query = "therapist mental health",
    location,
    radius_km = 35,
    top_k = 5,
    min_rating = 4.3,
    pageToken,
  } = params;

  // Resolve location
  let coords: { lat: number; lng: number };
  let wasGeocoded = false;

  if (!location) {
    const error: GooglePlacesError = {
      status: "INVALID_REQUEST",
      code: 400,
      message: "Location is required (city or lat/lng)",
      hint: 'Provide location as { city: "City, State" } or { lat: number, lng: number }',
    };
    throw error;
  }

  if ("city" in location) {
    coords = await geocodeCity(location.city);
    wasGeocoded = true;
  } else {
    coords = location;
  }

  const radiusMeters = radius_km * 1000;

  // Use new Text Search API
  const searchResult = await textSearch({
    reason: query,
    radiusMeters,
    pageToken,
    location: coords,
  });

  // Rank and filter
  const ranked = rankPlaces(searchResult.places, min_rating);

  // Convert to legacy format
  const providers = ranked.slice(0, top_k).map(carePlaceToProvider);

  return {
    providers,
    geocoded_location: wasGeocoded ? coords : undefined,
  };
}

/**
 * Find care providers with pagination support
 */
export async function findCareProvidersWithPagination(
  params: FindCareParams
): Promise<{ providers: CareProvider[]; nextPageToken?: string }> {
  const {
    query = "therapist mental health",
    location,
    radius_km = 35,
    top_k = 5,
    min_rating = 4.3,
    pageToken,
  } = params;

  // Resolve location
  let coords: { lat: number; lng: number };
  if (!location) {
    const error: GooglePlacesError = {
      status: "INVALID_REQUEST",
      code: 400,
      message: "Location is required (city or lat/lng)",
      hint: 'Provide location as { city: "City, State" } or { lat: number, lng: number }',
    };
    throw error;
  }

  if ("city" in location) {
    coords = await geocodeCity(location.city);
  } else {
    coords = location;
  }

  const radiusMeters = radius_km * 1000;

  // Use new Text Search API
  const searchResult = await textSearch({
    reason: query,
    radiusMeters,
    pageToken,
    location: coords,
  });

  // Rank and filter
  const ranked = rankPlaces(searchResult.places, min_rating);

  // Convert to legacy format
  const providers = ranked.slice(0, top_k).map(carePlaceToProvider);

  return {
    providers,
    nextPageToken: searchResult.nextPageToken,
  };
}
