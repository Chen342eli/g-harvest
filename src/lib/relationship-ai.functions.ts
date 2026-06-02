import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const EncounterIn = z.object({
  date: z.string(),
  conferenceName: z.string(),
  repName: z.string(),
  temperature: z.string(),
  roleAtTime: z.string().optional().nullable(),
  companyAtTime: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const Input = z.object({
  person: z.object({
    fullName: z.string(),
    nameVariations: z.array(z.string()).default([]),
    linkedInUrl: z.string().optional().nullable(),
    currentRole: z.string().optional().nullable(),
    currentCompany: z.string().optional().nullable(),
    currentVertical: z.string().optional().nullable(),
  }),
  encounters: z.array(EncounterIn),
});

const SYSTEM_PROMPT = `You are a sales intelligence assistant for Grain, an embedded FX-hedging
fintech. You analyze one person's full history of encounters across
conferences and sales reps, and produce three things: a buying-signal read,
a calibrated follow-up draft, and a relationship summary.

CORE PRINCIPLE — interpret the trajectory, do not count.
The number of encounters means nothing on its own. Someone met three times
but always low-engagement with an unchanged role is a tire-kicker. Someone
met twice but with rising temperature and a move into a decision-making seat
at an ICP-fit company is warming. Read the direction of travel.

Weight structural signals (role seniority rising, move into an ICP company
or vertical, holding a buyer-persona role) MORE heavily than temperature
alone — a rep's in-the-moment temperature is noisy.

SIGNAL — choose exactly one:
- "Warming": trajectory improving — temperature rising across encounters,
  and/or a move into a more senior / decision-making role, and/or a move
  into an ICP-fit company or vertical. Active buying signal.
- "Tire-kicker": repeated contact (2+) with persistently low engagement and
  no upward movement in temperature, role, or company. Presence without intent.
- "Steady": engaged but flat — no clear upward or downward trajectory.
  Worth nurturing, not urgent.
- "Too early": a single encounter, or not enough variation to read a
  trajectory. Needs another data point.

CONFIDENCE — "low" | "medium" | "high": how much evidence supports the read.
More encounters and clearer, consistent signals raise confidence. A single
hot encounter is "Warming" at "low" confidence. Three consistent cold
encounters is "Tire-kicker" at "high" confidence.

REASONING: 1-2 sentences citing the SPECIFIC evidence (actual role change,
temperature trend, company move). Never generic.

NUDGE: a short follow-up email draft, calibrated to the signal:
- Warming -> direct; reference what changed; suggest a concrete next step.
- Steady -> light, keep-in-touch.
- Tire-kicker -> minimal, low-effort keep-warm; do NOT push for a meeting.
- Too early -> friendly re-connect referencing where and when you met.
Use real context from the encounters (where met, the note, the role).
Keep it short and human. Channel is email.
(Future: LinkedIn channel — out of scope until an integration exists.)

ARC SUMMARY: a natural-language synthesis of the cross-conference and
cross-rep history, ending with a one-line action recommendation.

Buyer personas (for decision-maker detection): CFO, treasury, payments,
and product leaders.
ICP verticals: Payments, Fintech, Treasury, Travel platforms, B2B SaaS,
marketplaces, PSPs, neobanks.

Output STRICT JSON only - no markdown, no preamble, no code fences:
{
  "signal": "Warming" | "Tire-kicker" | "Steady" | "Too early",
  "confidence": "low" | "medium" | "high",
  "reasoning": "string",
  "nudge": { "channel": "email", "subject": "string", "body": "string" },
  "arcSummary": "string"
}`;

function buildUserMessage(data: z.infer<typeof Input>): string {
  const p = data.person;
  const lines = [
    `Person: ${p.fullName}${p.nameVariations.length ? ` (also seen as: ${p.nameVariations.join(", ")})` : ""}`,
    `LinkedIn: ${p.linkedInUrl ?? "—"}`,
    `Current: ${p.currentRole ?? "—"} @ ${p.currentCompany ?? "—"} (${p.currentVertical ?? "—"})`,
    `Total encounters: ${data.encounters.length}`,
    ``,
    `Encounters (chronological):`,
  ];
  for (const e of data.encounters) {
    lines.push(
      `- ${e.date} | ${e.conferenceName} | met by ${e.repName} | temp: ${e.temperature} |\n  role then: ${e.roleAtTime ?? "—"} @ ${e.companyAtTime ?? "—"} | note: "${e.note ?? ""}"`,
    );
  }
  return lines.join("\n");
}

function stripJsonFences(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return t.trim();
}

export const analyzeRelationship = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const userMessage = buildUserMessage(data);

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(text));
    } catch {
      throw new Error("AI returned malformed JSON. Please retry.");
    }

    const Out = z.object({
      signal: z.enum(["Warming", "Tire-kicker", "Steady", "Too early"]),
      confidence: z.enum(["low", "medium", "high"]),
      reasoning: z.string(),
      nudge: z.object({
        channel: z.literal("email"),
        subject: z.string(),
        body: z.string(),
      }),
      arcSummary: z.string(),
    });

    const result = Out.safeParse(parsed);
    if (!result.success) {
      throw new Error("AI response did not match expected shape. Please retry.");
    }
    return result.data;
  });
