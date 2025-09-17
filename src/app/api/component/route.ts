import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, Tool } from "ai";
import { z } from "zod";
import { db } from "@/db/client";
import { potentialTrips } from "@/db/schema";
import { eq } from "drizzle-orm";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const streamParam = url.searchParams.get("stream");
    const enableStream = streamParam === "1" || streamParam === "true";

    const data = await request.json().catch(() => ({}));
    const { id: idFromBody, name, destination, budget, origin, startDate, endDate, messages } = (data ?? {}) as {
      id?: number;
      name?: string;
      destination?: string;
      budget?: number | null;
      origin?: string | null;
      startDate?: string;
      endDate?: string;
      messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    };

    let tripId = typeof idFromBody === "number" && Number.isFinite(idFromBody) ? idFromBody : undefined;

    // If no id provided, create a new trip row using provided fields (supports SearchBar flow)
    if (!tripId) {
      const tripName = typeof name === "string" && name.trim().length > 0 ? name.trim() : undefined;
      const destText = typeof destination === "string" && destination.trim().length > 0 ? destination.trim() : undefined;
      if (!destText && !tripName) {
        return new Response(JSON.stringify({ error: "destination or name is required to create a trip" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const insertValues: any = {
        name: tripName || (destText ? `Trip to ${destText}` : "New Trip"),
        destination: destText || "",
        source: "search",
      };
      if (typeof origin === "string" && origin.trim().length > 0) insertValues.origin = origin.trim();
      if (typeof budget === "number" && Number.isFinite(budget)) insertValues.budget = Math.trunc(budget);
      if (typeof startDate === "string" && startDate.trim().length > 0) insertValues.startDate = new Date(startDate);
      if (typeof endDate === "string" && endDate.trim().length > 0) insertValues.endDate = new Date(endDate);

      const inserted = await db.insert(potentialTrips).values(insertValues).returning({ id: potentialTrips.id });
      const row = inserted?.[0];
      if (!row || !row.id) {
        return new Response(JSON.stringify({ error: "Failed to create trip" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      tripId = row.id as number;
    }

    // Load current trip state
    const existingRows = await db
      .select({ id: potentialTrips.id, name: potentialTrips.name, destination: potentialTrips.destination, origin: potentialTrips.origin, budget: potentialTrips.budget, startDate: potentialTrips.startDate, endDate: potentialTrips.endDate })
      .from(potentialTrips)
      .where(eq(potentialTrips.id, tripId as number))
      .limit(1);
    const current = existingRows[0] || null;
    if (!current) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // Deterministic update: persist origin/budget/startDate/endDate if provided directly or via last user message (e.g., "origin: Paris", "budget: 2500", "startDate: 2026-05-01")
    try {
      let originFromMessages: string | undefined;
      let budgetFromMessages: number | undefined;
      let startFromMessages: string | undefined;
      let endFromMessages: string | undefined;
      if (Array.isArray(messages)) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          if (m && m.role === "user" && typeof m.content === "string") {
            const lines = m.content.split(/\n+/);
            for (let j = lines.length - 1; j >= 0; j--) {
              const line = lines[j];
              const match = line.match(/^\s*origin\s*:\s*(.+)\s*$/i);
              if (match && match[1]) {
                originFromMessages = match[1].trim();
                continue;
              }
              const bMatch = line.match(/^\s*budget\s*:\s*\$?\s*(\d+)\s*$/i);
              if (bMatch && bMatch[1]) {
                const val = Number(bMatch[1]);
                if (Number.isFinite(val)) budgetFromMessages = Math.trunc(val);
                continue;
              }
              const sdMatch = line.match(/^\s*startDate\s*:\s*(\d{4}-\d{2}-\d{2})\s*$/i);
              if (sdMatch && sdMatch[1]) {
                startFromMessages = sdMatch[1];
                continue;
              }
              const edMatch = line.match(/^\s*endDate\s*:\s*(\d{4}-\d{2}-\d{2})\s*$/i);
              if (edMatch && edMatch[1]) {
                endFromMessages = edMatch[1];
                continue;
              }
            }
            if (originFromMessages || budgetFromMessages !== undefined || startFromMessages || endFromMessages) break;
          }
        }
      }

      const originCandidate = typeof origin === "string" && origin.trim().length > 0
        ? origin.trim()
        : (originFromMessages && originFromMessages.length > 0 ? originFromMessages : undefined);

      const changes: any = {};
      if (originCandidate && originCandidate !== (current as any).origin) changes.origin = originCandidate;
      const budgetCandidate = typeof budget === "number" && Number.isFinite(budget)
        ? Math.trunc(budget)
        : (typeof budgetFromMessages === "number" ? budgetFromMessages : undefined);
      if (typeof budgetCandidate === "number" && budgetCandidate !== (current.budget ?? null)) changes.budget = budgetCandidate;
      const startCandidate = typeof startDate === "string" && startDate.trim().length > 0
        ? startDate.trim()
        : (startFromMessages && startFromMessages.trim().length > 0 ? startFromMessages : undefined);
      if (typeof startCandidate === "string") changes.startDate = new Date(startCandidate);
      const endCandidate = typeof endDate === "string" && endDate.trim().length > 0
        ? endDate.trim()
        : (endFromMessages && endFromMessages.trim().length > 0 ? endFromMessages : undefined);
      if (typeof endCandidate === "string") changes.endDate = new Date(endCandidate);

      if (Object.keys(changes).length > 0) {
        await db.update(potentialTrips).set(changes).where(eq(potentialTrips.id, tripId as number));
      }
    } catch (_) {
      // ignore and continue; model tool can still reconcile
    }

    // Define a tool to update trip fields
    const updateTripParams = z.object({
      name: z.string().min(1).optional(),
      destination: z.string().min(1).optional(),
      origin: z.string().min(1).optional(),
      budget: z.coerce.number().int().optional(),
      startDate: z.string().optional().describe("YYYY-MM-DD"),
      endDate: z.string().optional().describe("YYYY-MM-DD"),
    });
    type UpdateTripArgs = z.infer<typeof updateTripParams>;

    const updateTripTool: Tool = {
      description: "Update the trips row with any newly available fields.",
      inputSchema: updateTripParams,
      execute: async (args: UpdateTripArgs) => {
        const changes: any = {};
        if (typeof args.name === "string" && args.name.trim().length > 0) changes.name = args.name.trim();
        if (typeof args.destination === "string" && args.destination.trim().length > 0) changes.destination = args.destination.trim();
        if (typeof args.budget === "number" && Number.isFinite(args.budget)) changes.budget = Math.trunc(args.budget);
        if (typeof args.origin === "string" && args.origin.trim().length > 0) changes.origin = args.origin.trim();
        if (typeof args.startDate === "string" && args.startDate.trim().length > 0) changes.startDate = new Date(args.startDate);
        if (typeof args.endDate === "string" && args.endDate.trim().length > 0) changes.endDate = new Date(args.endDate);

        if (Object.keys(changes).length === 0) {
          return { updated: false };
        }

        await db.update(potentialTrips).set(changes).where(eq(potentialTrips.id, tripId as number));
        return { updated: true };
      },
    };

    // Determine obvious differences between provided fields and DB state; pass as hints
    const providedHints = [
      name && name !== current.name ? `name: ${name}` : null,
      destination && destination !== current.destination ? `destination: ${destination}` : null,
      origin && origin !== (current as any).origin ? `origin: ${origin}` : null,
      typeof budget === "number" && budget !== (current.budget ?? null) ? `budget: ${budget}` : null,
      typeof startDate === "string" ? `startDate: ${startDate}` : null,
      typeof endDate === "string" ? `endDate: ${endDate}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Ask the model to call the updateTrip tool if any new info is present in provided data or messages
    try {
      await generateText({
        model: openai("gpt-4o-mini"),
        messages: [
          {
            role: "system",
            content:
              "You reconcile trip fields from user-provided data and prior conversation. If you find any concrete values for name, destination, origin, budget, startDate, endDate that improve the database record, call the updateTrip tool once with those fields. Use ISO YYYY-MM-DD for dates. If nothing new, do not call the tool.",
          },
          { role: "user", content: `Current trip:\nname: ${current.name}\ndestination: ${current.destination}\norigin: ${(current as any).origin ?? ""}\nbudget: ${current.budget ?? ""}\nstartDate: ${current.startDate ?? ""}\nendDate: ${current.endDate ?? ""}` },
          providedHints ? { role: "user", content: `New data provided:\n${providedHints}` } : undefined,
          ...(Array.isArray(messages) ? messages.filter((m) => m && typeof m.role === "string" && typeof m.content === "string") : []),
        ].filter(Boolean) as any,
        tools: { updateTrip: updateTripTool },
        toolChoice: "auto",
        temperature: 0,
        maxOutputTokens: 50,
        experimental_telemetry: { isEnabled: false },
      });
    } catch {
      // Best-effort; continue
    }

    // Reload current state after potential update
    const afterRows = await db
      .select({ id: potentialTrips.id, name: potentialTrips.name, destination: potentialTrips.destination, origin: potentialTrips.origin, budget: potentialTrips.budget, startDate: potentialTrips.startDate, endDate: potentialTrips.endDate })
      .from(potentialTrips)
      .where(eq(potentialTrips.id, tripId as number))
      .limit(1);
    const after = afterRows[0] || current;

    // Short-circuit: if DB now has all key fields (based on schema), reply with Done.
    const hasAllCore =
      typeof after.name === "string" && after.name.trim().length > 0 &&
      typeof after.destination === "string" && after.destination.trim().length > 0 &&
      typeof (after as any).origin === "string" && (after as any).origin.trim().length > 0 &&
      typeof after.budget === "number" && after.budget !== null &&
      after.startDate instanceof Date && !Number.isNaN(after.startDate.getTime()) &&
      after.endDate instanceof Date && !Number.isNaN(after.endDate.getTime());

    if (hasAllCore) {
      // Build three mock flight options based on trip info
      const dep = after.startDate instanceof Date ? after.startDate : new Date();
      const arr = after.endDate instanceof Date ? after.endDate : new Date(dep.getTime() + 3 * 24 * 60 * 60 * 1000);

      function toIsoLocal(date: Date, hour: number, minute: number): string {
        const d = new Date(date.getTime());
        d.setHours(hour, minute, 0, 0);
        return d.toISOString();
      }

      const destinationText = after.destination || "";
      const lowerDest = destinationText.toLowerCase();

      // Realistic airline sets with proper logos (from user's list)
      const airlineSets: Record<string, Array<{ carrier: string; logo: string }>> = {
        france: [
          { carrier: "Air France",   logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Air%20France%20Logo.svg" },
          { carrier: "Transavia",    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Transavia_logo.svg/1280px-Transavia_logo.svg.png" },
          { carrier: "easyJet",      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/EasyJet_logo.svg" },
        ],
        japan: [
          { carrier: "All Nippon Airways", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/All_Nippon_Airways_Logo.svg" },
          { carrier: "Japan Airlines",     logo: "https://en.wikipedia.org/wiki/Special:FilePath/Japan_Airlines_logo_2011.svg" },
          { carrier: "Peach Aviation",     logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Peach_Aviation_Logo.svg" },
        ],
        uk: [
          { carrier: "British Airways",  logo: "https://en.wikipedia.org/wiki/Special:FilePath/British_Airways_Logo.svg" },
          { carrier: "Virgin Atlantic",  logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Virgin_Atlantic_logo_2018.svg" },
          { carrier: "easyJet",          logo: "https://commons.wikimedia.org/wiki/Special:FilePath/EasyJet_logo.svg" },
        ],
        us: [
          { carrier: "Delta Air Lines",   logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Delta_logo.svg" },
          { carrier: "United Airlines",   logo: "https://en.wikipedia.org/wiki/Special:FilePath/United_Airlines_Logo.svg" },
          { carrier: "American Airlines", logo: "https://en.wikipedia.org/wiki/Special:FilePath/American_Airlines_wordmark_(2013).svg" },
        ],
        germany: [
          { carrier: "Lufthansa", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Lufthansa_Logo_2018.svg" },
          { carrier: "Eurowings", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Eurowings_Logo.svg" },
          { carrier: "Condor",    logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Condor_logo_2022.svg" },
        ],
        netherlands: [
          { carrier: "KLM",       logo: "https://commons.wikimedia.org/wiki/Special:FilePath/KLM_logo.svg" },
          { carrier: "Transavia", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Transavia_logo.svg" },
          { carrier: "easyJet",   logo: "https://commons.wikimedia.org/wiki/Special:FilePath/EasyJet_logo.svg" },
        ],
        uae: [
          { carrier: "Emirates",       logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Emirates_logo.svg" },
          { carrier: "Etihad Airways", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Etihad-airways-logo.svg" },
          { carrier: "flydubai",       logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Fly_Dubai_logo_2010_03.svg" },
        ],
        qatar: [
          { carrier: "Qatar Airways", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Qatar_Airways_logo.svg" },
          { carrier: "Qatar Airways", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Qatar_Airways_logo.svg" },
          { carrier: "Qatar Airways", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Qatar_Airways_logo.svg" },
        ],
        singapore: [
          { carrier: "Singapore Airlines", logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Singapore_Airlines_Logo.svg" },
          { carrier: "Scoot",              logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Scoot_logo.svg" },
          { carrier: "Jetstar Asia",       logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Jetstar_logo.svg" },
        ],
      };

      const resolveRegionKey = (ld: string): keyof typeof airlineSets | undefined =>
        ld.includes("france") || ld.includes("paris") ? "france"
        : ld.includes("japan") || ld.includes("tokyo") || ld.includes("osaka") || ld.includes("kyoto") ? "japan"
        : ld.includes("uk") || ld.includes("london") || ld.includes("britain") || ld.includes("england") ? "uk"
        : ld.includes("usa") || ld.includes("united states") || ld.includes("us") || ld.includes("new york") || ld.includes("san francisco") || ld.includes("los angeles") || ld.includes("miami") || ld.includes("chicago") || ld.includes("boston") || ld.includes("seattle") ? "us"
        : ld.includes("germany") || ld.includes("berlin") || ld.includes("munich") || ld.includes("frankfurt") || ld.includes("hamburg") ? "germany"
        : ld.includes("netherlands") || ld.includes("amsterdam") ? "netherlands"
        : ld.includes("uae") || ld.includes("dubai") || ld.includes("abu dhabi") ? "uae"
        : ld.includes("qatar") || ld.includes("doha") ? "qatar"
        : ld.includes("singapore") ? "singapore"
        : undefined;

      const originText = typeof (after as any).origin === "string" ? (after as any).origin : "";
      const originLower = originText.toLowerCase();
      const originKey = resolveRegionKey(originLower);
      const destKey = resolveRegionKey(lowerDest) || "us";

      // Prioritize origin carriers first, then destination carriers, then a fallback to fill up to 3
      const combined: Array<{ carrier: string; logo: string }> = [];
      const seen = new Set<string>();
      const pushUnique = (arr?: Array<{ carrier: string; logo: string }>) => {
        if (!arr) return;
        for (const a of arr) {
          const key = a.carrier.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          combined.push(a);
          if (combined.length >= 6) break; // keep list modest
        }
      };

      if (originKey) pushUnique(airlineSets[originKey]);
      if (destKey) pushUnique(airlineSets[destKey]);
      if (combined.length < 3) pushUnique(airlineSets.us);

      const airlines = combined.length > 0 ? combined : airlineSets.us;

      // IATA codes for carriers (for realistic flight numbers)
      const carrierCodeMap: Record<string, string> = {
        "Air France": "AF",
        "Transavia": "HV",
        "easyJet": "U2",
        "All Nippon Airways": "NH",
        "Japan Airlines": "JL",
        "Peach Aviation": "MM",
        "British Airways": "BA",
        "Virgin Atlantic": "VS",
        "Delta Air Lines": "DL",
        "United Airlines": "UA",
        "American Airlines": "AA",
        "Lufthansa": "LH",
        "Eurowings": "EW",
        "Condor": "DE",
        "KLM": "KL",
        "Emirates": "EK",
        "Etihad Airways": "EY",
        "flydubai": "FZ",
        "Qatar Airways": "QR",
        "Scoot": "TR",
        "Jetstar Asia": "3K",
      };

      // Simple city->primary airport mapping for nicer displays
      const airportMap: Record<string, { code: string; city: string; name: string }> = {
        paris: { code: "CDG", city: "Paris", name: "Charles de Gaulle" },
        london: { code: "LHR", city: "London", name: "Heathrow" },
        tokyo: { code: "HND", city: "Tokyo", name: "Haneda" },
        osaka: { code: "KIX", city: "Osaka", name: "Kansai" },
        kyoto: { code: "KIX", city: "Kyoto", name: "Kansai (via Osaka)" },
        amsterdam: { code: "AMS", city: "Amsterdam", name: "Schiphol" },
        frankfurt: { code: "FRA", city: "Frankfurt", name: "Frankfurt" },
        berlin: { code: "BER", city: "Berlin", name: "Brandenburg" },
        munich: { code: "MUC", city: "Munich", name: "Franz Josef Strauß" },
        dubai: { code: "DXB", city: "Dubai", name: "Dubai Intl" },
        abu: { code: "AUH", city: "Abu Dhabi", name: "Zayed Intl" },
        doha: { code: "DOH", city: "Doha", name: "Hamad Intl" },
        singapore: { code: "SIN", city: "Singapore", name: "Changi" },
        "new york": { code: "JFK", city: "New York", name: "JFK" },
        "los angeles": { code: "LAX", city: "Los Angeles", name: "LAX" },
        "san francisco": { code: "SFO", city: "San Francisco", name: "SFO" },
        miami: { code: "MIA", city: "Miami", name: "MIA" },
        chicago: { code: "ORD", city: "Chicago", name: "O'Hare" },
        boston: { code: "BOS", city: "Boston", name: "Logan" },
        seattle: { code: "SEA", city: "Seattle", name: "Sea-Tac" },
      };

      function resolveAirport(input: string | null | undefined): { code?: string; city?: string; name?: string; label: string } {
        const text = typeof input === "string" ? input.trim() : "";
        if (!text) return { label: "" };
        const ld = text.toLowerCase();
        for (const key of Object.keys(airportMap)) {
          if (ld.includes(key)) {
            const a = airportMap[key];
            return { code: a.code, city: a.city, name: a.name, label: `${a.code} (${a.city})` };
          }
        }
        return { label: text };
      }

      const flights = [0, 1, 2].map((i) => {
        const departAt = toIsoLocal(dep, 9 + i * 2, 0);
        const arriveAt = toIsoLocal(dep, 12 + i * 2, 45);
        const price = 450 + i * 70;
        const carrier = (airlines[i] || airlines[0]).carrier;
        const code = carrierCodeMap[carrier] || carrier.replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase();
        const fnum = `${code}${(200 + i * 7).toString()}`;
        const originApt = resolveAirport((after as any).origin);
        const destApt = resolveAirport(after.destination);
        return {
          type: "flight",
          id: `${tripId}-${i + 1}`,
          carrier,
          carrierLogo: (airlines[i] || airlines[0]).logo,
          flightNumber: fnum,
          origin: originApt.label,
          destination: destApt.label,
          departAt,
          arriveAt,
          durationMinutes: 225 + i * 20,
          price,
          currency: "USD",
          originCity: originApt.city || undefined,
          originCode: originApt.code || undefined,
          originAirportName: originApt.name || undefined,
          destinationCity: destApt.city || undefined,
          destinationCode: destApt.code || undefined,
          destinationAirportName: destApt.name || undefined,
        };
      });

      if (!enableStream) {
        return new Response(
          JSON.stringify({ tripId, components: flights }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const context = `data: ${JSON.stringify({ type: "context", tripId })}\n\n`;
          controller.enqueue(encoder.encode(context));
          for (const f of flights) {
            const line = `data: ${JSON.stringify(f)}\n\n`;
            controller.enqueue(encoder.encode(line));
          }
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    }

    // 1) Ask the model to craft prompts for the still-missing fields (up to 3)
    const PromptsDecisionSchema = z.object({
      prompts: z
        .array(
          z.object({
            field: z.enum(["name", "destination", "origin", "startDate", "endDate", "budget"]),
            question: z.string().min(3),
            inputType: z.enum(["text", "date", "number"]).optional(),
            suggestions: z.array(z.string()).max(5).optional(),
          })
        )
        .max(5)
        .default([]),
    });

    const conversation = Array.isArray(messages)
      ? messages
          .filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")
      : "";

    const { object: decision } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: PromptsDecisionSchema,
      system:
        "You are a UX planner for a travel app. Identify which of these fields are still missing or empty in the database: name, destination, origin, startDate, endDate, budget. Return up to 3 prompts only for the missing ones. Do not duplicate fields or include fields that already exist. For each selected field, write a short, friendly question to collect JUST that field. Provide at most 3–5 concise suggestions. IMPORTANT for dates: suggest only future dates in YYYY-MM-DD, using today or any provided startDate/endDate as reference. Ensure endDate is after startDate.",
      prompt: [
        `DB has -> name: ${after.name} | destination: ${after.destination} | origin: ${(after as any).origin ?? ""} | budget: ${after.budget ?? ""} | startDate: ${after.startDate ?? ""} | endDate: ${after.endDate ?? ""}`,
        name ? `Provided name: ${name}` : null,
        destination ? `Provided destination: ${destination}` : null,
        origin ? `Provided origin: ${origin}` : null,
        typeof budget === "number" ? `Provided budget: $${budget}` : null,
        startDate ? `Provided startDate: ${startDate}` : null,
        endDate ? `Provided endDate: ${endDate}` : null,
        conversation ? `Conversation so far:\n${conversation}` : null,
        "List up to 3 missing fields and provide a question for each.",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.2,
      maxOutputTokens: 200,
      experimental_telemetry: { isEnabled: false },
    });

    // 2) If nothing missing, return a CTA button spec as the only component
    const fieldInputType = (f: string): "text" | "date" | "number" =>
      f === "budget" ? "number" : f === "startDate" || f === "endDate" ? "date" : "text";

    if (!decision || !Array.isArray(decision.prompts) || decision.prompts.length === 0) {
      const ButtonSchema = z.object({
        label: z.string().min(1).max(40),
      });
      const { object: btn } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: ButtonSchema,
        system:
          "You write ultra-short, action-oriented CTA button labels for a travel app. Keep it 2–4 words, imperative voice, no emojis.",
        prompt: [
          after.name ? `Trip name: ${after.name}` : null,
          after.destination ? `Destination: ${after.destination}` : null,
          typeof after.budget === "number" ? `Budget: $${after.budget}` : null,
          "Create a concise CTA label to continue with this trip.",
        ]
          .filter(Boolean)
          .join("\n"),
        temperature: 0.2,
        maxOutputTokens: 60,
        experimental_telemetry: { isEnabled: false },
      });

      const href = typeof tripId === "number" && Number.isFinite(tripId) ? `/trips/${tripId}` : "/trips";
      const classes =
        "px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 text-white";
      const ariaLabel = `Open trip ${after.name ?? after.destination ?? (typeof tripId === "number" ? String(tripId) : "")}`.trim();

      if (!enableStream) {
        return new Response(
          JSON.stringify({
            tripId,
            components: [
              {
                type: "button",
                label: btn.label,
                href,
                classes,
                ariaLabel,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const context = `data: ${JSON.stringify({ type: "context", tripId })}\n\n`;
          controller.enqueue(encoder.encode(context));
          const chunk = `data: ${JSON.stringify({ type: "button", label: btn.label, href, classes, ariaLabel })}\n\n`;
          controller.enqueue(encoder.encode(chunk));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    }

    // 3) Otherwise, return prompt components for each missing field
    const labelFallbackMap: Record<string, string> = {
      name: "What should we call this trip?",
      destination: "Where are you headed?",
      origin: "Where are you departing from?",
      startDate: "When do you want to depart?",
      endDate: "When do you want to return? (optional)",
      budget: "What's your budget? (USD)",
    } as const;

    const missingOnly = (decision.prompts || []).filter((p: any) => {
      switch (p.field) {
        case "name": return !after.name || after.name.trim().length === 0;
        case "destination": return !after.destination || after.destination.trim().length === 0;
        case "origin": return !(after as any).origin || (after as any).origin.trim().length === 0;
        case "budget": return typeof after.budget !== "number" || after.budget === null;
        case "startDate": return !(after.startDate instanceof Date) || Number.isNaN(after.startDate.getTime());
        case "endDate": return !(after.endDate instanceof Date) || Number.isNaN(after.endDate.getTime());
        default: return false;
      }
    });

    function toYMD(date: Date): string {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const now = new Date();
    const providedStart = typeof startDate === "string" && startDate.trim().length > 0 ? new Date(startDate) : undefined;
    const providedEnd = typeof endDate === "string" && endDate.trim().length > 0 ? new Date(endDate) : undefined;
    const startRef = (after.startDate instanceof Date && !Number.isNaN(after.startDate.getTime()))
      ? after.startDate
      : (providedStart && !Number.isNaN(providedStart.getTime()) ? providedStart : now);

    const prompts = missingOnly.slice(0, 3).map((p: any) => {
      const base = {
        type: "prompt" as const,
        field: p.field,
        label:
          typeof p.question === "string" && p.question.trim().length > 0
            ? p.question
            : (labelFallbackMap as any)[p.field] || "Can you add this detail?",
        inputType: (p.inputType as any) || fieldInputType(p.field),
      } as any;

      if (p.field === "startDate") {
        // Suggest future start dates relative to max(today, provided/DB start)
        const ref = startRef.getTime() < now.getTime() ? now : startRef;
        const s1 = new Date(ref.getTime()); s1.setDate(s1.getDate() + 7);
        const s2 = new Date(ref.getTime()); s2.setDate(s2.getDate() + 14);
        const s3 = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
        base.suggestions = [toYMD(s1), toYMD(s2), toYMD(s3)];
      } else if (p.field === "endDate") {
        // Suggest end dates after known/provided start date or today
        const startForEnd = (after.startDate instanceof Date && !Number.isNaN(after.startDate.getTime()))
          ? after.startDate
          : (providedStart && !Number.isNaN(providedStart.getTime()) ? providedStart : now);
        const ref = startForEnd.getTime() < now.getTime() ? now : startForEnd;
        const e1 = new Date(ref.getTime()); e1.setDate(e1.getDate() + 3);
        const e2 = new Date(ref.getTime()); e2.setDate(e2.getDate() + 7);
        const e3 = new Date(ref.getTime()); e3.setDate(e3.getDate() + 14);
        base.suggestions = [toYMD(e1), toYMD(e2), toYMD(e3)];
      } else {
        base.suggestions = Array.isArray(p.suggestions) ? p.suggestions.slice(0, 5) : undefined;
      }

      return base;
    });

    if (!enableStream) {
      return new Response(
        JSON.stringify({ tripId, components: prompts }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const context = `data: ${JSON.stringify({ type: "context", tripId })}\n\n`;
        controller.enqueue(encoder.encode(context));
        for (const p of prompts) {
          const line = `data: ${JSON.stringify(p)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (e) {
    console.error("/api/component POST error", e);
    return new Response(JSON.stringify({ error: "Failed to generate component" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


