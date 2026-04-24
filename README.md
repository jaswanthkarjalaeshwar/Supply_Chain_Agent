# Supply Chain Disruption Agent

An AI agent that continuously monitors news, weather, shipping vessel positions, and inventory levels to detect supply chain disruptions before they impact operations. It reasons over live and mock data using an LLM via OpenRouter, then produces a prioritized action plan with recommended mitigations. Decisions and alerts are persisted in a local SQLite database so the agent can track disruption history and avoid duplicate notifications.
