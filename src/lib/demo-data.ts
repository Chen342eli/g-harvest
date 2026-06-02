// src/lib/demo-data.ts — corrected, deterministic demo data + loader.
// Same public interface Settings already uses: DemoState ("A"|"B"|"C"),
// DEMO_STATES, loadDemoState(state, conferences). No reload here (settings.tsx does it).
//
// Fixes vs the auto-generated version:
//  - Past conferences link to your REAL Supabase conferences (Pay360, Seamless ME),
//    Amsterdam resolved to the live DB row so Floor "leads at this event" matches.
//  - Filler is fully deterministic: exactly 15 leads @ Pay360, 23 @ Seamless,
//    16 @ Amsterdam, and exactly 3 of Maya's Amsterdam captures are incomplete.
//  - Hero AI pre-cached in BOTH B and C (Sarah = "Too early" before, "Warming" after).

import type { Person, Encounter, PeopleData, EncounterVertical, AiNudge } from "./people-types";
import type { ScheduleItem } from "./schedule-store";
import type { Conference } from "./conferences";

// ---- localStorage keys (match the real stores) ----
const K_PEOPLE = "grain-radar.people.v2";
const K_PEOPLE_SEEDED = "grain-radar.people.v2.seeded";
const K_HOT = "grain-harvest.hot-accounts.v1";
const K_HOT_SEEDED = "grain-harvest.hot-accounts.v1.seeded";
const K_SCHEDULE = "grain-harvest.schedule.v1";
const K_SETTINGS = "grain-radar.settings.v1";

// ---- Conference NAME keys (resolved to real ids in the loader) ----
const PAY360 = "Pay360";                 // London, Mar 2026 — PAST — 15 leads
const SEAMLESS = "Seamless Middle East"; // Dubai,  May 2026 — PAST — 23 leads
const AMS = "Money20/20 Europe";         // Amsterdam, Jun 2–4 2026 — ACTIVE

const REPS = {
  maya: "Maya Levi", yossi: "Yossi Adler", dana: "Dana Bar-On",
  carlos: "Carlos Vega", jordan: "Jordan Mitchell", olivia: "Olivia Hart",
} as const;

const HOT_ACCOUNTS = ["Stripe", "Adyen", "Airwallex", "Payoneer", "Booking.com", "Shopify"];

const V = (s: string) => s as EncounterVertical;
const nudge = (subject: string, body: string): AiNudge => ({ channel: "email", subject, body });

const T = { pay360: "2026-03-24T10:00:00.000Z", seamless: "2026-05-20T10:00:00.000Z", ams: "2026-06-03T10:00:00.000Z" };

let _eid = 0;
const eid = () => `demo_e_${++_eid}`;

function enc(p: { personId: string; conferenceName: string; repId: string; temperature: Encounter["temperature"]; timestamp: string; roleAtTime?: string; companyAtTime?: string; vertical?: EncounterVertical; note?: string }): Encounter {
  return { id: eid(), personId: p.personId, conferenceId: "", conferenceName: p.conferenceName, repId: p.repId, timestamp: p.timestamp, temperature: p.temperature, vertical: p.vertical, note: p.note, companyAtTime: p.companyAtTime, roleAtTime: p.roleAtTime, captureMethod: "manual" };
}

// ============================ HERO PEOPLE (State C / "after" values) ============================
const heroes: Person[] = [
  { id: "demo_sarah", fullName: "Sarah Chen", nameVariations: [], linkedInUrl: "https://linkedin.com/in/sarahchen-demo", currentCompany: "PayStream", currentRole: "Head of Treasury", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.yossi, followUpStatus: "pending",
    aiSignal: "Warming", aiConfidence: "high", aiReasoning: "Moved from Treasury Analyst at a logistics firm to Head of Treasury at a PSP (core ICP), and temperature rose from warm to hot across two events — a buying trajectory, not a one-off.", aiArcSummary: "Met warm at Pay360 as an analyst at NovaLogistics; resurfaced in Amsterdam now running treasury at PayStream and scoping embedded FX. The role move into an ICP account is the buying signal — press now.", aiNudge: nudge("Following up from Money20/20 — embedded FX for PayStream", "Hi Sarah, great catching up in Amsterdam, and congrats on the Head of Treasury role at PayStream. You mentioned scoping embedded hedging for your EU flows — I'd love to show how Grain's API lets PayStream lock rates for your end-customers without holding the risk yourselves. I'll send our API docs; could we grab 20 minutes next week? — Dana"), aiGeneratedAt: T.ams },
  { id: "demo_marcus", fullName: "Marcus Webb", nameVariations: [], linkedInUrl: "https://linkedin.com/in/marcuswebb-demo", currentCompany: "Independent", currentRole: "Independent Consultant", currentVertical: V("Other"), createdAt: T.pay360, createdByRepId: REPS.yossi, followUpStatus: "pending",
    aiSignal: "Tire-kicker", aiConfidence: "high", aiReasoning: "Three encounters across the year, always an independent consultant with no buying authority and zero role or company movement — high engagement, no path to a deal.", aiArcSummary: "Friendly and curious at every event, but a year of contact with no client, no budget, no title change. More encounters than Sarah, far lower priority.", aiNudge: nudge("Good seeing you again", "Hi Marcus, good to see you in Amsterdam. I'll keep you on our updates and ping you if something relevant to your projects comes up. — Maya"), aiGeneratedAt: T.ams },
  { id: "demo_daniel", fullName: "Daniel Cohen", nameVariations: ["Dan Cohen", "Daniel Cohen"], linkedInUrl: "https://linkedin.com/in/danielcohen-demo", currentCompany: "FlowPay", currentRole: "VP Payments", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.yossi, followUpStatus: "pending",
    aiSignal: "Steady", aiConfidence: "high", aiReasoning: "Consistent senior payments contact at a PSP across two events; warm but no escalation in role or temperature.", aiArcSummary: "Captured once as 'Daniel' and once as 'Dan' — same person, same LinkedIn. Reliable VP Payments at FlowPay; nurture toward a scoping call.", aiNudge: nudge("Picking up our Pay360 + Dubai chats", "Hi Daniel, we've crossed paths twice now — would love to turn it into a proper conversation about embedded FX for FlowPay. Open to a short call? — Yossi"), aiGeneratedAt: T.seamless },
  { id: "demo_lena", fullName: "Lena Ortiz", nameVariations: [], linkedInUrl: "https://linkedin.com/in/lenaortiz-demo", currentCompany: "Tibo Marketplace", currentRole: "Director of Finance", currentVertical: V("Marketplace"), createdAt: T.seamless, createdByRepId: REPS.dana, followUpStatus: "pending",
    aiSignal: "Warming", aiConfidence: "medium", aiReasoning: "Two different reps independently flagged her as warm at the same event — a strong sign the account is in-market; coordinate before the next touch.", aiArcSummary: "Met by Dana and again by Carlos at Seamless — neither knew about the other. Director of Finance at a marketplace; align internally, then one clean follow-up.", aiNudge: nudge("Great to connect in Dubai", "Hi Lena, lovely to meet at Seamless. Marketplaces like yours are exactly where embedded FX removes treasury headache — happy to share how it works. Free for a quick call? — Dana"), aiGeneratedAt: T.seamless },
  { id: "demo_tomas", fullName: "Tomás Reyes", nameVariations: [], linkedInUrl: "https://linkedin.com/in/tomasreyes-demo", currentCompany: "Airwallex", currentRole: "Treasury Product Manager", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.yossi, followUpStatus: "pending",
    aiSignal: "Warming", aiConfidence: "high", aiReasoning: "Warm across two prior events and hot in Amsterdam; product-side treasury owner at a target account.", aiArcSummary: "Steadily warming Airwallex contact who owns the treasury product surface — hot in Amsterdam. A hot-account relationship worth a real meeting.", aiNudge: nudge("Amsterdam follow-up — Airwallex × Grain", "Hi Tomás, enjoyed the Amsterdam chat. Given where Airwallex is taking treasury products, embedded FX pricing via API could be a strong fit — let me send specs and find time. — Maya"), aiGeneratedAt: T.ams },
  { id: "demo_hannah", fullName: "Hannah Klein", nameVariations: [], linkedInUrl: "https://linkedin.com/in/hannahklein-demo", currentCompany: "Stripe", currentRole: "Strategic Partnerships Manager", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.dana, followUpStatus: "pending",
    aiSignal: "Steady", aiConfidence: "medium", aiReasoning: "Consistently warm partnerships contact at a top target, but no movement toward a commercial conversation.", aiArcSummary: "Friendly Stripe partnerships contact across two events; warm but flat. Keep in touch, look for an internal champion with budget.", aiNudge: nudge("Keeping in touch — Grain × Stripe", "Hi Hannah, always good to catch up. I'll keep you posted as we expand in payments; let me know if a partnerships conversation makes sense this quarter. — Dana"), aiGeneratedAt: T.seamless },
  { id: "demo_priya", fullName: "Priya Nair", nameVariations: [], linkedInUrl: "https://linkedin.com/in/priyanair-demo", currentCompany: "Adyen", currentRole: "Payments Partnerships Lead", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.olivia, followUpStatus: "pending",
    aiSignal: "Warming", aiConfidence: "high", aiReasoning: "Escalated from warm to hot between two events at a top target — clear momentum worth pressing now.", aiArcSummary: "Adyen partnerships lead who went from warm in London to hot in Dubai. Hot account with rising temperature — prioritize.", aiNudge: nudge("From Dubai — let's take Adyen × Grain forward", "Hi Priya, thanks for the energy in Dubai. I think there's a real fit between Adyen's platform and Grain's embedded FX — could we set up a working session with your team? — Carlos"), aiGeneratedAt: T.seamless },
  { id: "demo_diego", fullName: "Diego Navarro", nameVariations: [], linkedInUrl: "https://linkedin.com/in/diegonavarro-demo", currentCompany: "Payoneer", currentRole: "Head of FX Products", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.olivia, followUpStatus: "pending",
    aiSignal: "Steady", aiConfidence: "medium", aiReasoning: "Right title at a target account and reliably warm, but no urgency signal yet.", aiArcSummary: "Head of FX Products at Payoneer — ideal title, steady warmth. Nurture; a product-led angle could accelerate.", aiNudge: nudge("Grain × Payoneer — FX products", "Hi Diego, good to reconnect. Curious whether embedded hedging could complement Payoneer's FX roadmap — open to a short exploratory call? — Olivia"), aiGeneratedAt: T.seamless },
  { id: "demo_kevin", fullName: "Kevin Park", nameVariations: [], linkedInUrl: "https://linkedin.com/in/kevinpark-demo", currentCompany: "Lightspeed", currentRole: "Data Analyst", currentVertical: V("SaaS"), createdAt: T.seamless, createdByRepId: REPS.jordan, followUpStatus: "pending",
    aiSignal: "Too early", aiConfidence: "low", aiReasoning: "A single cold touch with a junior, non-buying contact — not enough to read a trajectory.", aiArcSummary: "One brief cold chat at Seamless. Revisit only if he resurfaces or moves into a buying role.", aiNudge: nudge("Nice meeting you at Seamless", "Hi Kevin, good to meet briefly in Dubai. I'll send a couple of resources you might find useful — happy to reconnect down the line. — Jordan"), aiGeneratedAt: T.seamless },
  { id: "demo_sofia", fullName: "Sofia Marino", nameVariations: [], linkedInUrl: "https://linkedin.com/in/sofiamarino-demo", currentCompany: "Checkout.com", currentRole: "VP Finance", currentVertical: V("Payments"), createdAt: T.pay360, createdByRepId: REPS.dana, followUpStatus: "pending",
    aiSignal: "Steady", aiConfidence: "high", aiReasoning: "Senior finance buyer at a PSP, reliably warm across two events with no downward drift.", aiArcSummary: "VP Finance at Checkout.com, consistently warm. A credible buyer — nurture toward a scoping call.", aiNudge: nudge("Continuing our conversation", "Hi Sofia, enjoyed our chats in London and Dubai. I'd love to walk your team through how embedded FX could fit Checkout.com — when works for a call? — Dana"), aiGeneratedAt: T.seamless },
];

// Sarah's pre-Amsterdam (State B) override
const SARAH_BEFORE: Partial<Person> = {
  currentCompany: "NovaLogistics", currentRole: "Treasury Analyst", currentVertical: V("Treasury"),
  aiSignal: "Too early", aiConfidence: "medium",
  aiReasoning: "One warm touch as a non-decision-maker. Promising vertical, but no trajectory to read yet.",
  aiArcSummary: "Single warm encounter at Pay360 as an analyst at NovaLogistics. Worth a friendly reconnect; needs another data point.",
  aiNudge: nudge("Good to meet at Pay360", "Hi Sarah, enjoyed our chat at Pay360 about FX exposure on your EU receivables. I'll send a short primer on embedded hedging — happy to reconnect whenever useful. — Yossi"),
  aiGeneratedAt: T.pay360,
};

function heroEncounters(): Encounter[] {
  _eid = 0;
  return [
    enc({ personId: "demo_sarah", conferenceName: PAY360, repId: REPS.yossi, temperature: "warm", timestamp: T.pay360, roleAtTime: "Treasury Analyst", companyAtTime: "NovaLogistics", vertical: V("Treasury"), note: "Curious about embedded FX on EU receivables. Not a decision-maker yet." }),
    enc({ personId: "demo_sarah", conferenceName: AMS, repId: REPS.dana, temperature: "hot", timestamp: T.ams, roleAtTime: "Head of Treasury", companyAtTime: "PayStream", vertical: V("Payments"), note: "Now owns FX risk at a PSP. Asked for API docs and pricing." }),
    enc({ personId: "demo_marcus", conferenceName: PAY360, repId: REPS.yossi, temperature: "cold", timestamp: T.pay360, roleAtTime: "Independent Consultant", companyAtTime: "Independent", note: "Lots of questions, no project." }),
    enc({ personId: "demo_marcus", conferenceName: SEAMLESS, repId: REPS.jordan, temperature: "warm", timestamp: T.seamless, roleAtTime: "Independent Consultant", companyAtTime: "Independent", note: "Friendly, still no client or budget." }),
    enc({ personId: "demo_marcus", conferenceName: AMS, repId: REPS.maya, temperature: "cold", timestamp: T.ams, roleAtTime: "Independent Consultant", companyAtTime: "Independent", note: "Same conversation, third time." }),
    enc({ personId: "demo_daniel", conferenceName: PAY360, repId: REPS.yossi, temperature: "warm", timestamp: T.pay360, roleAtTime: "VP Payments", companyAtTime: "FlowPay", vertical: V("Payments"), note: "Captured as 'Daniel'." }),
    enc({ personId: "demo_daniel", conferenceName: SEAMLESS, repId: REPS.jordan, temperature: "warm", timestamp: T.seamless, roleAtTime: "VP Payments", companyAtTime: "FlowPay", vertical: V("Payments"), note: "Captured as 'Dan' — same person." }),
    enc({ personId: "demo_lena", conferenceName: SEAMLESS, repId: REPS.dana, temperature: "warm", timestamp: T.seamless, roleAtTime: "Director of Finance", companyAtTime: "Tibo Marketplace", vertical: V("Marketplace"), note: "Met at the booth." }),
    enc({ personId: "demo_lena", conferenceName: SEAMLESS, repId: REPS.carlos, temperature: "warm", timestamp: T.seamless, roleAtTime: "Director of Finance", companyAtTime: "Tibo Marketplace", vertical: V("Marketplace"), note: "Met again at the side dinner — keen." }),
    enc({ personId: "demo_tomas", conferenceName: PAY360, repId: REPS.yossi, temperature: "warm", timestamp: T.pay360, roleAtTime: "Treasury Product Manager", companyAtTime: "Airwallex", vertical: V("Payments"), note: "Interested in API pricing model." }),
    enc({ personId: "demo_tomas", conferenceName: SEAMLESS, repId: REPS.carlos, temperature: "warm", timestamp: T.seamless, roleAtTime: "Treasury Product Manager", companyAtTime: "Airwallex", vertical: V("Payments"), note: "Following our roadmap." }),
    enc({ personId: "demo_tomas", conferenceName: AMS, repId: REPS.maya, temperature: "hot", timestamp: T.ams, roleAtTime: "Treasury Product Manager", companyAtTime: "Airwallex", vertical: V("Payments"), note: "Wants a technical deep-dive." }),
    enc({ personId: "demo_hannah", conferenceName: PAY360, repId: REPS.dana, temperature: "warm", timestamp: T.pay360, roleAtTime: "Strategic Partnerships Manager", companyAtTime: "Stripe", vertical: V("Payments") }),
    enc({ personId: "demo_hannah", conferenceName: SEAMLESS, repId: REPS.jordan, temperature: "warm", timestamp: T.seamless, roleAtTime: "Strategic Partnerships Manager", companyAtTime: "Stripe", vertical: V("Payments") }),
    enc({ personId: "demo_priya", conferenceName: PAY360, repId: REPS.olivia, temperature: "warm", timestamp: T.pay360, roleAtTime: "Payments Partnerships Lead", companyAtTime: "Adyen", vertical: V("Payments") }),
    enc({ personId: "demo_priya", conferenceName: SEAMLESS, repId: REPS.carlos, temperature: "hot", timestamp: T.seamless, roleAtTime: "Payments Partnerships Lead", companyAtTime: "Adyen", vertical: V("Payments"), note: "Wants to involve her team." }),
    enc({ personId: "demo_diego", conferenceName: PAY360, repId: REPS.olivia, temperature: "warm", timestamp: T.pay360, roleAtTime: "Head of FX Products", companyAtTime: "Payoneer", vertical: V("Payments") }),
    enc({ personId: "demo_diego", conferenceName: SEAMLESS, repId: REPS.carlos, temperature: "warm", timestamp: T.seamless, roleAtTime: "Head of FX Products", companyAtTime: "Payoneer", vertical: V("Payments") }),
    enc({ personId: "demo_kevin", conferenceName: SEAMLESS, repId: REPS.jordan, temperature: "cold", timestamp: T.seamless, roleAtTime: "Data Analyst", companyAtTime: "Lightspeed", vertical: V("SaaS"), note: "Brief chat, junior." }),
    enc({ personId: "demo_sofia", conferenceName: PAY360, repId: REPS.dana, temperature: "warm", timestamp: T.pay360, roleAtTime: "VP Finance", companyAtTime: "Checkout.com", vertical: V("Payments") }),
    enc({ personId: "demo_sofia", conferenceName: SEAMLESS, repId: REPS.dana, temperature: "warm", timestamp: T.seamless, roleAtTime: "VP Finance", companyAtTime: "Checkout.com", vertical: V("Payments") }),
  ];
}

// ============================ Deterministic filler ============================
const FIRST = ["Liam", "Aya", "Mateo", "Yuki", "Ivan", "Lea", "Pim", "Tara", "Niko", "Ruth", "Omar", "Sven", "Mara", "Jonas", "Iris"];
const LAST = ["Brandt", "Okafor", "Silva", "Tan", "Petrov", "Haas", "Vos", "Mehra", "Lund", "Costa"];
const FILLER_CO = ["Wise", "Revolut", "Mollie", "Rapyd", "Nuvei", "Klarna", "GoCardless", "Remitly", "dLocal", "Marqeta", "Ramp", "Brex", "Mercury", "Deel", "Melio", "Tipalti", "Trustly", "Monzo", "Starling", "Nubank"];
const FILLER_ROLE = ["Payments Manager", "Finance Lead", "Treasury Associate", "Product Manager", "Partnerships Manager", "Head of Payments", "FP&A Analyst", "BD Lead"];
const FILLER_TEMP: Encounter["temperature"][] = ["warm", "cold", "warm", "hot", "cold", "warm", "warm", "cold"];
const FILLER_VERT = [V("Payments"), V("Fintech"), V("Treasury"), V("Marketplace"), V("SaaS")];

let _fill = 0;
function makeFiller(conferenceName: string, repPool: string[], count: number, timestamp: string, opts?: { incompleteEvery?: number; createdRep?: string }): { people: Person[]; encounters: Encounter[] } {
  const people: Person[] = []; const encounters: Encounter[] = [];
  for (let i = 0; i < count; i++) {
    const n = _fill++;
    const incomplete = !!opts?.incompleteEvery && i % opts.incompleteEvery === opts.incompleteEvery - 1;
    const rep = repPool[i % repPool.length];
    const id = `demo_f${n}`;
    const fullName = `${FIRST[n % FIRST.length]} ${LAST[Math.floor(n / FIRST.length) % LAST.length]}`;
    const company = incomplete ? undefined : FILLER_CO[n % FILLER_CO.length];
    const role = incomplete ? undefined : FILLER_ROLE[n % FILLER_ROLE.length];
    const vert = FILLER_VERT[n % FILLER_VERT.length];
    const temp = FILLER_TEMP[n % FILLER_TEMP.length];
    people.push({ id, fullName, nameVariations: [], linkedInUrl: incomplete ? undefined : `https://linkedin.com/in/${id}`, currentCompany: company, currentRole: role, currentVertical: vert, createdAt: timestamp, createdByRepId: opts?.createdRep ?? rep, followUpStatus: "pending" });
    encounters.push(enc({ personId: id, conferenceName, repId: rep, temperature: temp, timestamp, roleAtTime: role, companyAtTime: company, vertical: vert, note: incomplete ? undefined : "Booth conversation." }));
  }
  return { people, encounters };
}

// ============================ Assemble ============================
function buildAfter(): { data: PeopleData; schedule: ScheduleItem[]; hotAccounts: string[] } {
  _fill = 0;
  const hEnc = heroEncounters();
  const pay360Fill = makeFiller(PAY360, [REPS.yossi, REPS.dana, REPS.olivia], 7, T.pay360);
  const seamlessFill = makeFiller(SEAMLESS, [REPS.jordan, REPS.carlos, REPS.dana], 13, T.seamless);
  const amsCleanup = makeFiller(AMS, [REPS.maya], 3, T.ams, { incompleteEvery: 1, createdRep: REPS.maya });
  const amsFill = makeFiller(AMS, [REPS.maya, REPS.dana, REPS.carlos, REPS.jordan], 10, T.ams);
  const people = [...heroes, ...pay360Fill.people, ...seamlessFill.people, ...amsCleanup.people, ...amsFill.people];
  const encounters = [...hEnc, ...pay360Fill.encounters, ...seamlessFill.encounters, ...amsCleanup.encounters, ...amsFill.encounters];
  const schedule: ScheduleItem[] = [
    { id: "demo_m1", conferenceId: "", kind: "meeting", date: "2026-06-03", startTime: "10:30", title: "1:1 — Airwallex (embedded FX)", repId: REPS.maya, personId: "demo_tomas", personName: "Tomás Reyes", location: "Hall 4, Meeting Pod B" },
    { id: "demo_m2", conferenceId: "", kind: "meeting", date: "2026-06-03", startTime: "14:00", title: "1:1 — Stripe partnerships", repId: REPS.dana, personId: "demo_hannah", personName: "Hannah Klein", location: "Booth aisle C" },
    { id: "demo_m3", conferenceId: "", kind: "meeting", date: "2026-06-04", startTime: "11:15", title: "1:1 — Adyen (team intro)", repId: REPS.carlos, personId: "demo_priya", personName: "Priya Nair" },
  ];
  return { data: { people, encounters }, schedule, hotAccounts: [...HOT_ACCOUNTS] };
}

function deriveBefore(after: ReturnType<typeof buildAfter>): ReturnType<typeof buildAfter> {
  const encounters = after.data.encounters.filter((e) => e.conferenceName !== AMS);
  const keep = new Set(encounters.map((e) => e.personId));
  const people = after.data.people
    .filter((p) => keep.has(p.id))
    .map((p) => (p.id === "demo_sarah" ? { ...p, ...SARAH_BEFORE } : p));
  return { data: { people, encounters }, schedule: after.schedule, hotAccounts: after.hotAccounts };
}

const AFTER = buildAfter();
const BEFORE = deriveBefore(AFTER);
const EMPTY = { data: { people: [], encounters: [] } as PeopleData, schedule: [] as ScheduleItem[], hotAccounts: [] as string[] };

// ============================ Public interface ============================
export type DemoState = "A" | "B" | "C";

export const DEMO_STATES: { id: DemoState; title: string; desc: string }[] = [
  { id: "A", title: "State A · Clean slate", desc: "No leads, encounters, or schedule. Run the discovery agent to populate conferences, then plan the season from scratch." },
  { id: "B", title: "State B · Before the conference", desc: "Pay360 + Seamless ME history, hot accounts, and 3 scheduled Amsterdam 1:1s. Sarah reads 'Too early'. No Amsterdam captures yet." },
  { id: "C", title: "State C · After the session", desc: "Adds the Amsterdam capture wave (16 leads incl. 3 of Maya's to clean up). Sarah flips to 'Warming'; Follow-ups fully populated." },
];

function resolveConfIds(conferences: Conference[]): { map: Record<string, string>; amsName: string } {
  const find = (re: RegExp, cityRe?: RegExp) => conferences.find((c) => re.test(c.name) && (!cityRe || cityRe.test(c.city)));
  const ams = find(/money\s?20/i, /amsterdam/i) ?? conferences.find((c) => /amsterdam/i.test(c.city));
  const pay = find(/pay\s?360/i);
  const seamless = find(/seamless/i);
  return {
    map: {
      [AMS]: ams?.id ?? AMS,
      [PAY360]: pay?.id ?? PAY360,
      [SEAMLESS]: seamless?.id ?? SEAMLESS,
    },
    amsName: ams?.name ?? AMS,
  };
}

export function loadDemoState(state: DemoState, conferences: Conference[]) {
  if (typeof window === "undefined") return;
  const pick = state === "A" ? EMPTY : state === "B" ? BEFORE : AFTER;
  const { map, amsName } = resolveConfIds(conferences);
  const stamp = (name: string) => map[name] ?? name;
  const encounters = pick.data.encounters.map((e) => ({ ...e, conferenceId: stamp(e.conferenceName) }));
  const schedule = pick.schedule.map((s) => ({ ...s, conferenceId: map[AMS] }));

  const ls = window.localStorage;
  ls.setItem(K_PEOPLE, JSON.stringify({ people: pick.data.people, encounters }));
  ls.setItem(K_PEOPLE_SEEDED, "1");
  ls.setItem(K_HOT, JSON.stringify(pick.hotAccounts));
  ls.setItem(K_HOT_SEEDED, "1");
  ls.setItem(K_SCHEDULE, JSON.stringify(schedule));

  let prev: Record<string, unknown> = {};
  try { prev = JSON.parse(ls.getItem(K_SETTINGS) || "{}"); } catch { prev = {}; }
  ls.setItem(K_SETTINGS, JSON.stringify({
    ...prev,
    activeConferenceId: state === "A" ? undefined : map[AMS],
    activeConferenceName: state === "A" ? undefined : amsName,
    activeRepId: REPS.maya,
    floorPhaseOverride: state === "A" ? null : state === "B" ? "before" : "after",
  }));
}
