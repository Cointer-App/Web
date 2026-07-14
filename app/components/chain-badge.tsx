import { CHAIN_CONFIG } from "~/lib/chains";
import { cn } from "~/lib/utils";

export function ChainBadge({
  chain,
  label,
  className,
}: {
  chain: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase",
        CHAIN_CONFIG[chain]?.badgeClassName ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
