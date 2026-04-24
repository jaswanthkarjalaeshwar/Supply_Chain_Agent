import OpenAI from 'openai';
import chalk from 'chalk';
import { TOOLS, TOOL_FUNCTIONS } from '../tools/index.js';
import {
  initDB,
  logDisruption,
  logImpactedPOs,
  logDecision,
  getDisruptionContext,
} from '../memory/db.js';

const MAX_ITERATIONS = 15;

function buildSystemPrompt(location, event, memoryContext) {
  return `You are a supply chain disruption agent. Your job is to:
- Determine whether a real disruption is occurring at ${location}
- Identify which vessels, containers, and purchase orders (POs) are at risk
- Cross-reference cargo manifests with inventory to find stockout risks
- Retrieve alternative freight routing options for affected shipments
- Produce a structured, actionable rerouting plan

MEMORY — past disruptions you have already handled:
${memoryContext}

TOOL ORDER — you must call tools in this sequence before reasoning:
1. fetchDisruptionNews   — search recent news about the event + location
2. fetchWeatherAlert     — check current weather severity at the port city
3. fetchVesselStatus     — get all vessels and their cargo SKUs at the port
4. fetchInventoryStatus  — look up stock levels for every SKU found in vessel cargo
5. fetchFreightOptions   — get rerouting alternatives for delayed/diverted vessels

After all five tools have returned data, write your analysis and end your response
with a JSON block in EXACTLY this format (no extra keys, no trailing text after the block):

\`\`\`json
{
  "disruption": {
    "summary": "2-3 sentence plain-English description of the disruption and its impact",
    "severity": "high",
    "eventType": "${event}",
    "location": "${location}"
  },
  "impactedPOs": [
    {
      "poId": "PO-20240001",
      "skuId": "SKU-E001",
      "skuName": "Product name from inventory",
      "vesselName": "VESSEL NAME",
      "containerId": "CONTAINER-ID",
      "stockoutRisk": "high",
      "estimatedDelayDays": 7
    }
  ],
  "reroutingOptions": [
    {
      "optionChosen": "Short label for this option",
      "forwarder": "Forwarder name",
      "mode": "air",
      "costEstimateUsd": 28800,
      "timeSavedDays": 5,
      "notes": "Why this option was recommended"
    }
  ]
}
\`\`\``;
}

function parseAgentOutput(text) {
  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlock) {
    try { return JSON.parse(jsonBlock[1]); } catch {}
  }
  const raw = text.match(/\{\s*"disruption"[\s\S]*\}/);
  if (raw) {
    try { return JSON.parse(raw[0]); } catch {}
  }
  return null;
}

function buildFallback(location, event, toolResults) {
  const vessels = toolResults['fetchVesselStatus']?.vessels ?? [];
  const freight = toolResults['fetchFreightOptions'] ?? [];

  const impactedPOs = vessels.flatMap((v) =>
    (v.cargo ?? []).map((skuId) => ({
      poId: `PO-${String(Math.floor(Math.random() * 90000) + 10000)}`,
      skuId,
      skuName: skuId,
      vesselName: v.vesselName,
      containerId: v.containerId,
      stockoutRisk: v.status === 'diverted' ? 'high' : v.status === 'delayed' ? 'medium' : 'low',
      estimatedDelayDays: v.status === 'diverted' ? 9 : v.status === 'delayed' ? 4 : 0,
    })),
  );

  return {
    disruption: {
      summary: `${event} detected at ${location}. ${vessels.length} vessel(s) affected, ${impactedPOs.length} PO(s) at risk.`,
      severity: 'high',
      eventType: event,
      location,
    },
    impactedPOs,
    reroutingOptions: freight.map((f) => ({
      optionChosen: `${f.mode} via ${f.forwarder}`,
      forwarder: f.forwarder,
      mode: f.mode,
      costEstimateUsd: f.costEstimateUsd,
      timeSavedDays: f.transitDays,
      notes: f.notes,
    })),
  };
}

export async function runAgent(triggerLocation, triggerEvent) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set — add it to .env');
  }

  initDB();
  const memoryContext = getDisruptionContext();

  const messages = [
    { role: 'system', content: buildSystemPrompt(triggerLocation, triggerEvent, memoryContext) },
    {
      role: 'user',
      content: `Analyze this supply chain disruption and produce a full rerouting plan.\n\nEvent: ${triggerEvent}\nLocation: ${triggerLocation}`,
    },
  ];

  console.log('\n' + chalk.bold.magenta('━'.repeat(62)));
  console.log(chalk.bold.magenta('  SUPPLY CHAIN AGENT — RUN STARTED'));
  console.log(chalk.magenta(`  Location : ${triggerLocation}`));
  console.log(chalk.magenta(`  Event    : ${triggerEvent}`));
  console.log(chalk.magenta(`  Model    : ${process.env.MODEL}`));
  console.log(chalk.bold.magenta('━'.repeat(62)));

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  let iteration = 0;
  let finalText = '';
  const collectedResults = {};

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(chalk.dim(`\n[Iter ${iteration}/${MAX_ITERATIONS}] → model (${messages.length} msgs in context)`));

    const response = await client.chat.completions.create({
      model: process.env.MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const { message, finish_reason } = response.choices[0];

    // Always push the full assistant turn (content may be null when tool calling)
    const assistantTurn = { role: 'assistant', content: message.content ?? null };
    if (message.tool_calls?.length) assistantTurn.tool_calls = message.tool_calls;
    messages.push(assistantTurn);

    if (message.content) {
      const preview = message.content.slice(0, 300);
      console.log(chalk.dim(`  [thinking] ${preview}${message.content.length > 300 ? ' …' : ''}`));
    }

    // No tool calls → final answer
    if (!message.tool_calls?.length || finish_reason === 'stop') {
      finalText = message.content ?? '';
      console.log(chalk.bold.green('\n  ✓ Final response received'));
      break;
    }

    // Execute every tool call returned in this turn
    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      let args;
      try { args = JSON.parse(toolCall.function.arguments); }
      catch { args = {}; }

      console.log(chalk.bold.yellow(`\n  → TOOL  : ${name}`));
      console.log(chalk.yellow(`     args : ${JSON.stringify(args)}`));

      const fn = TOOL_FUNCTIONS[name];
      let result;
      try {
        result = fn ? await fn(args) : { error: `Unknown tool: ${name}` };
      } catch (err) {
        result = { error: err.message };
      }

      collectedResults[name] = result;

      const preview = JSON.stringify(result);
      console.log(
        chalk.green(`  ← RESULT: `) +
        chalk.dim(preview.length > 500 ? preview.slice(0, 500) + ' …' : preview),
      );

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (iteration >= MAX_ITERATIONS && !finalText) {
    console.log(chalk.red('\n  ✗ Hit max iterations — using fallback'));
  }

  // --- Parse structured JSON from final response ---
  let parsed = parseAgentOutput(finalText);
  if (!parsed) {
    console.log(chalk.yellow('\n  ⚠  JSON parse failed — building fallback from tool results'));
    parsed = buildFallback(triggerLocation, triggerEvent, collectedResults);
  }

  // --- Persist to SQLite ---
  const newsResults = collectedResults['fetchDisruptionNews'] ?? [];
  const weatherSnap = collectedResults['fetchWeatherAlert'] ?? null;
  const rawNewsSummary = newsResults.length
    ? newsResults.map((a) => a.title).join(' | ')
    : parsed.disruption?.summary ?? null;

  const disruptionId = logDisruption({
    detectedAt: new Date().toISOString(),
    eventType: parsed.disruption?.eventType ?? triggerEvent,
    location: parsed.disruption?.location ?? triggerLocation,
    severity: parsed.disruption?.severity ?? 'medium',
    rawNewsSummary,
    weatherSnapshot: weatherSnap,
  });

  if (parsed.impactedPOs?.length) {
    logImpactedPOs(disruptionId, parsed.impactedPOs);
  }

  if (parsed.reroutingOptions?.length) {
    const top = parsed.reroutingOptions[0];
    logDecision(disruptionId, {
      optionChosen: top.optionChosen ?? top.mode,
      costEstimateUsd: top.costEstimateUsd,
      timeSavedDays: top.timeSavedDays,
      approvedByHuman: 0,
      notes: top.notes,
    });
  }

  console.log(chalk.bold.green(`\n  ✓ Saved to SQLite — disruption #${disruptionId}`));

  return {
    disruptionId,
    location: parsed.disruption?.location ?? triggerLocation,
    eventType: parsed.disruption?.eventType ?? triggerEvent,
    severity: parsed.disruption?.severity ?? 'medium',
    impactedPOs: parsed.impactedPOs ?? [],
    reroutingOptions: parsed.reroutingOptions ?? [],
    rawPlan: finalText,
  };
}
