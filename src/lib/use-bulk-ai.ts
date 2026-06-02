import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeRelationship } from "./relationship-ai.functions";
import { derivePerson } from "./matching";
import { usePeopleData, updatePerson } from "./people-store";

/**
 * Auto-generates AI reads for every person without a cached signal.
 * Runs ONE call per person, permanently cached in localStorage.
 * Never re-calls for already-cached people. Sequential to be polite to the gateway.
 */
export function useBulkAiReads() {
  const data = usePeopleData();
  const analyze = useServerFn(analyzeRelationship);
  const inFlightRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    if (runningRef.current) return;
    const targets = data.people.filter(
      (p) => !p.aiSignal && !inFlightRef.current.has(p.id),
    );
    if (targets.length === 0) return;

    runningRef.current = true;
    (async () => {
      for (const person of targets) {
        if (inFlightRef.current.has(person.id)) continue;
        inFlightRef.current.add(person.id);
        const encs = derivePerson(person, data.encounters).encounters;
        if (encs.length === 0) continue; // skip empty — nothing to analyze
        try {
          const out = await analyze({
            data: {
              person: {
                fullName: person.fullName,
                nameVariations: person.nameVariations,
                linkedInUrl: person.linkedInUrl ?? null,
                currentRole: person.currentRole ?? null,
                currentCompany: person.currentCompany ?? null,
                currentVertical: person.currentVertical ?? null,
              },
              encounters: encs.map((e) => ({
                date: e.timestamp.slice(0, 10),
                conferenceName: e.conferenceName,
                repName: e.repId,
                temperature: e.temperature,
                roleAtTime: e.roleAtTime ?? null,
                companyAtTime: e.companyAtTime ?? null,
                note: e.note ?? null,
              })),
            },
          });
          updatePerson(person.id, {
            aiSignal: out.signal,
            aiConfidence: out.confidence,
            aiReasoning: out.reasoning,
            aiNudge: out.nudge,
            aiArcSummary: out.arcSummary,
            aiGeneratedAt: new Date().toISOString(),
          });
        } catch {
          // swallow; next mount or manual open will retry that person
        }
      }
      runningRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.people.length]);
}
