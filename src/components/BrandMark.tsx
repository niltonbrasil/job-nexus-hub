import { Link } from "@tanstack/react-router";
import { Umbrella } from "lucide-react";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5">
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg ${
          light ? "bg-white/10 ring-1 ring-white/20" : "bg-navy-deep ring-1 ring-navy-deep/20"
        }`}
      >
        <Umbrella className={`h-5 w-5 ${light ? "text-white" : "text-ivory"}`} strokeWidth={2.2} />
      </span>
      <div className="leading-none">
        <span
          className={`block font-display text-lg font-bold tracking-tight ${
            light ? "text-white" : "text-foreground"
          }`}
        >
          Umbrella
        </span>
        <span
          className={`block text-[10px] font-medium uppercase tracking-[0.18em] ${
            light ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          Job Hub
        </span>
      </div>
    </Link>
  );
}
