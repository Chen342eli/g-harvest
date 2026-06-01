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
const ALLOWED_VERTICALS: Vertical[] = ["Payments", "Fintech", "Treasury", "Travel", "SaaS", "General Tech"];

const MAX_CANDIDATES = 10; // TEMP: lowered for testing — restore to 50 once verified
const SCRAPE_TIMEOUT_MS = 20_000;

const SEARCH_QUERIES = [
  "fintech conferences 2026 site:.com",
  "payments industry conference 2027",
  "treasury CFO conference 2026 2027",
  "B2B SaaS conference 2026 fintech",
  "travel tech payments conference 2026",
];

// Relaxed schema: anything that isn't certain from the page can be null.
// We will keep the conference anyway and flag it for human review.
const ExtractionSchema = z.object({
  name: z.string(),
  startDate: z.string().nullable().describe("ISO date YYYY-MM-DD or null if not stated"),
  endDate: z.string().nullable().describe("ISO date YYYY-MM-DD or null if not stated"),
  city: z.string().nullable(),
  country: z.string().nullable(),
  region: z
    .enum(["North America", "Europe", "APAC", "Middle East", "LATAM"])
    .nullable(),
  vertical: z
    .enum(["Payments", "Fintech", "Treasury", "Travel", "SaaS", "General Tech"])
    .nullable(),
  estimatedAudienceSize: z.number().int().nonnegative().nullable(),
  tags: z.array(z.string()).max(8).default([]),
  isRelevant: z
    .boolean()
    .describe("True only if this is a real fintech/payments/treasury/B2B-SaaS/travel-tech conference (not a blog post, list article, past edition, or news)"),
  confidence: z.number().int().min(0).max(100),
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

    // 1) Search
    const candidates: SearchHit[] = [];
    const seenUrls = new Set<string>();
    for (const q of SEARCH_QUERIES) {
      if (candidates.length >= MAX_CANDIDATES) break;
      try {
        const res = await firecrawl.search(q, { limit: 10 });
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
      .select("id, name, start_date, city, end_date, estimated_audience_size, source_url")
      .is("deleted_at", null);
    const existingByKey = new Map<string, NonNullable<typeof existing>[number]>();
    for (const e of existing ?? []) {
      const k = `${e.name.toLowerCase()}|${new Date(e.start_date).getUTCFullYear()}|${e.city.toLowerCase()}`;
      existingByKey.set(k, e);
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
        const markdown = await scrapeMarkdown(firecrawl, hit.url);

        const pageContext = markdown
          ? `--- PAGE CONTENT (markdown, possibly truncated) ---\n${markdown}`
          : `(Page could not be scraped — rely on snippet only.)`;

        const result = await generateText({
          model,
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
            `  "vertical": "Payments" | "Fintech" | "Treasury" | "Travel" | "SaaS" | "General Tech" | null,\n` +
            `  "estimatedAudienceSize": integer | null,\n` +
            `  "tags": string[] (max 8),\n` +
            `  "isRelevant": boolean,\n` +
            `  "confidence": integer 0-100\n` +
            `}\n\n` +
            `Rules:\n` +
            `- Set isRelevant=false ONLY if this is clearly NOT a real conference (e.g. blog post, list article, news, past edition with no future date).\n` +
            `- If the page IS a real upcoming fintech/payments/treasury/B2B-SaaS/travel-tech conference, set isRelevant=true even if some details are missing.\n` +
            `- Use null for any field you cannot determine with confidence. Do NOT invent dates, cities, or audience sizes.\n\n` +
            `URL: ${hit.url}\n` +
            `Title: ${hit.title ?? ""}\n` +
            `Snippet: ${hit.description ?? ""}\n\n` +
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
        let parsed: z.infer<typeof ExtractionSchema>;
        try {
          const obj = JSON.parse(jsonMatch[0]);
          parsed = ExtractionSchema.parse(obj);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          skipped++;
          await logCandidate({ runId, hit, decision: "error", reason: `JSON parse/validation failed: ${msg}. Raw: ${jsonMatch[0].slice(0, 200)}` });
          continue;
        }

        // Hard filter: not relevant
        if (!parsed.isRelevant) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: "AI marked as not relevant (blog/list/past/news)", extracted: parsed });
          continue;
        }

        // LATAM excluded for now (per product decision)
        if (parsed.region === "LATAM") {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: "LATAM excluded (not in active regions)", extracted: parsed });
          continue;
        }

        // If region is known but outside allowed set
        if (parsed.region && !ALLOWED_REGIONS.includes(parsed.region as Region)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Region "${parsed.region}" not in allowed regions`, extracted: parsed });
          continue;
        }

        // If vertical is known but outside allowed set
        if (parsed.vertical && !ALLOWED_VERTICALS.includes(parsed.vertical as Vertical)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Vertical "${parsed.vertical}" not in allowed verticals`, extracted: parsed });
          continue;
        }

        // Year window check (only when we have a date)
        const year = parsed.startDate ? new Date(parsed.startDate).getUTCFullYear() : null;
        if (year !== null && !yrs.has(year)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Year ${year} outside allowed window (${[...yrs].join(", ")})`, extracted: parsed });
          continue;
        }

        // Track missing-but-keep fields so we can flag for human review
        const missing: string[] = [];
        if (!parsed.startDate) missing.push("start_date");
        if (!parsed.endDate) missing.push("end_date");
        if (!parsed.city) missing.push("city");
        if (!parsed.country) missing.push("country");
        if (!parsed.region) missing.push("region");
        if (!parsed.vertical) missing.push("vertical");
        if (parsed.estimatedAudienceSize == null) missing.push("estimated_audience_size");

        // Sentinels (DB columns are NOT NULL). UI can spot these + the needs_review flag.
        const startDate = parsed.startDate ?? "9999-12-31";
        const endDate = parsed.endDate ?? startDate;
        const city = parsed.city ?? "Unknown";
        const country = parsed.country ?? "Unknown";
        const region = (parsed.region ?? "North America") as Region;
        const vertical = (parsed.vertical ?? "Fintech") as Vertical;
        const audience = parsed.estimatedAudienceSize ?? 0;
        const dedupYear = year ?? 0;

        const dedupKey = `${parsed.name.toLowerCase()}|${dedupYear}|${city.toLowerCase()}`;

        if (blockedKeys.has(dedupKey)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: "On do-not-resurrect blocklist", extracted: parsed });
          continue;
        }

        const dupe = existingByKey.get(dedupKey);
        if (dupe) {
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

        // Insert (using sentinels for any missing required fields)
        const scoring = computeScoring({
          vertical,
          region,
          audienceSize: audience,
          tags: parsed.tags,
        });

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
            ...scoring,
            provenance: "ai_added",
            confidence: parsed.confidence,
          })
          .select("id")
          .single();

        if (insErr) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Insert failed: ${insErr.message}`, extracted: parsed });
          continue;
        }

        // If anything was missing, raise a needs_review flag so a human can fill it in.
        if (missing.length && inserted?.id) {
          await supabaseAdmin.from("conference_change_flags").insert({
            conference_id: inserted.id,
            field: "needs_review",
            old_value: null as never,
            new_value: { missing } as never,
            source_url: hit.url,
          });
          flagged += 1;
          added++;
          await logCandidate({
            runId,
            hit,
            decision: "added",
            reason: `Added with needs_review flag — missing: ${missing.join(", ")}`,
            extracted: parsed,
            conferenceId: inserted.id,
          });
        } else {
          added++;
          await logCandidate({ runId, hit, decision: "added", reason: `Added — ${vertical} / ${region}`, extracted: parsed, conferenceId: inserted?.id });
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
