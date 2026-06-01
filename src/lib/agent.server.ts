// Discovery agent: Firecrawl search + Gemini structured extraction.
// Server-only — never import from client code.

import Firecrawl from "@mendable/firecrawl-js";
import { generateText, Output } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { computeScoring } from "./scoring";
import type { Region, Vertical } from "./conferences";

const ALLOWED_REGIONS: Region[] = ["North America", "Europe", "APAC", "Middle East"];
const ALLOWED_VERTICALS: Vertical[] = ["Payments", "Fintech", "Treasury", "Travel", "SaaS", "General Tech"];

const MAX_CANDIDATES = 50;

const SEARCH_QUERIES = [
  "fintech conferences 2026 site:.com",
  "payments industry conference 2027",
  "treasury CFO conference 2026 2027",
  "B2B SaaS conference 2026 fintech",
  "travel tech payments conference 2026",
];

const ExtractionSchema = z.object({
  name: z.string(),
  startDate: z.string().describe("ISO date YYYY-MM-DD"),
  endDate: z.string().describe("ISO date YYYY-MM-DD"),
  city: z.string(),
  country: z.string(),
  region: z.enum(["North America", "Europe", "APAC", "Middle East", "LATAM"]),
  vertical: z.enum(["Payments", "Fintech", "Treasury", "Travel", "SaaS", "General Tech"]),
  estimatedAudienceSize: z.number().int().nonnegative(),
  tags: z.array(z.string()).max(8),
  sourceUrl: z.string().url(),
  isRelevant: z.boolean().describe("True only if conference targets fintech, payments, treasury, B2B SaaS, or travel-tech buyers"),
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

function normalizeHits(raw: unknown): SearchHit[] {
  const out: SearchHit[] = [];
  if (!raw) return out;
  const arr = (raw as { web?: SearchHit[]; results?: SearchHit[] }).web
    ?? (raw as { results?: SearchHit[] }).results
    ?? (raw as { data?: SearchHit[] }).data
    ?? (Array.isArray(raw) ? (raw as SearchHit[]) : []);
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
    const model = gateway("google/gemini-3-flash-preview");

    const candidates: SearchHit[] = [];
    const seenUrls = new Set<string>();
    for (const q of SEARCH_QUERIES) {
      if (candidates.length >= MAX_CANDIDATES) break;
      try {
        const res = await firecrawl.search(q, { limit: 10 });
        for (const hit of normalizeHits(res)) {
          if (seenUrls.has(hit.url)) continue;
          seenUrls.add(hit.url);
          candidates.push(hit);
          if (candidates.length >= MAX_CANDIDATES) break;
        }
      } catch (e) {
        console.error(`Firecrawl search failed for "${q}":`, e);
      }
    }
    found = candidates.length;

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
      const key = `${e.name.toLowerCase()}|${new Date(e.start_date).getUTCFullYear()}|${e.city.toLowerCase()}`;
      existingByKey.set(key, e);
    }

    const yrs = yearsAllowed();

    for (const hit of candidates) {
      try {
        const result = await generateText({
          model,
          output: Output.object({ schema: ExtractionSchema }),
          prompt:
            `You are extracting structured data about a single industry conference from a web search result. ` +
            `Return only what you can verify from the snippet. Set isRelevant=false if it's not a fintech/payments/treasury/B2B-SaaS/travel-tech conference, or if it's a past edition, blog post, list article, or generic news. ` +
            `sourceUrl MUST equal the URL provided.\n\n` +
            `URL: ${hit.url}\nTitle: ${hit.title ?? ""}\nDescription: ${hit.description ?? ""}`,
        });

        const usage = result.usage;
        if (usage) {
          promptTokens += usage.inputTokens ?? 0;
          completionTokens += usage.outputTokens ?? 0;
          totalTokens += usage.totalTokens ?? 0;
        }

        const parsed = result.output as z.infer<typeof ExtractionSchema>;

        if (!parsed.isRelevant) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: "AI marked as not relevant (not fintech/payments/treasury/SaaS/travel-tech, or past/blog/list)", extracted: parsed });
          continue;
        }
        if (parsed.sourceUrl !== hit.url) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `sourceUrl mismatch: AI returned ${parsed.sourceUrl}`, extracted: parsed });
          continue;
        }
        const year = new Date(parsed.startDate).getUTCFullYear();
        if (!yrs.has(year)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Year ${year} outside allowed window (${[...yrs].join(", ")})`, extracted: parsed });
          continue;
        }
        if (!ALLOWED_REGIONS.includes(parsed.region as Region)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Region "${parsed.region}" not in allowed regions`, extracted: parsed });
          continue;
        }
        if (!ALLOWED_VERTICALS.includes(parsed.vertical as Vertical)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Vertical "${parsed.vertical}" not in allowed verticals`, extracted: parsed });
          continue;
        }

        const key = `${parsed.name.toLowerCase()}|${year}|${parsed.city.toLowerCase()}`;
        if (blockedKeys.has(key)) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: "On do-not-resurrect blocklist", extracted: parsed });
          continue;
        }

        const dupe = existingByKey.get(key);
        if (dupe) {
          const changes: { field: string; old: unknown; next: unknown }[] = [];
          if (dupe.start_date !== parsed.startDate) changes.push({ field: "start_date", old: dupe.start_date, next: parsed.startDate });
          if (dupe.end_date !== parsed.endDate) changes.push({ field: "end_date", old: dupe.end_date, next: parsed.endDate });
          if (Math.abs((dupe.estimated_audience_size ?? 0) - parsed.estimatedAudienceSize) > Math.max(500, (dupe.estimated_audience_size ?? 0) * 0.2)) {
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
          vertical: parsed.vertical as Vertical,
          region: parsed.region as Region,
          audienceSize: parsed.estimatedAudienceSize,
          tags: parsed.tags,
        });

        const { data: inserted, error: insErr } = await supabaseAdmin.from("conferences").insert({
          name: parsed.name,
          start_date: parsed.startDate,
          end_date: parsed.endDate,
          city: parsed.city,
          country: parsed.country,
          region: parsed.region,
          vertical: parsed.vertical,
          estimated_audience_size: parsed.estimatedAudienceSize,
          tags: parsed.tags,
          source_url: parsed.sourceUrl,
          ...scoring,
          provenance: "ai_added",
          confidence: parsed.confidence,
        }).select("id").single();
        if (insErr) {
          skipped++;
          await logCandidate({ runId, hit, decision: "skipped", reason: `Insert failed (likely duplicate): ${insErr.message}`, extracted: parsed });
        } else {
          added++;
          await logCandidate({ runId, hit, decision: "added", reason: `Added — ${parsed.vertical} / ${parsed.region}`, extracted: parsed, conferenceId: inserted?.id });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Extraction/insert failed for", hit.url, e);
        skipped++;
        await logCandidate({ runId, hit, decision: "error", reason: `Extraction failed: ${message}` });
      }
    }

    const durationMs = Date.now() - startedAt;
    await supabaseAdmin.from("agent_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      found_count: found,
      added_count: added,
      flagged_count: flagged,
      skipped_count: skipped,
      duration_ms: durationMs,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    }).eq("id", runId);

    return { runId, found, added, flagged, skipped, durationMs, totalTokens };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    await supabaseAdmin.from("agent_runs").update({
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
    }).eq("id", runId);
    return { runId, found, added, flagged, skipped, durationMs, totalTokens, error: message };
  }
}
