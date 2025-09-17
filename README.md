## Travel Agent – Streaming, Non‑Chat Demo

A single-page travel planning demo using OpenAI models with streaming outputs, without a traditional chat UI. The experience is driven by an AI-powered Command‑K modal that streams small UI components (questions, CTA, or flight options) as they’re generated.

### 0) What this agent does
- It lets you book flights the regular way in a single-page interface (no chat box).
- It also proactively picks up tasks from your emails (and could from calendar, etc.), so it can suggest flights or family holidays based on your life.
- It uses the Chat Completions API with streaming to generate UI components on the fly for any missing trip details.

### 1) Install

```bash
npm install
```

### 2) Copy env

```bash
cp example.env .env.local
# fill in OPENAI_API_KEY and DATABASE_URL (Neon recommended)
```

### 3) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 4) Create a database on Neon (CLI)

Use the Neon console to create a project and get a connection string, or use the CLI. Paste the Postgres connection string into `DATABASE_URL` in `.env.local`.

Run migrations:

```bash
npm run db:migrate
```

### 5) Create mock bookings (SF, Paris, LA, London)

You can quickly create “bookings” directly via the API. Each booking requires a `tripId` (tie it to a potential trip). The simplest path is to use the UI to create a potential trip (⌘K → type a destination → answer prompts) and then click “Select” on one of the streamed flights. If you prefer raw API, here’s an example (adjust `tripId` and dates):

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' \
  -d '{
    "tripId": 1,
    "carrier": "United Airlines",
    "flightNumber": "UA200",
    "originCity": "San Francisco",
    "originCode": "SFO",
    "originAirportName": "San Francisco Intl",
    "destinationCity": "San Francisco",
    "destinationCode": "SFO",
    "destinationAirportName": "San Francisco Intl",
    "departAt": "2025-10-12T09:00:00.000Z",
    "arriveAt": "2025-10-12T12:45:00.000Z",
    "price": 450,
    "currency": "USD"
  }'
```

Repeat with destinations like Paris (CDG), Los Angeles (LAX), and London (LHR). Bookings appear under “YOUR TRIPS”.

### 6) Flow of a normal booking (no chat UI)
1. Press Command (⌘) + K to open the planner.
2. Type a destination (e.g., “Paris”). The app calls `/api/component?stream=1`.
3. If enough info exists (destination, origin, dates, budget), it streams realistic flight options live to the modal.
4. Otherwise, it streams up to 3 short questions for the missing fields, with suggestions; answer and submit to continue.
5. Click “Select” to book a flight; the booking is saved and shown in “YOUR TRIPS”.

### 7) Create a mock email → see a suggested trip

Post a mock email:

```bash
curl -X POST http://localhost:3000/api/emails \
  -H 'content-type: application/json' \
  -d '{
    "subject": "OpenAI DevDay in SF",
    "body": "Congratulations! You are invited to participate in the OpenAI DevDay on October 6th, 2025 at 9AM in San Francisco.",
    "senderEmail": "events@openai.com",
    "recipientEmail": "you@travel-agent.app",
    "folder": "inbox",
    "isRead": false,
    "sentAt": "2025-09-17T14:30:00Z"
  }'
```

The agent extracts travel intent and creates a “potential trip.” Refresh the page: the app detects that trip and can stream a short CTA with `/api/emails?stream=true`.

### 8) How streaming + component generation works (assignment requirements)
- Single-page without a chat interface: the Command‑K modal drives the interaction, not a chat box.
- Streaming outputs: `/api/component?stream=1` and `/api/emails?stream=true` send SSE chunks consumed by the UI for real-time updates.
- Chat Completions integration: endpoints use `@ai-sdk/openai` with the Vercel AI SDK (`ai`) to call models and stream.
- Dynamic UI generation: the model decides what’s missing in the DB and streams minimal UI components (prompts, CTA, flights) to collect or present just-in-time info.

### Packaging for submission

```bash
zip -r travel-agent.zip . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".git/*" \
  -x "drizzle-pg/meta/*"
```

Include all source, `README.md`, and migrations in `drizzle-pg/`.
