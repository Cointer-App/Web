import { CheckIcon, CopyIcon } from "lucide-react";

import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        copy(value);
      }}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      {copied ? <CheckIcon className="text-positive" /> : <CopyIcon />}
    </Button>
  );
}
