## Travel Agent

This is a demo of a smart travel agent app that sproactively picks up tasks from your emails (and could from calendar, etc.), so it can suggest flights or family holidays based on your life.

Since the app picks incomplete information from different sources, it uses the Chat Completions API with streaming to generate UI components on the fly for any missing trip details.

### 1) Install

```bash
npm install
```

### 2) Copy env

```bash
cp example.env .env.local
```

You will need to connect the app to a Postgres database. You can create one using [Neon](https://neon.com).

You will also need an [unsplash](https://unsplash.com/developers) Access Key to generate images.

### 3) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 4) Create a database on Neon

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
    "originCity": "New York",
    "originCode": "JFK",
    "originAirportName": "JFK Intl",
    "destinationCity": "Miami",
    "destinationCode": "MIA",
    "destinationAirportName": "Miami Intl",
    "departAt": "2025-10-12T09:00:00.000Z",
    "arriveAt": "2025-10-12T12:45:00.000Z",
    "price": 450,
    "currency": "USD"
  }'
```

Repeat with destinations like Paris (CDG), Los Angeles (LAX), and London (LHR). Bookings appear under “YOUR TRIPS”.

### 6) Flow of a normal booking
1. On the home page. press Command (⌘) + K to open the planner.
2. Type a destination (e.g., “Paris”) and press Enter.
3. The app will stream generated UI components to let you provide the required information to book a flight.
4. Click “Select” to book a flight; the booking is saved and shown in “YOUR TRIPS”.

### 7) Suggested trip
As mentioned before, the app integrates with your email, calendar, kids schools and other data providers to better suggest work and familiy trips for you.

To test the email integration, let's post a mock email:

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

The agent extracts travel intent and creates a “potential trip.” The app detects that trip and ask you if you want to complete the booking. Press Enter to continue with your booking.

### 8) How streaming + component generation works 
- Single-page without a chat interface: the Command‑K modal drives the interaction, not a chat box.
- Streaming outputs: `/api/component?stream=1` and `/api/emails?stream=true` send SSE chunks consumed by the UI for real-time updates.
- Chat Completions integration: endpoints use `@ai-sdk/openai` with the Vercel AI SDK (`ai`) to call models and stream.
- Dynamic UI generation: the model decides what’s missing in the DB and streams minimal UI components (prompts, CTA, flights) to collect or present just-in-time info.