import { useMemo, useState } from "react";
import { Flame, Plus, X } from "lucide-react";
import { useHotAccounts, addHotAccount, removeHotAccount } from "@/lib/hot-accounts-store";
import { usePeopleData } from "@/lib/people-store";
import { derivePerson } from "@/lib/matching";
import { isHotAccountCompany } from "@/lib/hot-accounts-store";

export function HotLeadsSidebar() {
  const accounts = useHotAccounts();
  const people = usePeopleData();
  const [input, setInput] = useState("");

  const matchedPeople = useMemo(() => {
    return people.people
      .filter((p) => isHotAccountCompany(p.currentCompany, accounts))
      .map((p) => ({ p, d: derivePerson(p, people.encounters) }))
      .sort((a, b) => (b.d.lastSeenAt ?? "").localeCompare(a.d.lastSeenAt ?? ""));
  }, [people, accounts]);

  return (
    <aside className="rounded-xl border border-temp-hot/30 bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-temp-hot" />
          <h2 className="text-sm font-semibold text-foreground">Hot Accounts</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">team list</span>
      </header>

      <div className="border-b border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            addHotAccount(input);
            setInput("");
          }}
          className="flex gap-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add company…"
            className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background hover:opacity-90"
            aria-label="Add"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </form>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {accounts.length === 0 && (
            <li className="text-[11px] text-muted-foreground">No companies yet.</li>
          )}
          {accounts.map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1 rounded-full border border-temp-hot/40 bg-temp-hot/10 px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              <span>🔥 {c}</span>
              <button
                type="button"
                onClick={() => removeHotAccount(c)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${c}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="max-h-[400px] overflow-auto">
        <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          People from hot accounts
        </div>
        <ul className="divide-y divide-border">
          {matchedPeople.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No one captured from these companies yet.
            </li>
          )}
          {matchedPeople.slice(0, 10).map(({ p, d }) => {
            const last = d.encounters[d.encounters.length - 1];
            return (
              <li key={p.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {p.currentCompany}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.fullName}
                      {p.currentRole ? ` · ${p.currentRole}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-temp-hot px-1.5 py-0.5 text-[10px] font-medium text-temp-hot-foreground">
                    🔥
                  </span>
                </div>
                {last && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {last.conferenceName} · {d.encounterCount}×
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
