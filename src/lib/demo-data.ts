// Grain Harvest — demo data snapshots & loader.
//
// Three buttons (Settings → Demo data) FORCE-OVERWRITE localStorage with one
// coherent demo world at three points in time:
//   A — Clean slate (empty captures, default hot accounts)
//   B — Pre-event   (heroes + C1/C2 history, schedule for Amsterdam, no Ams captures yet)
//   C — Mid-event   (B + Amsterdam capture wave + pre-cached AI on hero people)
//
// Hero people carry the demo and have authored, deterministic AI fields so the
// live demo doesn't depend on the gateway. Filler leads have no pre-cached AI —
// the existing useBulkAiReads hook generates their signals on load (visible
// proof the engine is working).

import type {
  AiConfidence,
  AiNudge,
  AiSignal,
  Encounter,
  PeopleData,
  Person,
  Temperature,
} from "./people-types";
import type { ScheduleItem } from "./schedule-store";
import type { Conference } from "./conferences";

// ----- localStorage keys (must match the actual stores) -----
const K_PEOPLE = "grain-radar.people.v2";
const K_PEOPLE_SEEDED = "grain-radar.people.v2.seeded";
const K_HOT = "grain-harvest.hot-accounts.v1";
const K_HOT_SEEDED = "grain-harvest.hot-accounts.v1.seeded";
const K_SCHEDULE = "grain-harvest.schedule.v1";
const K_SETTINGS = "grain-radar.settings.v1";

// ----- IDs -----
const AMSTERDAM_PLACEHOLDER = "demo-ams-money2020-eu-2026";
const C1_ID = "demo-c1-eurofinance-bcn-2025";
const C2_ID = "demo-c2-money2020-usa-2025";

const C1_NAME = "EuroFinance Treasury Week 2025";
const C2_NAME = "Money20/20 USA 2025";
const AMS_NAME = "Money20/20 Europe 2026";

// ----- Reps -----
const REPS = {
  maya: "Maya Levi",
  yossi: "Yossi Adler",
  dana: "Dana Bar-On",
  carlos: "Carlos Vega",
  jordan: "Jordan Mitchell",
  olivia: "Olivia Hart",
} as const;

// ----- Hot accounts list -----
const HOT_ACCOUNTS = ["Stripe", "Adyen", "Airwallex", "Payoneer", "Booking.com", "Shopify"];

// ----- Hero person definitions -----
interface HeroDef {
  id: string;
  fullName: string;
  nameVariations: string[];
  linkedInUrl: string;
  currentRole: string;
  currentCompany: string;
  ai: {
    signal: AiSignal;
    confidence: AiConfidence;
    reasoning: string;
    nudge: AiNudge;
  };
  // Variant of AI for State B (only C1 encounter exists) — optional.
  aiStateB?: {
    signal: AiSignal;
    confidence: AiConfidence;
    reasoning: string;
    nudge: AiNudge;
  };
}

const HEROES: HeroDef[] = [
  {
    id: "demo_sarah",
    fullName: "Sarah Chen",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/sarahchen-treasury",
    currentRole: "Head of Treasury",
    currentCompany: "PayStream",
    ai: {
      signal: "Warming",
      confidence: "high",
      reasoning:
        "Moved from analyst at a logistics firm to Head of Treasury at a PSP (core ICP), and temperature rose across two events — a buying trajectory, not a one-off.",
      nudge: {
        channel: "email",
        subject: "Following up from Money20/20 — embedded FX for PayStream",
        body:
          "Hi Sarah,\n\nGreat catching up in Amsterdam, and congrats on the Head of Treasury role at PayStream. You mentioned scoping embedded hedging for your EU flows — I'd love to show how Grain's API lets PayStream lock rates for your end-customers without holding the risk yourselves.\n\nI'll send our API docs separately; could we grab 20 minutes next week?\n\nBest,\nDana",
      },
    },
    aiStateB: {
      signal: "Too early",
      confidence: "medium",
      reasoning:
        "One warm touch as a non-decision-maker. Promising vertical, but no trajectory yet.",
      nudge: {
        channel: "email",
        subject: "Nice to meet you at EuroFinance",
        body:
          "Hi Sarah,\n\nThanks for the chat in Barcelona. Happy to share a primer on embedded FX whenever it's useful — no rush.\n\nBest,\nYossi",
      },
    },
  },
  {
    id: "demo_marcus",
    fullName: "Marcus Webb",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/marcuswebb-consult",
    currentRole: "Independent Consultant",
    currentCompany: "Independent",
    ai: {
      signal: "Tire-kicker",
      confidence: "high",
      reasoning:
        "Three encounters over a year, always an independent consultant with no buying authority and zero role or company movement — high engagement, no path to a deal.",
      nudge: {
        channel: "email",
        subject: "Quick hello",
        body:
          "Hi Marcus,\n\nLow-priority: keeping you on a light quarterly touch. Ping me if a client project ever needs embedded FX.\n\nBest,\nMaya",
      },
    },
  },
  {
    id: "demo_daniel",
    fullName: "Daniel Cohen",
    nameVariations: ["Dan Cohen", "Daniel Cohen"],
    linkedInUrl: "https://linkedin.com/in/danielcohen-flowpay",
    currentRole: "VP Payments",
    currentCompany: "FlowPay",
    ai: {
      signal: "Steady",
      confidence: "high",
      reasoning:
        "Consistent senior payments contact at a PSP across two events; warm but no escalation yet.",
      nudge: {
        channel: "email",
        subject: "Continuing our FlowPay conversation",
        body:
          "Hi Daniel,\n\nGood to reconnect in Vegas. Want to set up a working session on the embedded-FX use case we sketched out?\n\nBest,\nJordan",
      },
    },
  },
  {
    id: "demo_lena",
    fullName: "Lena Ortiz",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/lenaortiz",
    currentRole: "Product Lead, Payments",
    currentCompany: "Mollie",
    ai: {
      signal: "Warming",
      confidence: "medium",
      reasoning:
        "Two reps independently flagged her as warm at the same event — strong signal the account is in-market; coordinate before the next touch.",
      nudge: {
        channel: "email",
        subject: "Mollie × Grain — joint follow-up",
        body:
          "Hi Lena,\n\nDana and Carlos both enjoyed meeting you in Vegas. Rather than double-ping you, we'd love one call to walk Mollie through embedded FX for your merchants. Does next Tuesday work?\n\nBest,\nDana",
      },
    },
  },
  {
    id: "demo_tomas",
    fullName: "Tomás Reyes",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/tomasreyes",
    currentRole: "Treasury Product Manager",
    currentCompany: "Airwallex",
    ai: {
      signal: "Warming",
      confidence: "high",
      reasoning:
        "Warm across two prior events and hot in Amsterdam; product-side treasury owner at a target account.",
      nudge: {
        channel: "email",
        subject: "Airwallex × Grain — picking up from Amsterdam",
        body:
          "Hi Tomás,\n\nReally enjoyed the deep-dive in Amsterdam. You asked about per-currency hedging APIs — want me to walk your team through a sandbox next week?\n\nBest,\nMaya",
      },
    },
  },
  {
    id: "demo_hannah",
    fullName: "Hannah Klein",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/hannahklein",
    currentRole: "Strategic Partnerships Manager",
    currentCompany: "Stripe",
    ai: {
      signal: "Steady",
      confidence: "medium",
      reasoning:
        "Consistently warm partnerships contact, but no movement toward a commercial conversation.",
      nudge: {
        channel: "email",
        subject: "Stripe partnerships — keeping the door open",
        body:
          "Hi Hannah,\n\nAlways good to see you. When Stripe is ready to scope embedded FX for a partner segment, we'd love to be the reference. Lunch next time you're in town?\n\nBest,\nDana",
      },
    },
  },
  {
    id: "demo_priya",
    fullName: "Priya Nair",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/priyanair",
    currentRole: "Payments Partnerships Lead",
    currentCompany: "Adyen",
    ai: {
      signal: "Warming",
      confidence: "high",
      reasoning:
        "Escalated from warm to hot between two events at a top target — momentum worth pressing now.",
      nudge: {
        channel: "email",
        subject: "Adyen × Grain — let's keep the momentum",
        body:
          "Hi Priya,\n\nVegas felt like a step-change. Want to put 30 minutes on the calendar next week to map out a pilot scope?\n\nBest,\nCarlos",
      },
    },
  },
  {
    id: "demo_diego",
    fullName: "Diego Navarro",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/diegonavarro",
    currentRole: "Head of FX Products",
    currentCompany: "Payoneer",
    ai: {
      signal: "Steady",
      confidence: "medium",
      reasoning:
        "Right title at a target account, steady warmth, no urgency signal yet.",
      nudge: {
        channel: "email",
        subject: "Payoneer FX — staying in touch",
        body:
          "Hi Diego,\n\nThanks again for the time in Vegas. When the FX roadmap firms up for next year, would love to compare notes.\n\nBest,\nOlivia",
      },
    },
  },
  {
    id: "demo_kevin",
    fullName: "Kevin Park",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/kevinpark",
    currentRole: "Data Analyst",
    currentCompany: "Lightspeed",
    ai: {
      signal: "Too early",
      confidence: "low",
      reasoning:
        "Single cold touch, junior, no buying role — revisit only if he resurfaces.",
      nudge: {
        channel: "email",
        subject: "Nice meeting you",
        body:
          "Hi Kevin,\n\nThanks for stopping by the booth — if FX ever lands on your team's roadmap, you know where to find us.\n\nBest,\nJordan",
      },
    },
  },
  {
    id: "demo_sofia",
    fullName: "Sofia Marino",
    nameVariations: [],
    linkedInUrl: "https://linkedin.com/in/sofiamarino",
    currentRole: "VP Finance",
    currentCompany: "Checkout.com",
    ai: {
      signal: "Steady",
      confidence: "high",
      reasoning:
        "Senior finance buyer at a PSP, reliably warm; nurture toward a scoping call.",
      nudge: {
        channel: "email",
        subject: "Checkout.com — scoping call?",
        body:
          "Hi Sofia,\n\nTwo good chats in a row tells me there's a there there. Want to put 30 minutes on the calendar to scope what a pilot might look like?\n\nBest,\nDana",
      },
    },
  },
];

// ----- Filler ICP pool -----
const FILLER_COMPANIES = [
  "Wise", "Revolut", "Rapyd", "Nuvei", "Klarna",
  "GoCardless", "Remitly", "dLocal", "Marqeta", "Ramp",
  "Brex", "Mercury", "Deel", "Melio", "Tipalti",
  "Trustly", "Booking.com", "Expedia", "Deliveroo", "Nubank",
  "Monzo", "Starling", "Shopify",
];

const FILLER_ROLES = [
  "CFO", "VP Finance", "Head of Treasury", "Treasury Analyst",
  "Director of Payments", "VP Payments", "Payments Product Manager",
  "Head of FX", "Treasury Operations Lead", "Product Lead, Payments",
];

const FILLER_FIRST = [
  "Alex", "Sam", "Jordan", "Casey", "Morgan", "Riley", "Avery", "Quinn",
  "Noa", "Eitan", "Maya", "Yara", "Ines", "Ravi", "Aditi", "Mei", "Hugo",
  "Lea", "Pablo", "Sofia", "Mateo", "Eleni", "Anders", "Ingrid", "Kostas",
];
const FILLER_LAST = [
  "Bauer", "Lindgren", "Okafor", "Petrov", "Costa", "Singh", "Tanaka", "Mensah",
  "Friedman", "Ahmadi", "Rosen", "Kapoor", "Müller", "Dubois", "Nakamura",
  "Hassan", "Khan", "García", "Rossi", "Andersen", "Vlachos", "Patel",
];

interface BuildOpts {
  amsConfId: string; // real DB id if found
  amsConfName: string;
  includeAmsterdamWave: boolean;
  includePreCachedAi: boolean;
}

function mkPerson(
  id: string,
  fullName: string,
  linkedInUrl: string,
  currentRole: string,
  currentCompany: string,
  createdAt: string,
  createdByRepId: string,
  nameVariations: string[] = [],
): Person {
  return {
    id,
    fullName,
    nameVariations,
    linkedInUrl,
    currentCompany,
    currentRole,
    createdAt,
    createdByRepId,
    followUpStatus: "pending",
  };
}

function mkEnc(
  id: string,
  personId: string,
  conferenceId: string,
  conferenceName: string,
  repId: string,
  timestamp: string,
  temperature: Temperature,
  role: string,
  company: string,
  note?: string,
): Encounter {
  return {
    id,
    personId,
    conferenceId,
    conferenceName,
    repId,
    timestamp,
    temperature,
    roleAtTime: role,
    companyAtTime: company,
    note,
    captureMethod: "manual",
  };
}

// Deterministic PRNG so filler is stable across button presses.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFillerForConf(
  rand: () => number,
  count: number,
  conferenceId: string,
  conferenceName: string,
  isoDate: string,
  seedOffset: number,
): { people: Person[]; encs: Encounter[] } {
  const people: Person[] = [];
  const encs: Encounter[] = [];
  const reps = Object.values(REPS);
  for (let i = 0; i < count; i++) {
    const first = FILLER_FIRST[Math.floor(rand() * FILLER_FIRST.length)];
    const last = FILLER_LAST[Math.floor(rand() * FILLER_LAST.length)];
    const company = FILLER_COMPANIES[Math.floor(rand() * FILLER_COMPANIES.length)];
    const role = FILLER_ROLES[Math.floor(rand() * FILLER_ROLES.length)];
    const rep = reps[Math.floor(rand() * reps.length)];
    const r = rand();
    const temp: Temperature = r < 0.2 ? "hot" : r < 0.7 ? "warm" : "cold";
    const pid = `demo_filler_${seedOffset}_${i}`;
    const slug = `${first}${last}${seedOffset}${i}`.toLowerCase();
    people.push(
      mkPerson(
        pid,
        `${first} ${last}`,
        `https://linkedin.com/in/${slug}`,
        role,
        company,
        isoDate,
        rep,
      ),
    );
    encs.push(
      mkEnc(
        `demo_filler_e_${seedOffset}_${i}`,
        pid,
        conferenceId,
        conferenceName,
        rep,
        isoDate,
        temp,
        role,
        company,
      ),
    );
  }
  return { people, encs };
}

function applyAi(p: Person, ai: HeroDef["ai"], when: string): Person {
  return {
    ...p,
    aiSignal: ai.signal,
    aiConfidence: ai.confidence,
    aiReasoning: ai.reasoning,
    aiNudge: ai.nudge,
    aiGeneratedAt: when,
  };
}

function buildHeroes(opts: BuildOpts): { people: Person[]; encs: Encounter[] } {
  const aiStamp = "2026-06-05T18:00:00.000Z";
  const people: Person[] = [];
  const encs: Encounter[] = [];

  // SARAH
  {
    const h = HEROES[0];
    let p = mkPerson(
      h.id,
      h.fullName,
      h.linkedInUrl,
      opts.includeAmsterdamWave ? "Head of Treasury" : "Treasury Analyst",
      opts.includeAmsterdamWave ? "PayStream" : "NovaLogistics",
      "2025-10-15T10:00:00.000Z",
      REPS.yossi,
    );
    if (opts.includePreCachedAi) {
      p = applyAi(p, opts.includeAmsterdamWave ? h.ai : (h.aiStateB ?? h.ai), aiStamp);
    }
    people.push(p);
    encs.push(
      mkEnc("demo_e_sarah_c1", h.id, C1_ID, C1_NAME, REPS.yossi,
        "2025-10-15T11:30:00.000Z", "warm",
        "Treasury Analyst", "NovaLogistics",
        "Curious about FX exposure on EU receivables. Not a decision-maker yet."),
    );
    if (opts.includeAmsterdamWave) {
      encs.push(
        mkEnc("demo_e_sarah_ams", h.id, opts.amsConfId, opts.amsConfName, REPS.dana,
          "2026-06-04T14:20:00.000Z", "hot",
          "Head of Treasury", "PayStream",
          "Now runs treasury at a PSP. Actively scoping embedded hedging; asked for API docs."),
      );
    }
  }
  // MARCUS
  {
    const h = HEROES[1];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.yossi);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_marcus_c1", h.id, C1_ID, C1_NAME, REPS.yossi,
        "2025-10-16T10:00:00.000Z", "cold", h.currentRole, h.currentCompany,
        "Collected materials, lots of questions, no authority."),
      mkEnc("demo_e_marcus_c2", h.id, C2_ID, C2_NAME, REPS.jordan,
        "2025-10-28T15:00:00.000Z", "warm", h.currentRole, h.currentCompany,
        "Friendly again, still no client, still no budget."),
    );
    if (opts.includeAmsterdamWave) {
      encs.push(
        mkEnc("demo_e_marcus_ams", h.id, opts.amsConfId, opts.amsConfName, REPS.maya,
          "2026-06-03T12:00:00.000Z", "cold", h.currentRole, h.currentCompany,
          "Same conversation a third time."),
      );
    }
  }
  // DANIEL — dedup story
  {
    const h = HEROES[2];
    let p = mkPerson(h.id, "Daniel Cohen", h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.yossi, ["Dan Cohen"]);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_daniel_c1", h.id, C1_ID, C1_NAME, REPS.yossi,
        "2025-10-15T13:00:00.000Z", "warm", "VP Payments", "FlowPay",
        "Captured as 'Daniel Cohen'."),
      mkEnc("demo_e_daniel_c2", h.id, C2_ID, C2_NAME, REPS.jordan,
        "2025-10-27T16:00:00.000Z", "warm", "VP Payments", "FlowPay",
        "Captured as 'Dan Cohen'."),
    );
  }
  // LENA — cross-rep
  {
    const h = HEROES[3];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-27T10:00:00.000Z", REPS.dana);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_lena_c2a", h.id, C2_ID, C2_NAME, REPS.dana,
        "2025-10-27T11:00:00.000Z", "warm", h.currentRole, h.currentCompany,
        "Met at booth — keen on embedded FX for marketplaces."),
      mkEnc("demo_e_lena_c2b", h.id, C2_ID, C2_NAME, REPS.carlos,
        "2025-10-27T19:30:00.000Z", "warm", h.currentRole, h.currentCompany,
        "Met again at the side dinner — didn't know Dana had already chatted."),
    );
  }
  // TOMAS — hot account, escalating
  {
    const h = HEROES[4];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.yossi);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_tomas_c1", h.id, C1_ID, C1_NAME, REPS.yossi,
        "2025-10-15T14:00:00.000Z", "warm", h.currentRole, h.currentCompany,
        "Active on hedging APIs."),
      mkEnc("demo_e_tomas_c2", h.id, C2_ID, C2_NAME, REPS.carlos,
        "2025-10-28T11:00:00.000Z", "warm", h.currentRole, h.currentCompany,
        "Brought a colleague this time."),
    );
    if (opts.includeAmsterdamWave) {
      encs.push(
        mkEnc("demo_e_tomas_ams", h.id, opts.amsConfId, opts.amsConfName, REPS.maya,
          "2026-06-04T10:00:00.000Z", "hot", h.currentRole, h.currentCompany,
          "Deep-dive on per-currency hedging APIs; wants a sandbox walkthrough."),
      );
    }
  }
  // HANNAH — Stripe
  {
    const h = HEROES[5];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.dana);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_hannah_c1", h.id, C1_ID, C1_NAME, REPS.dana,
        "2025-10-16T14:00:00.000Z", "warm", h.currentRole, h.currentCompany),
      mkEnc("demo_e_hannah_c2", h.id, C2_ID, C2_NAME, REPS.jordan,
        "2025-10-28T13:00:00.000Z", "warm", h.currentRole, h.currentCompany),
    );
  }
  // PRIYA — Adyen
  {
    const h = HEROES[6];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.olivia);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_priya_c1", h.id, C1_ID, C1_NAME, REPS.olivia,
        "2025-10-16T15:00:00.000Z", "warm", h.currentRole, h.currentCompany),
      mkEnc("demo_e_priya_c2", h.id, C2_ID, C2_NAME, REPS.carlos,
        "2025-10-28T14:30:00.000Z", "hot", h.currentRole, h.currentCompany,
        "Brought up a concrete pilot scope."),
    );
  }
  // DIEGO — Payoneer
  {
    const h = HEROES[7];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.olivia);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_diego_c1", h.id, C1_ID, C1_NAME, REPS.olivia,
        "2025-10-16T11:00:00.000Z", "warm", h.currentRole, h.currentCompany),
      mkEnc("demo_e_diego_c2", h.id, C2_ID, C2_NAME, REPS.carlos,
        "2025-10-27T15:00:00.000Z", "warm", h.currentRole, h.currentCompany),
    );
  }
  // KEVIN — too early
  {
    const h = HEROES[8];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-27T10:00:00.000Z", REPS.jordan);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_kevin_c2", h.id, C2_ID, C2_NAME, REPS.jordan,
        "2025-10-27T17:00:00.000Z", "cold", h.currentRole, h.currentCompany,
        "Junior data role; no buying authority."),
    );
  }
  // SOFIA — steady ICP
  {
    const h = HEROES[9];
    let p = mkPerson(h.id, h.fullName, h.linkedInUrl, h.currentRole, h.currentCompany,
      "2025-10-15T10:00:00.000Z", REPS.dana);
    if (opts.includePreCachedAi) p = applyAi(p, h.ai, aiStamp);
    people.push(p);
    encs.push(
      mkEnc("demo_e_sofia_c1", h.id, C1_ID, C1_NAME, REPS.dana,
        "2025-10-16T12:00:00.000Z", "warm", h.currentRole, h.currentCompany),
      mkEnc("demo_e_sofia_c2", h.id, C2_ID, C2_NAME, REPS.dana,
        "2025-10-28T10:00:00.000Z", "warm", h.currentRole, h.currentCompany),
    );
  }

  return { people, encs };
}

// Add Amsterdam-wave filler with ~3 incomplete Maya captures.
function buildAmsterdamFiller(
  rand: () => number,
  conferenceId: string,
  conferenceName: string,
): { people: Person[]; encs: Encounter[] } {
  const people: Person[] = [];
  const encs: Encounter[] = [];
  const reps = [REPS.maya, REPS.dana, REPS.carlos, REPS.jordan];
  const COUNT = 13;
  for (let i = 0; i < COUNT; i++) {
    const first = FILLER_FIRST[Math.floor(rand() * FILLER_FIRST.length)];
    const last = FILLER_LAST[Math.floor(rand() * FILLER_LAST.length)];
    const company = FILLER_COMPANIES[Math.floor(rand() * FILLER_COMPANIES.length)];
    const role = FILLER_ROLES[Math.floor(rand() * FILLER_ROLES.length)];
    const rep = reps[Math.floor(rand() * reps.length)];
    const r = rand();
    const temp: Temperature = r < 0.25 ? "hot" : r < 0.75 ? "warm" : "cold";
    const pid = `demo_ams_filler_${i}`;
    const slug = `${first}${last}ams${i}`.toLowerCase();

    // ~3 of Maya's captures are incomplete (no LinkedIn or no role).
    const isIncompleteMaya = rep === REPS.maya && i % 4 === 0;
    const linkedIn = isIncompleteMaya ? undefined : `https://linkedin.com/in/${slug}`;
    const finalRole = isIncompleteMaya && i % 8 === 0 ? "" : role;

    people.push({
      id: pid,
      fullName: `${first} ${last}`,
      nameVariations: [],
      linkedInUrl: linkedIn,
      currentCompany: company,
      currentRole: finalRole || undefined,
      createdAt: "2026-06-03T11:00:00.000Z",
      createdByRepId: rep,
      followUpStatus: "pending",
    });
    encs.push(
      mkEnc(
        `demo_ams_filler_e_${i}`,
        pid,
        conferenceId,
        conferenceName,
        rep,
        `2026-06-0${3 + (i % 3)}T${10 + (i % 6)}:${(i * 7) % 60 < 10 ? "0" : ""}${(i * 7) % 60}:00.000Z`,
        temp,
        finalRole || role,
        company,
      ),
    );
  }
  return { people, encs };
}

// ----- Snapshot builders -----
export type DemoState = "A" | "B" | "C";

interface Snapshot {
  people: PeopleData;
  schedule: ScheduleItem[];
  hotAccounts: string[];
  activeConferenceId?: string;
  activeConferenceName?: string;
  activeRepId: string;
}

function buildAmsSchedule(amsConfId: string): ScheduleItem[] {
  return [
    {
      id: "demo_meet_tomas",
      conferenceId: amsConfId,
      kind: "meeting",
      date: "2026-06-04",
      startTime: "10:00",
      endTime: "10:30",
      title: "1:1 — Airwallex (Tomás Reyes)",
      repId: REPS.maya,
      personId: "demo_tomas",
      personName: "Tomás Reyes",
    },
    {
      id: "demo_meet_hannah",
      conferenceId: amsConfId,
      kind: "meeting",
      date: "2026-06-03",
      startTime: "14:00",
      endTime: "14:30",
      title: "1:1 — Stripe (Hannah Klein)",
      repId: REPS.dana,
      personId: "demo_hannah",
      personName: "Hannah Klein",
    },
    {
      id: "demo_meet_priya",
      conferenceId: amsConfId,
      kind: "meeting",
      date: "2026-06-04",
      startTime: "15:00",
      endTime: "15:30",
      title: "1:1 — Adyen (Priya Nair)",
      repId: REPS.carlos,
      personId: "demo_priya",
      personName: "Priya Nair",
    },
  ];
}

function buildSnapshot(state: DemoState, amsConfId: string, amsConfName: string): Snapshot {
  if (state === "A") {
    return {
      people: { people: [], encounters: [] },
      schedule: [],
      hotAccounts: [],
      activeConferenceId: undefined,
      activeConferenceName: undefined,
      activeRepId: REPS.maya,
    };
  }

  const includeAms = state === "C";
  const opts: BuildOpts = {
    amsConfId,
    amsConfName,
    includeAmsterdamWave: includeAms,
    includePreCachedAi: state === "C",
  };

  const heroes = buildHeroes(opts);

  // Filler — heroes already contribute encounters per conf.
  // Target totals: C1=15, C2=23.
  // Heroes at C1: Sarah, Marcus, Daniel, Tomas, Hannah, Priya, Diego, Sofia = 8 → need 7
  // Heroes at C2 unique people: Marcus, Daniel, Lena(2 encs but 1 person), Tomas, Hannah, Priya, Diego, Kevin, Sofia = 9 people, 10 encs → need 13 to hit 23
  const rand = mulberry32(42);
  const c1Fill = buildFillerForConf(rand, 7, C1_ID, C1_NAME, "2025-10-16T12:00:00.000Z", 1);
  const c2Fill = buildFillerForConf(rand, 13, C2_ID, C2_NAME, "2025-10-28T12:00:00.000Z", 2);

  const all: PeopleData = {
    people: [...heroes.people, ...c1Fill.people, ...c2Fill.people],
    encounters: [...heroes.encs, ...c1Fill.encs, ...c2Fill.encs],
  };

  if (includeAms) {
    const amsFill = buildAmsterdamFiller(rand, amsConfId, amsConfName);
    all.people.push(...amsFill.people);
    all.encounters.push(...amsFill.encs);
  }

  return {
    people: all,
    schedule: buildAmsSchedule(amsConfId),
    hotAccounts: [...HOT_ACCOUNTS],
    activeConferenceId: amsConfId,
    activeConferenceName: amsConfName,
    activeRepId: REPS.maya,
  };
}

// ----- Loader -----
function findAmsterdamConference(conferences: Conference[]): { id: string; name: string } {
  // Prefer the real DB conference so Floor's selector picks it up.
  const match =
    conferences.find(
      (c) => /money.?20/i.test(c.name) && c.city === "Amsterdam",
    ) ||
    conferences.find((c) => c.city === "Amsterdam");
  if (match) return { id: match.id, name: match.name };
  return { id: AMSTERDAM_PLACEHOLDER, name: AMS_NAME };
}

export function loadDemoState(state: DemoState, conferences: Conference[]) {
  if (typeof window === "undefined") return;
  const ams = findAmsterdamConference(conferences);
  const snap = buildSnapshot(state, ams.id, ams.name);

  // Overwrite people store
  window.localStorage.setItem(K_PEOPLE, JSON.stringify(snap.people));
  window.localStorage.setItem(K_PEOPLE_SEEDED, "1");

  // Overwrite hot accounts
  window.localStorage.setItem(K_HOT, JSON.stringify(snap.hotAccounts));
  window.localStorage.setItem(K_HOT_SEEDED, "1");

  // Overwrite schedule
  window.localStorage.setItem(K_SCHEDULE, JSON.stringify(snap.schedule));

  // Merge settings — keep email/Resend settings, replace active conf + rep.
  let prevSettings: Record<string, unknown> = {};
  try {
    const raw = window.localStorage.getItem(K_SETTINGS);
    if (raw) prevSettings = JSON.parse(raw);
  } catch {
    prevSettings = {};
  }
  const phaseOverride =
    state === "A" ? null : state === "B" ? "before" : "after";
  const nextSettings = {
    ...prevSettings,
    activeConferenceId: snap.activeConferenceId,
    activeConferenceName: snap.activeConferenceName,
    activeRepId: snap.activeRepId,
    floorPhaseOverride: phaseOverride,
  };
  window.localStorage.setItem(K_SETTINGS, JSON.stringify(nextSettings));
}

export const DEMO_STATES: { id: DemoState; title: string; desc: string }[] = [
  {
    id: "A",
    title: "State A · Clean slate",
    desc:
      "Empty captures and schedule. Default hot accounts. Shows the app before anything has happened.",
  },
  {
    id: "B",
    title: "State B · Pre-event",
    desc:
      "Heroes + filler from EuroFinance 2025 and Money20/20 USA 2025. Amsterdam selected as the active conference with 3 scheduled 1:1s. No Amsterdam captures yet. AI still to be generated.",
  },
  {
    id: "C",
    title: "State C · Mid-event",
    desc:
      "Everything from B plus the Amsterdam capture wave (~16 leads incl. 3 of Maya's incomplete) and pre-cached AI on the hero people, so the Follow-ups inbox is fully populated.",
  },
];
