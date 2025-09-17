import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, Tool } from "ai";
import { z } from "zod";
import { db } from "@/db/client";
import { trips } from "@/db/schema";
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

      const inserted = await db.insert(trips).values(insertValues).returning({ id: trips.id });
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
      .select({ id: trips.id, name: trips.name, destination: trips.destination, origin: trips.origin, budget: trips.budget, startDate: trips.startDate, endDate: trips.endDate })
      .from(trips)
      .where(eq(trips.id, tripId as number))
      .limit(1);
    const current = existingRows[0] || null;
    if (!current) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // Deterministic update: persist origin if provided directly or via last user message (e.g., "origin: Paris")
    try {
      let originFromMessages: string | undefined;
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
                break;
              }
            }
            if (originFromMessages) break;
          }
        }
      }

      const originCandidate = typeof origin === "string" && origin.trim().length > 0
        ? origin.trim()
        : (originFromMessages && originFromMessages.length > 0 ? originFromMessages : undefined);

      if (originCandidate && originCandidate !== (current as any).origin) {
        await db.update(trips).set({ origin: originCandidate }).where(eq(trips.id, tripId as number));
      }
    } catch (_) {
      // ignore and continue; model tool can still reconcile
    }

    // Define a tool to update trip fields
    const updateTripParams = z.object({
      name: z.string().min(1).optional(),
      destination: z.string().min(1).optional(),
      origin: z.string().min(1).optional(),
      budget: z.number().int().optional(),
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

        await db.update(trips).set(changes).where(eq(trips.id, tripId as number));
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
      .select({ id: trips.id, name: trips.name, destination: trips.destination, origin: trips.origin, budget: trips.budget, startDate: trips.startDate, endDate: trips.endDate })
      .from(trips)
      .where(eq(trips.id, tripId as number))
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
      const byRegion = lowerDest.includes("france") || lowerDest.includes("paris")
        ? [
            { carrier: "Air France", logo: "/globe.svg" },
            { carrier: "Transavia France", logo: "/globe.svg" },
            { carrier: "Corsair", logo: "/globe.svg" },
          ]
        : lowerDest.includes("japan") || lowerDest.includes("tokyo")
        ? [
            { carrier: "ANA", logo: "/globe.svg" },
            { carrier: "JAL", logo: "/globe.svg" },
            { carrier: "Peach", logo: "/globe.svg" },
          ]
        : lowerDest.includes("uk") || lowerDest.includes("london") || lowerDest.includes("britain")
        ? [
            { carrier: "British Airways", logo: "/globe.svg" },
            { carrier: "easyJet", logo: "/globe.svg" },
            { carrier: "Jet2.com", logo: "/globe.svg" },
          ]
        : [
            { carrier: "Regional Air", logo: "/globe.svg" },
            { carrier: "City Express", logo: "/globe.svg" },
            { carrier: "SkyLink", logo: "/globe.svg" },
          ];

      const flights = [0, 1, 2].map((i) => {
        const departAt = toIsoLocal(dep, 9 + i * 2, 0);
        const arriveAt = toIsoLocal(dep, 12 + i * 2, 45);
        const price = 450 + i * 70;
        const fnum = `${byRegion[i].carrier.replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase()}${(200 + i * 7).toString()}`;
        return {
          type: "flight",
          id: `${tripId}-${i + 1}`,
          carrier: byRegion[i].carrier,
          carrierLogo: byRegion[i].logo,
          flightNumber: fnum,
          origin: (after as any).origin || "",
          destination: after.destination,
          departAt,
          arriveAt,
          durationMinutes: 225 + i * 20,
          price,
          currency: "USD",
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


