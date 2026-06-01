import type { Conference } from "@/lib/conferences";
import { mixBy } from "@/lib/insights";

export function CoverageMeters({ going }: { going: Conference[] }) {
  const verticals = mixBy(going, (c) => c.vertical);
  const regions = mixBy(going, (c) => c.region);

  return (
    <div className="space-y-3">
      <Section title="Verticals" items={verticals} />
      <Section title="Regions" items={regions} />
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: { key: string; count: number; share: number }[];
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-xs italic text-muted-foreground">No Going conferences yet.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((m) => (
            <div key={m.key} className="text-xs">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-foreground">{m.key}</span>
                <span className="tabular-nums text-muted-foreground">
                  {m.count} · {Math.round(m.share * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.max(4, m.share * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
