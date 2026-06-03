// Discovery agent: Firecrawl search + scrape + Gemini structured extraction.
// Server-only — never import from client code.

import Firecrawl from "@mendable/firecrawl-js";
import { generateText } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { computeScoring } from "./scoring";
import type { Region, Vertical } from "./conferences";

const ALLOWED_REGIONS: Region[] = ["North America", "Europe", "APAC", "Middle East"];
const ALLOWED_VERTICALS: Vertical[] = [
  "Payments",
  "Fintech",
  "Treasury",
  "Embedded Finance",
  "Neobanking",
  "Cross-Border Payments",
  "Travel Tech",
];

const MAX_CANDIDATES = 80;
const LIMIT_PER_QUERY = 10;
const SCRAPE_TIMEOUT_MS = 20_000;
const MAX_AGGREGATOR_ITEMS = 40;

const SEARCH_QUERIES = [
  "fintech conferences 2026 2027",
  "payments industry conference 2026 2027",
  "treasury CFO conference 2026 2027",
  "embedded finance conference 2026 2027",
  "fintech conference Dubai Middle East 2026 2027",
  "payments conference Singapore Asia 2026 2027",
  "neobank fintech summit Europe 2026 2027",
  "cross-border payments conference 2026 2027",
];

/**
 * Stable, curated calendar pages that always run BEFORE search queries.
 * These give the agent a deterministic backbone, so re-runs converge.
 */
const ANCHOR_SOURCES: SearchHit[] = [
  {
    url: "https://www.fintechprofile.com/fintech-event-calendar-2026/",
    title: "Fintech Event Calendar 2026",
    description: "Curated calendar of fintech conferences 2026",
  },
  {
    url: "https://paytech.events/events/",
    title: "Paytech Events Calendar",
    description: "Curated payments and fintech events",
  },
  {
    url: "https://thepaypers.com/payments/expert-views/2026-fintech-and-payments-events-calendar",
    title: "2026 Fintech and Payments Events Calendar",
    description: "Curated 2026 events calendar from The Paypers",
  },
];
const ANCHOR_URL_KEYS = new Set(ANCHOR_SOURCES.map((s) => normalizeUrl(s.url)));

const AGGREGATOR_TITLE_HINTS = [
  "calendar",
  "top conferences",
  "list of",
  "best conferences",
  "upcoming conferences",
  "conferences to attend",
  "events calendar",
  "must attend",
  "guide to",
  "round-up",
  "roundup",
];

function isAggregatorPage(hit: SearchHit): boolean {
  if (ANCHOR_URL_KEYS.has(normalizeUrl(hit.url))) return true;
  const haystack = `${hit.title ?? ""} ${hit.description ?? ""}`.toLowerCase();
  return AGGREGATOR_TITLE_HINTS.some((h) => haystack.includes(h));
}

/** Known aggregator/calendar/blog domains that must NEVER be saved as
 *  a conference's officialUrl. Match by suffix to cover subdomains. */
const AGGREGATOR_DOMAINS = [
  "fintechlabs.com",
  "paytech.events",
  "fintechprofile.com",
  "vendelux.com",
  "ozoneapi.com",
  "spreedly.com",
  "loanpro.io",
  "softwaremill.com",
  "fintechgrowthinsider.com",
  "thepaypers.com",
  "medium.com",
  "linkedin.com",
  "substack.com",
  "reddit.com",
];

function isAggregatorDomain(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).host.toLowerCase().replace(/^www\./, "");
    return AGGREGATOR_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return true;
  }
}

// Relaxed schema: anything that isn't certain from the page can be null.
// We will keep the conference anyway and flag it for human review.
const VERTICAL_ENUM = [
  "Payments",
  "Fintech",
  "Treasury",
  "Embedded Finance",
  "Neobanking",
  "Cross-Border Payments",
  "Travel Tech",
] as const;

const ExtractionSchema = z.object({
  name: z.string(),
  startDate: z.string().nullable().describe("ISO date YYYY-MM-DD or null if not stated"),
  endDate: z.string().nullable().describe("ISO date YYYY-MM-DD or null if not stated"),
  city: z.string().nullable(),
  country: z.string().nullable(),
  region: z
    .enum(["North America", "Europe", "APAC", "Middle East", "LATAM"])
    .nullable(),
  vertical: z.enum(VERTICAL_ENUM).nullable(),
  estimatedAudienceSize: z.number().int().nonnegative().nullable(),
  tags: z.array(z.string()).max(8).default([]),
  officialUrl: z
    .string()
    .nullable()
    .describe("The conference's OWN official website (e.g. https://money2020.com). NOT an aggregator/calendar/blog. Null if not clearly stated on the page."),
  isRelevant: z
    .boolean()
    .describe("True only if the conference audience includes CFOs, Heads of Payments, Treasury managers, or Product leaders at PSPs, neobanks, marketplaces, embedded-finance providers, cross-border payments, or travel-tech platforms (not a blog post, list article, past edition, or news)"),
  confidence: z.number().int().min(0).max(100),
});

const AggregatorSchema = z.object({
  conferences: z.array(ExtractionSchema).max(MAX_AGGREGATOR_ITEMS),
});

type SearchHit = { url: string; title?: string; description?: string };

export interface AgentRunResult {
  runId: string;
  found: number;
  added: number;
  flagged: number;
  skipped: number;
  durationMs: number;
  totalTokens: number;
  error?: string;
}

function yearsAllowed(): Set<number> {
  const y = new Date().getUTCFullYear();
  return new Set([y, y + 1]);
}

function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = "";
    const path = x.pathname.replace(/\/+$/, "");
    return (x.host + path).toLowerCase();
  } catch {
    return u.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Normalize a conference name for fuzzy dedup. Strips:
 *  - subtitles after `|`, `:`, ` - `, ` – `, ` — ` (so "AFP 2026 | The Treasury..." == "AFP 2026")
 *  - 4-digit year tokens (so "Nordic Fintech Summit 2026" == "Nordic Fintech Summit")
 *  - generic suffixes like "festival/conference/summit/expo/forum/week/fest/show/meetup"
 *    when they appear AFTER the core brand — kept only when they're part of the brand
 *  - all punctuation; collapses whitespace; lowercases.
 */
function normalizeConfName(raw: string): string {
  let s = (raw ?? "").toLowerCase();
  // strip subtitle separators (keep brand head before |, :, dash variants)
  s = s.split(/[|:]| - | – | — /)[0];
  // strip standalone 4-digit year tokens (space-bounded only — preserves "Money 20/20")
  s = s.replace(/(^|\s)(20[2-9]\d)(?=\s|$)/g, "$1");
  // punctuation -> spaces
  s = s.replace(/[^a-z0-9\s]/g, " ");
  // glue letter+space+digit ("Money 20" -> "Money20")
  s = s.replace(/([a-z])\s+(\d)/g, "$1$2");
  // glue digit+space+digit ("20 20" -> "2020"), repeat to handle long runs
  while (/\d\s+\d/.test(s)) s = s.replace(/(\d)\s+(\d)/g, "$1$2");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Completeness score for picking the better record when two results refer to the same conference. */
function scoreExtraction(p: {
  audience: number;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  sourceUrl: string;
}): number {
  let s = 0;
  if (p.audience > 0) s += 2;
  if (p.city && p.city !== "Unknown") s += 1;
  if (p.country && p.country !== "Unknown") s += 1;
  if (p.endDate && p.endDate !== p.startDate) s += 1;
  try {
    const host = new URL(p.sourceUrl).host.toLowerCase();
    const bloggy = /(blog|medium\.com|linkedin\.com|substack\.com|reddit\.com)/.test(host);
    const anchor = ANCHOR_URL_KEYS.has(normalizeUrl(p.sourceUrl));
    if (!bloggy && !anchor) s += 2; // official domain wins over aggregator/blog
  } catch {
    /* noop */
  }
  return s;
}

function dateOverlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  const start = Math.max(as, bs);
  const end = Math.min(ae, be);
  if (end < start) return -Math.round((start - end) / 86_400_000);
  return Math.round((end - start) / 86_400_000) + 1;
}

const DateVerificationSchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  year: z.number().int().nullable(),
  notes: z.string().optional(),
});

/**
 * Targeted retry: if the first extraction returned no date or a year that's
 * outside the allowed window, ask the model a focused second question about
 * just the dates/year. Returns updated startDate/endDate or null if still unknown.
 */
async function verifyConferenceDates(args: {
  model: Parameters<typeof generateText>[0]["model"];
  name: string;
  hit: SearchHit;
  markdown: string | null;
  allowedYears: number[];
}): Promise<{ startDate: string | null; endDate: string | null }> {
  const { model, name, hit, markdown, allowedYears } = args;
  if (!markdown) return { startDate: null, endDate: null };

  try {
    const res = await generateText({
      model,
      temperature: 0,
      prompt:
        `You previously extracted a conference but the dates were missing or had an unreasonable year.\n` +
        `Re-read the page below and find ONLY the dates of the next edition of "${name}".\n` +
        `Look for explicit phrases like "March 4-6, 2026", date headers near the title/hero, footer "© 2026", or registration pages.\n` +
        `Allowed years: ${allowedYears.join(", ")}. If the page describes a past edition, reply with nulls.\n` +
        `Return ONLY one JSON object: { "startDate": "YYYY-MM-DD" | null, "endDate": "YYYY-MM-DD" | null, "year": integer | null, "notes": string }.\n` +
        `Use null for any field you cannot determine with high confidence. Do NOT invent a year.\n\n` +
        `URL: ${hit.url}\nTitle: ${hit.title ?? ""}\n\n` +
        `--- PAGE CONTENT (markdown, possibly truncated) ---\n${markdown}`,
    });
    const raw = res.text ?? "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { startDate: null, endDate: null };
    const parsed = DateVerificationSchema.parse(JSON.parse(m[0]));
    const start = parsed.startDate;
    const end = parsed.endDate ?? start;
    if (!start) return { startDate: null, endDate: null };
    const y = new Date(start).getUTCFullYear();
    if (!Number.isFinite(y) || !allowedYears.includes(y)) {
      return { startDate: null, endDate: null };
    }
    return { startDate: start, endDate: end ?? start };
  } catch {
    return { startDate: null, endDate: null };
  }
}

function normalizeHits(raw: unknown): SearchHit[] {
  const out: SearchHit[] = [];
  if (!raw) return out;
  const arr =
    (raw as { web?: SearchHit[] }).web ??
    (raw as { results?: SearchHit[] }).results ??
    (raw as { data?: SearchHit[] }).data ??
    (Array.isArray(raw) ? (raw as SearchHit[]) : []);
  for (const h of arr) {
    if (h && typeof h.url === "string") out.push(h);
  }
  return out;
}

type Decision = "added" | "flagged" | "skipped" | "error";

async function logCandidate(args: {
  runId: string;
  hit: SearchHit;
  decision: Decision;
  reason: string;
  extracted?: unknown;
  conferenceId?: string;
}) {
  await supabaseAdmin.from("agent_candidates").insert({
    run_id: args.runId,
    url: args.hit.url,
    title: args.hit.title ?? null,
    description: args.hit.description ?? null,
    decision: args.decision,
    reason: args.reason,
    extracted: (args.extracted ?? null) as never,
    conference_id: args.conferenceId ?? null,
  });
}

async function scrapeMarkdown(firecrawl: Firecrawl, url: string): Promise<string | null> {
  try {
    const res = await Promise.race([
      firecrawl.scrape(url, { formats: ["markdown"], onlyMainContent: true }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SCRAPE_TIMEOUT_MS)),
    ]);
    if (!res) return null;
    const md =
      (res as { markdown?: string }).markdown ??
      (res as { data?: { markdown?: string } }).data?.markdown ??
      null;
    if (!md) return null;
    // Truncate to keep token cost bounded.
    return md.length > 8000 ? md.slice(0, 8000) : md;
  } catch (e) {
    console.error("Scrape failed for", url, e);
    return null;
  }
}

/**
 * Resolve the official website for a conference.
 *  1. If Gemini extracted an officialUrl and it's not an aggregator domain → keep it.
 *  2. Otherwise run a Firecrawl search ("{name} {year} official website", limit 2)
 *     and return the first non-aggregator result.
 *  3. If both fail → return null (caller flags `needs_url_review`).
 */
async function resolveOfficialUrl(
  firecrawl: Firecrawl,
  name: string,
  year: number,
  extracted: string | null,
): Promise<string | null> {
  if (extracted && !isAggregatorDomain(extracted)) return extracted;
  try {
    const res = await firecrawl.search(`${name} ${year} official website`, { limit: 2 });
    for (const hit of normalizeHits(res)) {
      if (hit.url && !isAggregatorDomain(hit.url)) return hit.url;
    }
  } catch (e) {
    console.error("officialUrl fallback search failed for", name, e);
  }
  return null;
}


export async function runDiscoveryAgent(trigger: "manual" | "cron"): Promise<AgentRunResult> {
  const fcKey = process.env.FIRECRAWL_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!fcKey) throw new Error("FIRECRAWL_API_KEY missing");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

  const startedAt = Date.now();
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("agent_runs")
    .insert({ status: "running", trigger })
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error(runErr?.message ?? "Failed to create agent run");
  const runId = runRow.id as string;

  let found = 0;
  let added = 0;
  let flagged = 0;
  let skipped = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const firecrawl = new Firecrawl({ apiKey: fcKey });
    const gateway = createLovableAiGatewayProvider(lovableKey);
    const model = gateway("google/gemini-2.5-flash");

    // 1) Search — start with anchor calendar pages, then add web search hits.
    const candidates: SearchHit[] = [];
    const seenUrls = new Set<string>();
    for (const anchor of ANCHOR_SOURCES) {
      const key = normalizeUrl(anchor.url);
      if (seenUrls.has(key)) continue;
      seenUrls.add(key);
      candidates.push(anchor);
    }
    for (const q of SEARCH_QUERIES) {
      if (candidates.length >= MAX_CANDIDATES) break;
      try {
        const res = await firecrawl.search(q, { limit: LIMIT_PER_QUERY });
        for (const hit of normalizeHits(res)) {
          const key = normalizeUrl(hit.url);
          if (seenUrls.has(key)) continue;
          seenUrls.add(key);
          candidates.push(hit);
          if (candidates.length >= MAX_CANDIDATES) break;
        }
      } catch (e) {
        console.error(`Firecrawl search failed for "${q}":`, e);
      }
    }
    found = candidates.length;

    // 2) Load existing + blocklist for dedup
    const { data: blocked } = await supabaseAdmin
      .from("do_not_resurrect")
      .select("name_lower, year, city_lower");
    const blockedKeys = new Set(
      (blocked ?? []).map((b) => `${b.name_lower}|${b.year}|${b.city_lower}`),
    );
    const { data: existing } = await supabaseAdmin
      .from("conferences")
      .select("id, name, start_date, city, country, end_date, estimated_audience_size, source_url")
      .is("deleted_at", null);
    type ExistingRow = NonNullable<typeof existing>[number];
    const existingByKey = new Map<string, ExistingRow>();
    const existingList: ExistingRow[] = [];
    for (const e of existing ?? []) {
      const k = `${normalizeConfName(e.name)}|${new Date(e.start_date).getUTCFullYear()}|${e.city.toLowerCase().trim()}`;
      existingByKey.set(k, e);
      existingList.push(e);
    }
    // First-ever agent run on an empty catalog: skip needs_review flags so the
    // initial bulk import doesn't drown the user in pending change flags.
    const isFirstRun = existingList.length === 0;

    // Track rows inserted during THIS run so within-run duplicates can merge
    // (keep the more complete record) rather than create change flags.
    const insertedThisRun = new Map<string, { score: number; fromAggregator: boolean }>();

    /** Preflight DB dedup: check if a search hit obviously matches an existing
     *  conference based on title alone — saves a Firecrawl scrape and avoids
     *  re-extracting the same conference. Skips aggregator/anchor pages. */
    function preflightDbDuplicate(hit: SearchHit): ExistingRow | null {
      if (isAggregatorPage(hit)) return null;
      const text = `${hit.title ?? ""} ${hit.description ?? ""}`;
      const yearMatch = text.match(/\b(20[2-9]\d)\b/);
      if (!yearMatch) return null;
      const candYear = parseInt(yearMatch[1], 10);
      const titleNorm = normalizeConfName(hit.title ?? "");
      if (titleNorm.length < 4) return null;
      for (const e of existingList) {
        if (new Date(e.start_date).getUTCFullYear() !== candYear) continue;
        const en = normalizeConfName(e.name);
        if (en.length < 4) continue;
        if (titleNorm === en || titleNorm.includes(en) || en.includes(titleNorm)) {
          return e;
        }
      }
      return null;
    }

    /** Fuzzy lookup: normalized name + year, with city-as-wildcard when either side is "Unknown",
     *  plus a date+country fallback (overlap within ±2 days). */
    function findExistingFuzzy(
      candName: string,
      candYear: number,
      candCity: string,
      candCountry: string,
      candStart: string,
      candEnd: string,
    ): ExistingRow | undefined {
      const candNorm = normalizeConfName(candName);
      const candCityLc = candCity.toLowerCase();
      for (const e of existingList) {
        const eYear = new Date(e.start_date).getUTCFullYear();
        if (eYear !== candYear) continue;
        const eNorm = normalizeConfName(e.name);
        const eCityLc = e.city.toLowerCase();
        const nameMatch =
          eNorm === candNorm ||
          (eNorm.length >= 6 && candNorm.length >= 6 &&
            (eNorm.includes(candNorm) || candNorm.includes(eNorm)));
        const cityMatch =
          eCityLc === candCityLc || eCityLc === "unknown" || candCityLc === "unknown";
        if (nameMatch && cityMatch) return e;
        // Date+country fallback: same country & overlapping dates (within ±2 days)
        if (
          e.country?.toLowerCase() === candCountry.toLowerCase() &&
          dateOverlapDays(e.start_date, e.end_date, candStart, candEnd) >= -2
        ) {
          // Require at least one shared significant token to avoid false positives
          const eTokens = new Set(eNorm.split(" ").filter((t) => t.length >= 4));
          const cTokens = candNorm.split(" ").filter((t) => t.length >= 4);
          if (cTokens.some((t) => eTokens.has(t))) return e;
        }
      }
      return undefined;
    }



    const yrs = yearsAllowed();

    let cancelled = false;

    // 3) For each candidate: scrape -> extract -> filter -> upsert/flag
    for (const hit of candidates) {
      // Cooperative cancel — check the flag before each candidate.
      const { data: runState } = await supabaseAdmin
        .from("agent_runs")
        .select("cancel_requested")
        .eq("id", runId)
        .single();
      if (runState?.cancel_requested) {
        cancelled = true;
        break;
      }
      try {
        // Preflight DB dedup: skip the scrape entirely if the title clearly
        // matches an existing conference (same name + year).
        const preflightDupe = preflightDbDuplicate(hit);
        if (preflightDupe) {
          skipped++;
          await logCandidate({
            runId,
            hit,
            decision: "skipped",
            reason: `Preflight DB dedup: title matches existing "${preflightDupe.name}" (scrape skipped)`,
            conferenceId: preflightDupe.id,
          });
          continue;
        }

        const markdown = await scrapeMarkdown(firecrawl, hit.url);

        const pageContext = markdown
          ? `--- PAGE CONTENT (markdown, possibly truncated) ---\n${markdown}`
          : `(Page could not be scraped — rely on snippet only.)`;

        const verticalEnumStr = VERTICAL_ENUM.map((v) => `"${v}"`).join(" | ");
        const sharedRules =
          `Rules:\n` +
          `- Set isRelevant=true ONLY if the conference audience includes CFOs, Heads of Payments, Treasury managers, or Product leaders at PSPs, neobanks, marketplaces, embedded-finance providers, cross-border payments, or travel-tech platforms.\n` +
          `- Set isRelevant=false if the primary audience is developers/engineers, academics/researchers, or general enterprise IT — even if "fintech" or "payments" appears on the page.\n` +
          `- Also set isRelevant=false if this is NOT a real upcoming conference (blog post, news, past edition with no future date).\n` +
          `- Use null for any field you cannot determine with confidence. Do NOT invent dates, cities, or audience sizes.\n` +
          `- confidence is 0-100 reflecting how sure you are about isRelevant + the extracted details together.\n` +
          `- officialUrl: the conference's OWN website (e.g. money2020.com, sibos.com). NEVER an aggregator/calendar/blog (fintechprofile.com, paytech.events, thepaypers.com, vendelux.com, medium.com, linkedin.com, etc.). Null if not clearly present on the page.\n`;

        const aggregator = isAggregatorPage(hit);
        let parsedList: z.infer<typeof ExtractionSchema>[] = [];

        if (aggregator && markdown) {
          // Aggregator/list page — ask for an ARRAY of conferences.
          const aggResult = await generateText({
            model,
            temperature: 0,
            prompt:
              `The page below appears to be a LIST/CALENDAR of multiple conferences. Extract every distinct conference you can identify.\n` +
              `Respond with ONLY a single JSON object (no markdown, no code fences) of the shape:\n` +
              `{ "conferences": [ { ...conference fields... }, ... ] }\n` +
              `Each conference object must match:\n` +
              `{\n` +
              `  "name": string,\n` +
              `  "startDate": "YYYY-MM-DD" | null,\n` +
              `  "endDate": "YYYY-MM-DD" | null,\n` +
              `  "city": string | null,\n` +
              `  "country": string | null,\n` +
              `  "region": "North America" | "Europe" | "APAC" | "Middle East" | "LATAM" | null,\n` +
              `  "vertical": ${verticalEnumStr} | null,\n` +
              `  "estimatedAudienceSize": integer | null,\n` +
              `  "tags": string[] (max 8),\n` +
              `  "officialUrl": string | null,\n` +
              `  "isRelevant": boolean,\n` +
              `  "confidence": integer 0-100\n` +
              `}\n` +
              `Return up to ${MAX_AGGREGATOR_ITEMS} entries. If the page is not actually a list, return { "conferences": [] }.\n\n` +
              sharedRules +
              `\nURL: ${hit.url}\nTitle: ${hit.title ?? ""}\nSnippet: ${hit.description ?? ""}\n\n` +
              pageContext,
          });

          const usage = aggResult.usage;
          if (usage) {
            promptTokens += usage.inputTokens ?? 0;
            completionTokens += usage.outputTokens ?? 0;
            totalTokens += usage.totalTokens ?? 0;
          }

          const rawText = aggResult.text ?? "";
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            skipped++;
            await logCandidate({ runId, hit, decision: "error", reason: `Aggregator: no JSON object. Raw: ${rawText.slice(0, 200)}` });
            continue;
          }
          try {
            const obj = JSON.parse(jsonMatch[0]);
            parsedList = AggregatorSchema.parse(obj).conferences;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            skipped++;
            await logCandidate({ runId, hit, decision: "error", reason: `Aggregator parse failed: ${msg}. Raw: ${jsonMatch[0].slice(0, 200)}` });
            continue;
          }
          if (parsedList.length === 0) {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: "Aggregator page returned 0 conferences" });
            continue;
          }
        } else {
          const result = await generateText({
            model,
            temperature: 0,
            prompt:
              `Extract structured data about a single industry conference from the page below.\n` +
              `Respond with ONLY a single JSON object (no markdown, no code fences, no commentary) matching this exact shape:\n` +
              `{\n` +
              `  "name": string,\n` +
              `  "startDate": "YYYY-MM-DD" | null,\n` +
              `  "endDate": "YYYY-MM-DD" | null,\n` +
              `  "city": string | null,\n` +
              `  "country": string | null,\n` +
              `  "region": "North America" | "Europe" | "APAC" | "Middle East" | "LATAM" | null,\n` +
              `  "vertical": ${verticalEnumStr} | null,\n` +
              `  "estimatedAudienceSize": integer | null,\n` +
              `  "tags": string[] (max 8),\n` +
              `  "officialUrl": string | null,\n` +
              `  "isRelevant": boolean,\n` +
              `  "confidence": integer 0-100\n` +
              `}\n\n` +
              sharedRules +
              `\nURL: ${hit.url}\nTitle: ${hit.title ?? ""}\nSnippet: ${hit.description ?? ""}\n\n` +
              pageContext,
          });

          const usage = result.usage;
          if (usage) {
            promptTokens += usage.inputTokens ?? 0;
            completionTokens += usage.outputTokens ?? 0;
            totalTokens += usage.totalTokens ?? 0;
          }

          const rawText = result.text ?? "";
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            skipped++;
            await logCandidate({ runId, hit, decision: "error", reason: `Model returned no JSON object. Raw: ${rawText.slice(0, 200)}` });
            continue;
          }
          try {
            const obj = JSON.parse(jsonMatch[0]);
            parsedList = [ExtractionSchema.parse(obj)];
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            skipped++;
            await logCandidate({ runId, hit, decision: "error", reason: `JSON parse/validation failed: ${msg}. Raw: ${jsonMatch[0].slice(0, 200)}` });
            continue;
          }
        }

        for (const parsed of parsedList) {
          // Hard filter: not relevant
          if (!parsed.isRelevant) {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: "AI marked as not relevant (blog/list/past/news)", extracted: parsed });
            continue;
          }

          if (parsed.region === "LATAM") {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: "LATAM excluded (not in active regions)", extracted: parsed });
            continue;
          }

          if (parsed.region && !ALLOWED_REGIONS.includes(parsed.region as Region)) {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: `Region "${parsed.region}" not in allowed regions`, extracted: parsed });
            continue;
          }

          if (parsed.vertical && !ALLOWED_VERTICALS.includes(parsed.vertical as Vertical)) {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: `Vertical "${parsed.vertical}" not in allowed verticals`, extracted: parsed });
            continue;
          }

          let year = parsed.startDate ? new Date(parsed.startDate).getUTCFullYear() : null;
          const allowedYears = [...yrs];
          const dateMissing = !parsed.startDate;
          const yearInvalid = year !== null && !yrs.has(year);

          // If the first extraction lost the date or returned a nonsense year,
          // do one focused retry asking the AI to re-verify the dates.
          if (dateMissing || yearInvalid) {
            const verified = await verifyConferenceDates({
              model,
              name: parsed.name,
              hit,
              markdown,
              allowedYears,
            });
            if (verified.startDate) {
              parsed.startDate = verified.startDate;
              parsed.endDate = verified.endDate ?? verified.startDate;
              year = new Date(parsed.startDate).getUTCFullYear();
            }
          }

          // After retry: if we still don't have a usable year, skip instead of
          // inserting a 9999 placeholder. This is what produced the bad rows.
          if (!parsed.startDate) {
            skipped++;
            await logCandidate({
              runId,
              hit,
              decision: "skipped",
              reason: "No date found after verification retry — refusing to insert placeholder year",
              extracted: parsed,
            });
            continue;
          }
          if (year === null || !yrs.has(year)) {
            skipped++;
            await logCandidate({
              runId,
              hit,
              decision: "skipped",
              reason: `Year ${year} outside allowed window (${allowedYears.join(", ")}) after verification retry`,
              extracted: parsed,
            });
            continue;
          }

          const missing: string[] = [];
          if (!parsed.endDate) missing.push("end_date");
          if (!parsed.city) missing.push("city");
          if (!parsed.country) missing.push("country");
          if (!parsed.region) missing.push("region");
          if (!parsed.vertical) missing.push("vertical");
          if (parsed.estimatedAudienceSize == null) missing.push("estimated_audience_size");

          const startDate = parsed.startDate;
          const endDate = parsed.endDate ?? startDate;
          const city = parsed.city ?? "Unknown";
          const country = parsed.country ?? "Unknown";
          const region = (parsed.region ?? "North America") as Region;
          const vertical = (parsed.vertical ?? "Fintech") as Vertical;
          const audience = parsed.estimatedAudienceSize ?? 0;
          const dedupYear = year;

          const dedupKey = `${normalizeConfName(parsed.name)}|${dedupYear}|${city.toLowerCase().trim()}`;

          if (blockedKeys.has(dedupKey)) {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: "On do-not-resurrect blocklist", extracted: parsed });
            continue;
          }

          const dupe =
            existingByKey.get(dedupKey) ??
            findExistingFuzzy(parsed.name, dedupYear, city, country, startDate, endDate);
          if (dupe) {
            // Within-run merge: if this dupe was inserted earlier in THIS run,
            // keep the more complete record instead of creating a change flag.
            const insertedMeta = insertedThisRun.get(dupe.id);
            if (insertedMeta) {
              const newScore = scoreExtraction({ audience, city, country, startDate, endDate, sourceUrl: hit.url });
              const preferNew =
                newScore > insertedMeta.score ||
                (newScore === insertedMeta.score && insertedMeta.fromAggregator && !aggregator);
              if (preferNew) {
                const newScoring = computeScoring({ vertical, region, audienceSize: audience, tags: parsed.tags });
                await supabaseAdmin
                  .from("conferences")
                  .update({
                    name: parsed.name,
                    start_date: startDate,
                    end_date: endDate,
                    city,
                    country,
                    region,
                    vertical,
                    estimated_audience_size: audience,
                    tags: parsed.tags,
                    source_url: hit.url,
                    ...newScoring,
                  })
                  .eq("id", dupe.id);
                insertedThisRun.set(dupe.id, { score: newScore, fromAggregator: aggregator });
                await logCandidate({ runId, hit, decision: "added", reason: "Within-run merge: replaced earlier record with more complete data", extracted: parsed, conferenceId: dupe.id });
              } else {
                skipped++;
                await logCandidate({ runId, hit, decision: "skipped", reason: "Within-run duplicate; earlier record was more complete", extracted: parsed, conferenceId: dupe.id });
              }
              continue;
            }

            const changes: { field: string; old: unknown; next: unknown }[] = [];
            if (parsed.startDate && dupe.start_date !== parsed.startDate)
              changes.push({ field: "start_date", old: dupe.start_date, next: parsed.startDate });
            if (parsed.endDate && dupe.end_date !== parsed.endDate)
              changes.push({ field: "end_date", old: dupe.end_date, next: parsed.endDate });
            if (
              parsed.estimatedAudienceSize != null &&
              Math.abs((dupe.estimated_audience_size ?? 0) - parsed.estimatedAudienceSize) >
                Math.max(500, (dupe.estimated_audience_size ?? 0) * 0.2)
            ) {
              changes.push({ field: "estimated_audience_size", old: dupe.estimated_audience_size, next: parsed.estimatedAudienceSize });
            }
            if (changes.length) {
              for (const f of changes) {
                await supabaseAdmin.from("conference_change_flags").insert({
                  conference_id: dupe.id,
                  field: f.field,
                  old_value: f.old as never,
                  new_value: f.next as never,
                  source_url: hit.url,
                });
              }
              flagged += changes.length;
              await logCandidate({ runId, hit, decision: "flagged", reason: `Already exists — flagged ${changes.length} field change(s): ${changes.map((c) => c.field).join(", ")}`, extracted: parsed, conferenceId: dupe.id });
            } else {
              skipped++;
              await logCandidate({ runId, hit, decision: "skipped", reason: "Duplicate of existing conference, no changes", extracted: parsed, conferenceId: dupe.id });
            }
            continue;
          }

          const scoring = computeScoring({
            vertical,
            region,
            audienceSize: audience,
            tags: parsed.tags,
          });

          const lowConfidence = (parsed.confidence ?? 0) < 60;
          const initialStatus = lowConfidence ? "Needs Review" : "Considering";

          // Resolve the conference's own website (separate from source_url).
          const officialUrl = await resolveOfficialUrl(
            firecrawl,
            parsed.name,
            year,
            parsed.officialUrl ?? null,
          );

          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("conferences")
            .insert({
              name: parsed.name,
              start_date: startDate,
              end_date: endDate,
              city,
              country,
              region,
              vertical,
              estimated_audience_size: audience,
              tags: parsed.tags,
              source_url: hit.url,
              official_url: officialUrl,
              ...scoring,
              provenance: "ai_added",
              confidence: parsed.confidence,
              status: initialStatus,
            })
            .select("id")
            .single();

          if (insErr) {
            skipped++;
            await logCandidate({ runId, hit, decision: "skipped", reason: `Insert failed: ${insErr.message}`, extracted: parsed });
            continue;
          }

          // Track the newly-inserted conference so later items in this aggregator
          // (or later candidates this run) deduplicate against it.
          if (inserted?.id) {
            const newRow: ExistingRow = {
              id: inserted.id,
              name: parsed.name,
              start_date: startDate,
              end_date: endDate,
              city,
              country,
              estimated_audience_size: audience,
              source_url: hit.url,
            };
            existingByKey.set(dedupKey, newRow);
            existingList.push(newRow);
            insertedThisRun.set(inserted.id, {
              score: scoreExtraction({ audience, city, country, startDate, endDate, sourceUrl: hit.url }),
              fromAggregator: aggregator,
            });
          }

          const reviewReasons: string[] = [];
          if (missing.length) reviewReasons.push(`missing: ${missing.join(", ")}`);
          if (lowConfidence) reviewReasons.push(`low confidence (${parsed.confidence})`);
          if (!officialUrl) reviewReasons.push("needs_url_review (no official website resolved)");

          // Always flag missing official URL — even on the first run — so the
          // user knows which records lack a clickable destination link.
          if (!officialUrl && inserted?.id) {
            await supabaseAdmin.from("conference_change_flags").insert({
              conference_id: inserted.id,
              field: "needs_url_review",
              old_value: null as never,
              new_value: { reason: "officialUrl could not be resolved" } as never,
              source_url: hit.url,
            });
            flagged += 1;
          }

          if (reviewReasons.length && inserted?.id && !isFirstRun) {
            await supabaseAdmin.from("conference_change_flags").insert({
              conference_id: inserted.id,
              field: "needs_review",
              old_value: null as never,
              new_value: { missing, confidence: parsed.confidence, lowConfidence } as never,
              source_url: hit.url,
            });
            flagged += 1;
            added++;
            await logCandidate({
              runId,
              hit,
              decision: "added",
              reason: `Added with needs_review flag — ${reviewReasons.join("; ")}`,
              extracted: parsed,
              conferenceId: inserted.id,
            });
          } else {
            added++;
            await logCandidate({ runId, hit, decision: "added", reason: `Added — ${vertical} / ${region}${aggregator ? " (from list page)" : ""}`, extracted: parsed, conferenceId: inserted?.id });
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Extraction/insert failed for", hit.url, e);
        skipped++;
        await logCandidate({ runId, hit, decision: "error", reason: `Extraction failed: ${message}` });
      }
    }

    const durationMs = Date.now() - startedAt;
    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: cancelled ? "cancelled" : "success",
        finished_at: new Date().toISOString(),
        found_count: found,
        added_count: added,
        flagged_count: flagged,
        skipped_count: skipped,
        duration_ms: durationMs,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      })
      .eq("id", runId);

    return { runId, found, added, flagged, skipped, durationMs, totalTokens };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    await supabaseAdmin
      .from("agent_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        found_count: found,
        added_count: added,
        flagged_count: flagged,
        skipped_count: skipped,
        duration_ms: durationMs,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        error: message,
      })
      .eq("id", runId);
    return { runId, found, added, flagged, skipped, durationMs, totalTokens, error: message };
  }
}
