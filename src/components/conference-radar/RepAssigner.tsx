import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  assigned: string[];
  allReps: string[];
  onToggle: (rep: string) => void;
}

export function RepAssigner({ assigned, allReps, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {assigned.map((rep) => (
        <span
          key={rep}
          className="group inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {rep}
          <button
            type="button"
            onClick={() => onToggle(rep)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Unassign ${rep}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-3 w-3" />
            Assign
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search reps..." />
            <CommandList>
              <CommandEmpty>No reps found.</CommandEmpty>
              <CommandGroup>
                {allReps.map((rep) => {
                  const isOn = assigned.includes(rep);
                  return (
                    <CommandItem
                      key={rep}
                      onSelect={() => onToggle(rep)}
                      className="flex items-center justify-between"
                    >
                      <span>{rep}</span>
                      <Check className={cn("h-4 w-4", isOn ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
