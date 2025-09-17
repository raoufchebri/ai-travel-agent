import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { bookings, potentialTrips } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

async function findDestinationImageUrl(city: string): Promise<string | null> {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey || !city) return null;
    const query = encodeURIComponent(`${city} city skyline travel`);
    const url = `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&per_page=1&content_filter=high`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
      // Cache a bit to avoid hammering the API for same city
      next: { revalidate: 60 },
    }).catch(() => null);
    if (!resp || !resp.ok) return null;
    const data = await resp.json().catch(() => null) as any;
    const first = data?.results?.[0];
    let resolved: string | null = first?.urls?.regular || first?.urls?.full || null;
    const appId = process.env.UNSPLASH_APP_ID;
    if (resolved && appId) {
      try {
        const u = new URL(resolved);
        u.searchParams.set("utm_source", appId);
        u.searchParams.set("utm_medium", "referral");
        resolved = u.toString();
      } catch {
        // ignore URL mutation errors
      }
    }
    return resolved;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      tripId,
      carrier,
      flightNumber,
      originCity,
      originCode,
      originAirportName,
      destinationCity,
      destinationCode,
      destinationAirportName,
      departAt,
      arriveAt,
      price,
      currency,
      imageUrl,
    } = body ?? {};

    const errors: string[] = [];
    if (!Number.isFinite(Number(tripId))) errors.push("tripId is required");
    if (!carrier) errors.push("carrier is required");
    if (!flightNumber) errors.push("flightNumber is required");
    if (!originCity || !originCode || !originAirportName) errors.push("origin details are required");
    if (!destinationCity || !destinationCode || !destinationAirportName) errors.push("destination details are required");
    if (!departAt || Number.isNaN(new Date(departAt).getTime())) errors.push("departAt must be ISO date");
    if (!arriveAt || Number.isNaN(new Date(arriveAt).getTime())) errors.push("arriveAt must be ISO date");
    if (!Number.isFinite(Number(price))) errors.push("price must be number");

    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const tid = Number(tripId);

    await db.update(potentialTrips).set({ isBooked: true }).where(eq(potentialTrips.id, tid));

    // Prefer provided imageUrl; otherwise fetch from Unsplash by destination city
    let finalImageUrl: string | null = typeof imageUrl === "string" && imageUrl.trim().length > 0 ? imageUrl : null;
    if (!finalImageUrl) {
      finalImageUrl = await findDestinationImageUrl(destinationCity);
    }

    const [inserted] = await db.insert(bookings).values({
      tripId: tid,
      carrier,
      flightNumber,
      originCity,
      originCode,
      originAirportName,
      destinationCity,
      destinationCode,
      destinationAirportName,
      departAt: new Date(departAt),
      arriveAt: new Date(arriveAt),
      price: Math.trunc(Number(price)),
      currency: typeof currency === "string" && currency.trim().length > 0 ? currency : "USD",
      imageUrl: finalImageUrl,
    }).returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}


export async function GET() {
  try {
    const results = await db
      .select({
        id: bookings.id,
        tripId: bookings.tripId,
        carrier: bookings.carrier,
        flightNumber: bookings.flightNumber,
        originCity: bookings.originCity,
        originCode: bookings.originCode,
        originAirportName: bookings.originAirportName,
        destinationCity: bookings.destinationCity,
        destinationCode: bookings.destinationCode,
        destinationAirportName: bookings.destinationAirportName,
        departAt: bookings.departAt,
        arriveAt: bookings.arriveAt,
        price: bookings.price,
        currency: bookings.currency,
        imageUrl: bookings.imageUrl,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .orderBy(desc(bookings.createdAt))
      .limit(8);

    return NextResponse.json({ bookings: results }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
