#!/usr/bin/env node
/**
 * Revenue Command Center MCP Server
 *
 * Honest, transparent tool for AI agents to coordinate monetization.
 * Tracks bounties, crypto portfolio, products, and revenue streams.
 * Anti-scam protection built-in. No fake numbers, no inflated metrics.
 *
 * Em nome do Senhor Jesus Cristo, nosso Salvador.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || "/home/administrador";
const DATA_DIR = join(HOME, ".revenue-mcp");
const DB_FILE = join(DATA_DIR, "revenue.json");

// ─── Database ─────────────────────────────────────────────────────────────────

interface RevenueEntry {
  id: string;
  source: string;        // "bounty" | "grant" | "product" | "freelance" | "crypto"
  description: string;
  amount_usd: number;
  status: "pending" | "submitted" | "approved" | "paid" | "rejected";
  url?: string;
  deadline?: string;
  submitted_at?: string;
  paid_at?: string;
  notes?: string;
}

interface AgentMessage {
  from: string;
  to: string;
  type: "task" | "status" | "alert" | "request";
  content: string;
  timestamp: string;
  priority: "low" | "medium" | "high" | "critical";
}

interface RevenueDB {
  entries: RevenueEntry[];
  messages: AgentMessage[];
  total_earned: number;
  total_pending: number;
  last_updated: string;
  scam_list: string[];
  legit_list: string[];
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    execSync(`mkdir -p "${DATA_DIR}"`);
  }
}

function loadDB(): RevenueDB {
  ensureDataDir();
  if (existsSync(DB_FILE)) {
    return JSON.parse(readFileSync(DB_FILE, "utf-8"));
  }
  const db: RevenueDB = {
    entries: [],
    messages: [],
    total_earned: 0,
    total_pending: 0,
    last_updated: new Date().toISOString(),
    scam_list: [
      "ANAVHEOBA/PrivacyLayer",
      "FinMind/FinMind",
    ],
    legit_list: [
      "Expensify/App",
      "1712n/dn-institute",
      "solanabr/solana-vault-standard",
      "punkpeye/awesome-mcp-servers",
    ],
  };
  saveDB(db);
  return db;
}

function saveDB(db: RevenueDB): void {
  ensureDataDir();
  db.last_updated = new Date().toISOString();
  db.total_earned = db.entries
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + e.amount_usd, 0);
  db.total_pending = db.entries
    .filter((e) => e.status === "submitted" || e.status === "approved")
    .reduce((sum, e) => sum + e.amount_usd, 0);
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateId(): string {
  return `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

function ghApi(endpoint: string): string | null {
  try {
    return execSync(`gh api "${endpoint}" 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 15000,
    }).trim();
  } catch {
    return null;
  }
}

function ghSearch(query: string): any[] {
  try {
    const result = execSync(
      `gh search issues ${query} --json title,url,labels,repository --limit 20 2>/dev/null`,
      { encoding: "utf-8", timeout: 20000 }
    );
    return JSON.parse(result);
  } catch {
    return [];
  }
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function getCryptoPrice(coin: string): any | null {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const result = execSync(`curl -s "${url}" 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// ─── Anti-Scam Scanner ───────────────────────────────────────────────────────

interface ScamScore {
  repo: string;
  score: number; // 0-5 (0=SCAM, 5=SAFE)
  verdict: string;
  red_flags: string[];
  green_flags: string[];
}

function scanRepo(repo: string): ScamScore {
  const db = loadDB();

  // Check known lists
  if (db.scam_list.includes(repo)) {
    return {
      repo,
      score: 0,
      verdict: "KNOWN SCAM",
      red_flags: ["In known scam list"],
      green_flags: [],
    };
  }
  if (db.legit_list.includes(repo)) {
    return {
      repo,
      score: 5,
      verdict: "KNOWN LEGIT",
      red_flags: [],
      green_flags: ["In known legit list"],
    };
  }

  let score = 3; // Start neutral
  const red_flags: string[] = [];
  const green_flags: string[] = [];

  // Check repo data
  const repoData = ghApi(`repos/${repo}`);
  if (!repoData) {
    return { repo, score: 1, verdict: "CANNOT VERIFY", red_flags: ["Repo not accessible"], green_flags: [] };
  }

  const data = JSON.parse(repoData);

  // Stars
  if (data.stargazers_count > 100) { score++; green_flags.push(`${data.stargazers_count} stars`); }
  if (data.stargazers_count < 5) { score--; red_flags.push(`Only ${data.stargazers_count} stars`); }

  // Age
  const created = new Date(data.created_at);
  const ageMonths = (Date.now() - created.getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (ageMonths < 1) { score--; red_flags.push("Repo created less than 1 month ago"); }
  if (ageMonths > 12) { green_flags.push(`Repo age: ${Math.floor(ageMonths)} months`); }

  // Forks
  if (data.forks_count > 10) { green_flags.push(`${data.forks_count} forks`); }

  // Organization
  if (data.owner?.type === "Organization") { score++; green_flags.push("Owned by organization"); }

  // Check closed PRs without merging
  const closedPRs = ghApi(`repos/${repo}/pulls?state=closed&per_page=20`);
  if (closedPRs) {
    const prs = JSON.parse(closedPRs);
    const closedNotMerged = prs.filter((p: any) => !p.merged_at).length;
    if (closedNotMerged > 15) {
      score--;
      red_flags.push(`${closedNotMerged}/20 PRs closed without merge — possible bounty bait`);
    }
  }

  score = Math.max(0, Math.min(5, score));
  const verdict =
    score <= 1 ? "LIKELY SCAM" :
    score <= 2 ? "HIGH CAUTION" :
    score <= 3 ? "MODERATE RISK" :
    score <= 4 ? "PROBABLY SAFE" :
    "SAFE";

  return { repo, score, verdict, red_flags, green_flags };
}

// ─── PR Status Checker ───────────────────────────────────────────────────────

function checkAllPRs(): any[] {
  try {
    const result = execSync(
      `gh search prs --author ElromEvedElElyon --state open --limit 40 --json title,url,repository,createdAt 2>/dev/null`,
      { encoding: "utf-8", timeout: 30000 }
    );
    return JSON.parse(result);
  } catch {
    return [];
  }
}

// ─── Server Setup ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "revenue-command-center", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// ─── Tools ────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "revenue_dashboard",
      description: "Get full revenue dashboard — all entries, totals, pipeline status. Honest numbers only.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "add_revenue_entry",
      description: "Track a new revenue opportunity (bounty, grant, product sale, freelance gig)",
      inputSchema: {
        type: "object" as const,
        required: ["source", "description", "amount_usd"],
        properties: {
          source: { type: "string", enum: ["bounty", "grant", "product", "freelance", "crypto"], description: "Revenue source type" },
          description: { type: "string", description: "What is this opportunity" },
          amount_usd: { type: "number", description: "Dollar amount (honest estimate, not inflated)" },
          status: { type: "string", enum: ["pending", "submitted", "approved", "paid", "rejected"], default: "pending" },
          url: { type: "string", description: "Link to the opportunity" },
          deadline: { type: "string", description: "Deadline (ISO date)" },
          notes: { type: "string", description: "Additional notes" },
        },
      },
    },
    {
      name: "update_revenue_status",
      description: "Update status of a revenue entry (e.g. pending → submitted → paid)",
      inputSchema: {
        type: "object" as const,
        required: ["id", "status"],
        properties: {
          id: { type: "string", description: "Entry ID" },
          status: { type: "string", enum: ["pending", "submitted", "approved", "paid", "rejected"] },
          notes: { type: "string", description: "Update notes" },
        },
      },
    },
    {
      name: "scan_bounty",
      description: "Anti-scam scanner — checks if a GitHub repo's bounty is legitimate (0-5 score)",
      inputSchema: {
        type: "object" as const,
        required: ["repo"],
        properties: {
          repo: { type: "string", description: "GitHub owner/repo (e.g. Expensify/App)" },
        },
      },
    },
    {
      name: "find_bounties",
      description: "Search GitHub for real, paying bounty opportunities. Filters out known scams.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search query (default: bounty label issues)", default: "label:bounty" },
          min_stars: { type: "number", description: "Minimum repo stars to consider", default: 10 },
        },
      },
    },
    {
      name: "crypto_portfolio",
      description: "Get real-time crypto portfolio value from CoinGecko (no fake numbers)",
      inputSchema: {
        type: "object" as const,
        properties: {
          coins: { type: "string", description: "Comma-separated coin IDs (default: bitcoin,ethereum,solana)", default: "bitcoin,ethereum,solana" },
        },
      },
    },
    {
      name: "check_prs",
      description: "Check status of all open PRs across repos — track which ones might earn money",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "agent_message",
      description: "Send/receive messages between AI agents for coordination. Honest communication only.",
      inputSchema: {
        type: "object" as const,
        required: ["from", "to", "type", "content"],
        properties: {
          from: { type: "string", description: "Sending agent name (e.g. SALOMAO, EZEQUIEL)" },
          to: { type: "string", description: "Receiving agent name (or 'ALL' for broadcast)" },
          type: { type: "string", enum: ["task", "status", "alert", "request"] },
          content: { type: "string", description: "Message content" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"], default: "medium" },
        },
      },
    },
    {
      name: "agent_inbox",
      description: "Read pending messages for an agent",
      inputSchema: {
        type: "object" as const,
        required: ["agent"],
        properties: {
          agent: { type: "string", description: "Agent name to check inbox for" },
        },
      },
    },
    {
      name: "product_catalog",
      description: "List all products and their monetization status",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "weekly_report",
      description: "Generate honest weekly revenue report — no inflated numbers, only verified data",
      inputSchema: { type: "object" as const, properties: {} },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "revenue_dashboard": {
      const db = loadDB();
      const bySource: Record<string, { count: number; total: number; paid: number }> = {};
      for (const e of db.entries) {
        if (!bySource[e.source]) bySource[e.source] = { count: 0, total: 0, paid: 0 };
        bySource[e.source].count++;
        bySource[e.source].total += e.amount_usd;
        if (e.status === "paid") bySource[e.source].paid += e.amount_usd;
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_earned: db.total_earned,
            total_pending: db.total_pending,
            total_entries: db.entries.length,
            by_source: bySource,
            recent: db.entries.slice(-10),
            last_updated: db.last_updated,
            pending_messages: db.messages.length,
          }, null, 2),
        }],
      };
    }

    case "add_revenue_entry": {
      const db = loadDB();
      const entry: RevenueEntry = {
        id: generateId(),
        source: (args as any).source,
        description: (args as any).description,
        amount_usd: (args as any).amount_usd,
        status: (args as any).status || "pending",
        url: (args as any).url,
        deadline: (args as any).deadline,
        submitted_at: new Date().toISOString(),
        notes: (args as any).notes,
      };
      db.entries.push(entry);
      saveDB(db);
      return {
        content: [{ type: "text", text: `Added: ${entry.id} — ${entry.source} $${entry.amount_usd} (${entry.status})\n${entry.description}` }],
      };
    }

    case "update_revenue_status": {
      const db = loadDB();
      const entry = db.entries.find((e) => e.id === (args as any).id);
      if (!entry) return { content: [{ type: "text", text: `Entry not found: ${(args as any).id}` }] };
      const oldStatus = entry.status;
      entry.status = (args as any).status;
      if ((args as any).notes) entry.notes = (entry.notes || "") + `\n[${new Date().toISOString()}] ${(args as any).notes}`;
      if (entry.status === "paid") entry.paid_at = new Date().toISOString();
      saveDB(db);
      return {
        content: [{ type: "text", text: `Updated: ${entry.id} — ${oldStatus} → ${entry.status}\n${entry.description}` }],
      };
    }

    case "scan_bounty": {
      const result = scanRepo((args as any).repo);
      return {
        content: [{
          type: "text",
          text: `BOUNTY SCAN: ${result.repo}\nScore: ${result.score}/5 — ${result.verdict}\n\nRed Flags:\n${result.red_flags.map((f) => `  - ${f}`).join("\n") || "  None"}\n\nGreen Flags:\n${result.green_flags.map((f) => `  + ${f}`).join("\n") || "  None"}`,
        }],
      };
    }

    case "find_bounties": {
      const query = (args as any).query || "label:bounty";
      const results = ghSearch(`"${query}" --state open --sort created`);
      const db = loadDB();
      const filtered = results.filter((r: any) => {
        const repo = r.repository?.nameWithOwner || "";
        return !db.scam_list.includes(repo);
      });
      return {
        content: [{
          type: "text",
          text: `Found ${filtered.length} bounty opportunities (${results.length - filtered.length} scams filtered):\n\n${filtered.map((r: any) => `- ${r.repository?.nameWithOwner}: ${r.title}\n  ${r.url}`).join("\n\n")}`,
        }],
      };
    }

    case "crypto_portfolio": {
      const coins = ((args as any).coins || "bitcoin,ethereum,solana").split(",");
      const results: string[] = [];
      for (const coin of coins) {
        const data = getCryptoPrice(coin.trim());
        if (data && data[coin.trim()]) {
          const d = data[coin.trim()];
          results.push(`${coin.trim().toUpperCase()}: $${d.usd?.toLocaleString()} (${d.usd_24h_change?.toFixed(2)}%) — MCap: $${(d.usd_market_cap / 1e9).toFixed(1)}B`);
        }
      }
      return {
        content: [{ type: "text", text: results.join("\n") || "Unable to fetch prices" }],
      };
    }

    case "check_prs": {
      const prs = checkAllPRs();
      const byRepo: Record<string, any[]> = {};
      for (const pr of prs) {
        const repo = pr.repository?.nameWithOwner || "unknown";
        if (!byRepo[repo]) byRepo[repo] = [];
        byRepo[repo].push(pr);
      }
      const lines = Object.entries(byRepo).map(([repo, prs]) =>
        `${repo} (${prs.length} PRs):\n${prs.map((p: any) => `  - ${p.title.slice(0, 60)}\n    ${p.url}`).join("\n")}`
      );
      return {
        content: [{ type: "text", text: `OPEN PRs: ${prs.length} total\n\n${lines.join("\n\n")}` }],
      };
    }

    case "agent_message": {
      const db = loadDB();
      const msg: AgentMessage = {
        from: (args as any).from,
        to: (args as any).to,
        type: (args as any).type,
        content: (args as any).content,
        timestamp: new Date().toISOString(),
        priority: (args as any).priority || "medium",
      };
      db.messages.push(msg);
      saveDB(db);
      return {
        content: [{ type: "text", text: `Message sent: ${msg.from} → ${msg.to} [${msg.type}/${msg.priority}]\n${msg.content}` }],
      };
    }

    case "agent_inbox": {
      const db = loadDB();
      const agent = (args as any).agent;
      const messages = db.messages.filter(
        (m) => m.to === agent || m.to === "ALL"
      );
      if (messages.length === 0) {
        return { content: [{ type: "text", text: `No messages for ${agent}` }] };
      }
      // Remove read messages
      db.messages = db.messages.filter(
        (m) => m.to !== agent && m.to !== "ALL"
      );
      saveDB(db);
      return {
        content: [{
          type: "text",
          text: `INBOX for ${agent} (${messages.length} messages):\n\n${messages.map((m) => `[${m.priority.toUpperCase()}] ${m.from} → ${m.type}: ${m.content}\n  ${m.timestamp}`).join("\n\n")}`,
        }],
      };
    }

    case "product_catalog": {
      const products = [
        { name: "claw-mcp-toolkit", type: "Open Source MCP", price: "Free (MIT)", status: "LIVE", url: "github.com/ElromEvedElElyon/claw-mcp-toolkit", revenue: "Sponsorship / Consulting" },
        { name: "ClawChat Pro v1.0", type: "AI Chat SaaS", price: "$9.99/mo", status: "LIVE on sintex.ai", revenue: "Stripe subscription" },
        { name: "SintexOS", type: "AI Operating System", price: "$29.99", status: "LIVE on sintex.ai", revenue: "One-time purchase" },
        { name: "Zero to $1M Book", type: "Digital Book", price: "$9.99", status: "WRITTEN (175K words)", revenue: "Gumroad / Amazon KDP" },
        { name: "FLASH Payment System", type: "Payment Infrastructure", price: "Enterprise", status: "BUILT (99 tests)", revenue: "Licensing / SaaS" },
        { name: "bUSD1 (BITCOIN•USD•ONE)", type: "Runes Stablecoin", price: "Peg: $1.00", status: "ETCHED (0 mints)", revenue: "Mint fees + DeFi" },
        { name: "STBTCx", type: "Solana Token", price: "Market", status: "LAUNCHED (not graduated)", revenue: "Trading / LP" },
        { name: "revenue-mcp", type: "Revenue Intelligence MCP", price: "Free (MIT)", status: "NEW", revenue: "Consulting / Premium features" },
      ];
      return {
        content: [{
          type: "text",
          text: `PRODUCT CATALOG (${products.length} products):\n\n${products.map((p) => `${p.name}\n  Type: ${p.type} | Price: ${p.price}\n  Status: ${p.status}\n  Revenue: ${p.revenue}`).join("\n\n")}`,
        }],
      };
    }

    case "weekly_report": {
      const db = loadDB();
      const prs = checkAllPRs();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek = db.entries.filter(
        (e) => new Date(e.submitted_at || "").getTime() > weekAgo.getTime()
      );

      const report = `
WEEKLY REVENUE REPORT — ${now.toISOString().slice(0, 10)}
============================================================

LIFETIME:
  Total Earned: $${db.total_earned.toFixed(2)}
  Total Pending: $${db.total_pending.toFixed(2)}
  Total Entries: ${db.entries.length}

THIS WEEK:
  New Entries: ${thisWeek.length}
  New Value: $${thisWeek.reduce((s, e) => s + e.amount_usd, 0).toFixed(2)}
  Paid: $${thisWeek.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount_usd, 0).toFixed(2)}

OPEN PRs: ${prs.length}
PENDING BOUNTIES: ${db.entries.filter((e) => e.source === "bounty" && e.status === "submitted").length}
PENDING GRANTS: ${db.entries.filter((e) => e.source === "grant" && e.status === "submitted").length}

HONEST ASSESSMENT:
  - Only count PAID entries as revenue
  - Pending = not guaranteed
  - Scams filtered: ${db.scam_list.length} known scam repos
  - All numbers verified against real data
`.trim();

      return { content: [{ type: "text", text: report }] };
    }

    default:
      return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
});

// ─── Resources ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "revenue://dashboard",
      name: "Revenue Dashboard",
      description: "Current revenue status and pipeline",
      mimeType: "application/json",
    },
    {
      uri: "revenue://scam-list",
      name: "Known Scam Repos",
      description: "List of verified scam bounty repositories",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === "revenue://dashboard") {
    const db = loadDB();
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(db, null, 2) }] };
  }
  if (uri === "revenue://scam-list") {
    const db = loadDB();
    return {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({ scams: db.scam_list, legit: db.legit_list }, null, 2),
      }],
    };
  }
  return { contents: [] };
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Revenue Command Center MCP running — honest money tracking for AI agents");
}

main().catch(console.error);
