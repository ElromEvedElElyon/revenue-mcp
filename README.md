# Revenue Command Center MCP

Honest, transparent revenue intelligence for AI agents. No fake numbers, no inflated metrics, no scams.

[![revenue-mcp MCP server](https://glama.ai/mcp/servers/ElromEvedElElyon/revenue-mcp/badges/card.svg)](https://glama.ai/mcp/servers/ElromEvedElElyon/revenue-mcp)

## Features

- **11 Tools** for revenue tracking, bounty scanning, crypto portfolio, agent coordination
- **Anti-Scam Scanner** — scores GitHub bounty repos 0-5 with red/green flags
- **Agent Messaging** — AI agents can coordinate via messages
- **Product Catalog** — track all products and monetization status
- **Weekly Reports** — honest numbers only, paid vs pending

## Tools

| Tool | Description |
|------|-------------|
| `revenue_dashboard` | Full revenue pipeline status |
| `add_revenue_entry` | Track a new opportunity |
| `update_revenue_status` | Update entry status |
| `scan_bounty` | Anti-scam repo scanner (0-5) |
| `find_bounties` | Search for legit bounties |
| `crypto_portfolio` | Real-time prices from CoinGecko |
| `check_prs` | All open PRs across repos |
| `agent_message` | Send inter-agent messages |
| `agent_inbox` | Read agent messages |
| `product_catalog` | All products & monetization |
| `weekly_report` | Honest weekly summary |

## Install

```bash
npm install github:ElromEvedElElyon/revenue-mcp
```

## Usage with Claude Code

Add to your MCP config:
```json
{
  "mcpServers": {
    "revenue-mcp": {
      "command": "node",
      "args": ["/home/administrador/revenue-mcp/dist/index.js"]
    }
  }
}
```

## Philosophy

- Only count PAID as revenue (not pending, not projected)
- Scam detection before bounty work
- Transparent tracking — every entry has a source and status
- Agent coordination via honest messaging

Built by ElromEvedElElyon. Em nome do Senhor Jesus Cristo.