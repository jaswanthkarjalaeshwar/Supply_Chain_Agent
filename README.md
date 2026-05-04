# Supply Chain Disruption Agent

An autonomous AI agent that monitors global news, live weather, and vessel tracking data to detect supply chain disruptions before they impact operations. When a disruption is detected — a hurricane, port strike, or canal blockage — the agent cross-references delayed containers against a 24-SKU inventory database, identifies stockout risks, queries alternative freight options, and produces a fully costed rerouting plan for a human to approve.

---

## What It Does

Most supply chain teams spend days manually pulling ERP data into Excel to figure out which Purchase Orders are affected by a disruption. This agent does that automatically, continuously, and in minutes.

When a threat is detected at a monitored port, the agent:

1. Pulls live news, weather alerts, and vessel positions for that location
2. Cross-references delayed container IDs against your inventory database
3. Identifies which SKUs will stock out and when
4. Queries alternative freight forwarders for air, rail, and sea-express options
5. Ranks rerouting options by cost and speed
6. Presents a structured decision brief for human approval
7. Persists the decision to memory so future scans learn from past outcomes

---

## Architecture

```
supply-chain-agent/
├── src/
│   ├── tools/          # Data source tools (news, weather, vessels, inventory, freight)
│   ├── memory/         # SQLite persistence layer
│   ├── agent/          # Core agent loop, scheduler, continuous monitor
│   └── output/         # Formatter, approval flow, Slack notifier
├── src/web/            # Express dashboard + vanilla HTML/CSS/JS frontend
├── data/mock/          # 24-SKU inventory dataset
├── index.js            # Entry point (single run / replay / monitor modes)
└── run.bat             # Double-clickable Windows launcher
```

**Agent loop** — on each scan, the agent calls all data source tools in parallel, injects the combined output plus persistent memory context into an LLM prompt, parses the structured response for disruption severity and impacted POs, and writes findings to SQLite. If severity crosses the threshold, it triggers the approval flow.

**Persistent memory** — three SQLite tables store disruption history, impacted POs, and rerouting decisions. Before each scan, the agent loads the last 3 disruptions as context so it can learn cost patterns and avoid duplicate alerts.

**Tool calling** — the LLM reasons over five MCP-style tools: `fetchDisruptionNews`, `fetchWeatherAlert`, `fetchVesselStatus`, `fetchInventoryStatus`, and `fetchFreightOptions`. Each tool returns structured JSON that the agent synthesizes into a final impact assessment.

---

## Stack

- **Runtime** — Node.js 22, ES Modules
- **LLM** — OpenRouter (model-agnostic, defaults to `openai/gpt-4o-mini`)
- **Memory** — SQLite via `better-sqlite3`
- **Data sources** — GDELT (news), OpenWeatherMap, mock vessel fleet, mock ERP inventory
- **Web dashboard** — Express + vanilla HTML/CSS/JS, SSE for live scan streaming
- **CLI** — Chalk-rendered approval flow with approve / reject / defer paths

---

## Setup

**1. Clone and install**
```bash
git clone https://github.com/jaswanthkarjalaeshwar/Supply_Chain_Agent.git
cd Supply_Chain_Agent
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:
```
OPENROUTER_API_KEY=your_key_here       # openrouter.ai — create a free account
OPENWEATHER_API_KEY=your_key_here      # openweathermap.org — free tier works
MODEL=openai/gpt-4o-mini               # any OpenRouter model with tool use support
SLACK_WEBHOOK_URL=                     # optional — leave blank to skip Slack alerts
```

**3. Run it**

---

## How to Run

### Option 1 — Windows launcher (easiest)
Double-click `run.bat` in the project folder. A menu appears:
```
================================
 Supply Chain Disruption Agent
================================
 1. Run single scan
 2. Replay last disruption
 3. Start continuous monitor
 4. Open web dashboard
 5. Exit
```

### Option 2 — Web dashboard
```bash
npm run web
```
Open `http://localhost:3000` in your browser. Shows all past disruptions, live stats, and a Run New Scan button that streams tool-call output in real time.

### Option 3 — Command line

| Command | What it does |
|---|---|
| `node index.js` | Run a single agent scan (calls LLM, saves to DB) |
| `node index.js --replay` | Replay last disruption from DB — no API call, instant |
| `node index.js --monitor` | Continuous monitor, scans every 30 min |
| `node index.js --monitor --interval=5 --cycles=3` | Monitor with custom interval and cycle limit |
| `node index.js --monitor --locations="Port of Miami,Port of Los Angeles"` | Override monitored ports |

**For a quick demo without burning API credits:**
```bash
node index.js --replay
```
Loads the most recent disruption from SQLite and walks through the full approval flow instantly.

---

## Approval Flow

When a high-severity disruption is detected the agent renders a decision brief:

```
╔══════════════════════════════════════════════════════════════╗
  DISRUPTION BRIEF — #11
  Location : Port of Miami
  Event    : Hurricane Warning
  Severity : HIGH
╚══════════════════════════════════════════════════════════════╝

  Impacted Purchase Orders
  ┌─────────────┬──────────────────────────┬──────────┬───────────┐
  │ PO          │ SKU                      │ Vessel   │ Risk      │
  ├─────────────┼──────────────────────────┼──────────┼───────────┤
  │ PO-20240301 │ Women's Yoga Pants       │ MSC AURA │ HIGH      │
  │ PO-20240416 │ Memory Foam Mattress     │ EVER GEM │ HIGH      │
  └─────────────┴──────────────────────────┴──────────┴───────────┘

  Rerouting Options
  1. DHL Global Freight — air — $28,800 — 2 days — reliability 97%
  2. Union Pacific Intermodal — rail — $11,700 — 5 days — reliability 93%
  3. Maersk Spot Premium — sea-express — $5,800 — 10 days — reliability 88%

  Approve option [1/2/3], reject [r], or defer [d]?
```

All decisions are logged to SQLite with timestamps and notes.

---

## Monitored Data Sources

| Source | Tool | Notes |
|---|---|---|
| Global news | GDELT API | Free, no key required |
| Weather alerts | OpenWeatherMap | Free tier, requires key |
| Vessel positions | Mock fleet | MarineTraffic format — swap in real AIS key for production |
| Inventory / POs | Local JSON | Replace with ERP API endpoint for production |
| Freight quotes | Mock forwarders | DHL, Maersk, Union Pacific with urgency-scaled pricing |

---

## Extending to Production

- Replace `data/mock/inventory.json` with a live ERP API call in `src/tools/inventory.js`
- Replace mock vessel data in `src/tools/vessels.js` with a MarineTraffic AIS subscription
- Add `SLACK_WEBHOOK_URL` to `.env` to receive Slack alerts when disruptions are detected
- Deploy `src/web/server.js` behind a reverse proxy and run `node index.js --monitor` as a background service
- Switch `MODEL` to `anthropic/claude-haiku-4-5` for better structured reasoning on ambiguous disruption signals

---

## License

MIT
