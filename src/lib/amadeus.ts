type AccessTokenRecord = {
  token: string;
  expiresAtMs: number;
};

const AMADEUS_BASE =
  process.env.AMADEUS_BASE_URL?.trim() && /^https?:\/\//.test(process.env.AMADEUS_BASE_URL.trim())
    ? process.env.AMADEUS_BASE_URL.trim()
    : process.env.AMADEUS_ENV === "sandbox"
      ? "https://test.api.amadeus.com"
      : "https://api.amadeus.com";

let cachedToken: AccessTokenRecord | null = null;

async function getAccessToken(): Promise<string> {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_SECRET_KEY;
  if (!key || !secret) throw new Error("Amadeus credentials are not configured");

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - 10_000 > now) {
    return cachedToken.token;
  }

  const form = new URLSearchParams();
  form.set("grant_type", "client_credentials");
  form.set("client_id", key);
  form.set("client_secret", secret);

  const resp = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Amadeus auth failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAtMs: Date.now() + Math.max(30_000, (json.expires_in || 0) * 1000),
  };
  return cachedToken.token;
}

async function amadeusGet(path: string, params: Record<string, string | number | undefined>) {
  const token = await getAccessToken();
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "undefined" || v === null) continue;
    search.set(k, String(v));
  }
  const url = `${AMADEUS_BASE}${path}?${search.toString()}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Amadeus GET ${path} failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

export async function findCity(keyword: string): Promise<{ cityCode: string; name: string } | null> {
  const term = (keyword || "").trim();
  const code = term.toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    return { cityCode: code, name: term };
  }
  // Primary: generic locations endpoint filtered to CITY
  try {
    const data = await amadeusGet("/v1/reference-data/locations", {
      keyword: term,
      subType: "CITY",
      "page[limit]": 10,
    });
    const item = Array.isArray(data?.data) ? data.data.find((d: any) => d?.iataCode) : null;
    if (item) return { cityCode: item.iataCode, name: item.name || term };
  } catch {}
  // Fallback: cities-only endpoint
  try {
    const data2 = await amadeusGet("/v1/reference-data/locations/cities", {
      keyword: term,
      "page[limit]": 10,
    });
    const item2 = Array.isArray(data2?.data) ? data2.data.find((d: any) => d?.iataCode) : null;
    if (item2) return { cityCode: item2.iataCode, name: item2.name || term };
  } catch {}
  return null;
}

export async function findAirportForCity(cityKeyword: string): Promise<string | null> {
  const term = (cityKeyword || "").trim();
  const code = term.toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  // Try airports first
  try {
    const data = await amadeusGet("/v1/reference-data/locations", {
      keyword: term,
      subType: "AIRPORT",
      "page[limit]": 10,
    });
    if (Array.isArray(data?.data)) {
      const airport = data.data.find((d: any) => d?.iataCode);
      if (airport?.iataCode) return airport.iataCode;
    }
  } catch {}
  // Fallback to mixed and take airport if any
  try {
    const data2 = await amadeusGet("/v1/reference-data/locations", {
      keyword: term,
      subType: "AIRPORT,CITY",
      "page[limit]": 10,
    });
    if (Array.isArray(data2?.data)) {
      const airport = data2.data.find((d: any) => d?.subType === "AIRPORT" && d?.iataCode);
      if (airport?.iataCode) return airport.iataCode;
      const city = data2.data.find((d: any) => d?.subType === "CITY" && d?.iataCode);
      if (city?.iataCode) return city.iataCode;
    }
  } catch {}
  // Final fallback: city-only lookup
  const city = await findCity(term);
  return city?.cityCode ?? null;
}

export type FlightSearchParams = {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
  adults?: number;
};

export async function searchFlights(params: FlightSearchParams): Promise<any[]> {
  const json = await amadeusGet("/v2/shopping/flight-offers", {
    originLocationCode: params.originLocationCode,
    destinationLocationCode: params.destinationLocationCode,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    adults: params.adults ?? 1,
    currencyCode: "USD",
    max: 5,
  });
  return Array.isArray(json?.data) ? json.data : [];
}

export type HotelSearchParams = {
  cityCode: string;
  checkInDate?: string; // YYYY-MM-DD
  checkOutDate?: string; // YYYY-MM-DD
  adults?: number;
};

export async function searchHotelOffers(params: HotelSearchParams): Promise<any[]> {
  // v3 requires hotelIds; fetch a small set of hotels for the city first
  const hotels = await listHotelsByCity(params.cityCode);
  const ids = (hotels || [])
    .map((h: any) => h?.hotelId || h?.id)
    .filter((id: any) => typeof id === "string")
    .slice(0, 10);
  if (ids.length === 0) return [];
  const json = await amadeusGet("/v3/shopping/hotel-offers", {
    hotelIds: ids.join(","),
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adults: params.adults ?? 1,
    currency: "USD",
  });
  return Array.isArray(json?.data) ? json.data : [];
}

export async function listHotelsByCity(cityCode: string): Promise<any[]> {
  const json = await amadeusGet("/v1/reference-data/locations/hotels/by-city", { cityCode });
  return Array.isArray(json?.data) ? json.data : [];
}

export function summarizeFlights(data: any[]): string {
  if (!data || data.length === 0) return "No flights found.";
  const take = data.slice(0, 2);
  const lines = take.map((offer: any) => {
    const price = offer?.price?.total ?? "?";
    const itineraries = offer?.itineraries ?? [];
    const seg = itineraries[0]?.segments?.[0];
    const carrier = seg?.carrierCode ?? "";
    const dep = seg?.departure?.iataCode ?? "";
    const arr = seg?.arrival?.iataCode ?? "";
    const depTime = seg?.departure?.at?.slice(0, 16)?.replace("T", " ") ?? "";
    return `${carrier} ${dep}→${arr} ${depTime}, $${price}`;
  });
  return lines.join("; ");
}

export function summarizeHotels(data: any[]): string {
  if (!data || data.length === 0) return "No hotels found.";
  const take = data.slice(0, 3);
  const lines = take.map((h: any) => {
    const name = h?.hotel?.name ?? h?.name ?? "Hotel";
    const price = h?.offers?.[0]?.price?.total ?? h?.price ?? "?";
    return `${name}${price ? ` ($${price})` : ""}`;
  });
  return lines.join("; ");
}


