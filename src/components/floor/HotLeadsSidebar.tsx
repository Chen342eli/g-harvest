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

      <div className="max-h-[520px] overflow-auto p-3">
        {grouped.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No companies yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {grouped.map(({ company, members }) => {
              const initials = (name: string) =>
                name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0]?.toUpperCase())
                  .join("");
              return (
                <div
                  key={company}
                  className="group relative flex flex-col rounded-lg border border-temp-hot/30 bg-temp-hot/[0.04] p-2.5 transition hover:border-temp-hot/60 hover:bg-temp-hot/10"
                >
                  <div className="mb-2 flex items-start justify-between gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-temp-hot/40 bg-temp-hot/10 px-2 py-0.5 text-xs font-semibold text-foreground">
                      <Flame className="h-3 w-3 text-temp-hot" />
                      {company}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeHotAccount(company)}
                      className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${company}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {members.length === 0 ? (
                    <div className="text-[11px] italic text-muted-foreground">
                      No contacts yet
                    </div>
                  ) : (
                    <>
                      <div className="mb-1.5 flex -space-x-1.5">
                        {members.slice(0, 4).map(({ p }) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => openPersonDrawer(p.id)}
                            title={p.fullName}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-muted text-[9px] font-semibold text-foreground hover:z-10 hover:ring-2 hover:ring-temp-hot/40"
                          >
                            {initials(p.fullName)}
                          </button>
                        ))}
                        {members.length > 4 && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-muted text-[9px] font-semibold text-muted-foreground">
                            +{members.length - 4}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openPersonDrawer(members[0].p.id)}
                        className="text-left text-[11px] leading-tight hover:opacity-80"
                      >
                        <div className="truncate font-medium text-foreground">
                          {members[0].p.fullName}
                        </div>
                        <div className="truncate text-muted-foreground">
                          {members[0].p.currentRole ?? "—"}
                        </div>
                      </button>
                      {members.length > 1 && (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {members.length} contacts
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </aside>
  );
}
