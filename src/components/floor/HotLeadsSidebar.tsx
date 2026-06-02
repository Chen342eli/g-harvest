import { useMemo, useState } from "react";
import { Flame, Plus, X } from "lucide-react";
import { useHotAccounts, addHotAccount, removeHotAccount } from "@/lib/hot-accounts-store";
import { usePeopleData } from "@/lib/people-store";
import { derivePerson } from "@/lib/matching";
import { isHotAccountCompany } from "@/lib/hot-accounts-store";
import { openPersonDrawer } from "@/lib/person-drawer-store";

export function HotLeadsSidebar() {
  const accounts = useHotAccounts();
  const people = usePeopleData();
  const [input, setInput] = useState("");

  const grouped = useMemo(() => {
    const matched = people.people
      .filter((p) => isHotAccountCompany(p.currentCompany, accounts))
      .map((p) => ({ p, d: derivePerson(p, people.encounters) }));

    return accounts.map((company) => {
      const members = matched
        .filter((m) => m.p.currentCompany?.toLowerCase().includes(company.toLowerCase()))
        .sort((a, b) => (b.d.lastSeenAt ?? "").localeCompare(a.d.lastSeenAt ?? ""));
      return { company, members };
    });
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
      </div>

      <div className="max-h-[480px] overflow-auto">
        <ul className="divide-y divide-border">
          {grouped.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No companies yet.
            </li>
          )}
          {grouped.map(({ company, members }) => (
            <li key={company} className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-temp-hot/40 bg-temp-hot/10 px-2.5 py-1 text-sm font-semibold text-foreground">
                  <Flame className="h-3.5 w-3.5 text-temp-hot" />
                  {company}
                </span>
                <button
                  type="button"
                  onClick={() => removeHotAccount(company)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${company}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {members.length > 0 && (
                <ul className="space-y-1.5 pl-1">
                  {members.map(({ p, d }) => {
                    const last = d.encounters[d.encounters.length - 1];
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => openPersonDrawer(p.id)}
                          className="block w-full text-left hover:opacity-80"
                        >
                          <div className="truncate text-xs text-foreground">
                            {p.fullName}
                            {p.currentRole ? (
                              <span className="text-muted-foreground"> · {p.currentRole}</span>
                            ) : null}
                          </div>
                          {last && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {last.conferenceName}
                              {d.encounterCount > 1 ? ` · ${d.encounterCount}×` : ""}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
