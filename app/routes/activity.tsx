import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { ArrowDownToLineIcon, ExternalLinkIcon } from "lucide-react";

import type { Route } from "./+types/activity";
import type { clientLoader as appClientLoader } from "./_app";
import { getActivityValue, getPersonal } from "~/lib/api";
import type { PricedActivityItem } from "~/lib/api-types";
import { chainExplorerTxUrl } from "~/lib/chains";
import {
  formatAmount,
  formatDateTime,
  formatFiat,
  formatRelative,
  truncateAddress,
  truncateHash,
} from "~/lib/format";
import { ChainBadge } from "~/components/chain-badge";
import { CopyButton } from "~/components/copy-button";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

const PAGE_SIZE = 50;

export function meta() {
  return [{ title: "Activity - Cointer" }];
}

export async function clientLoader() {
  const [page, personal] = await Promise.all([getActivityValue(PAGE_SIZE), getPersonal()]);
  return { page, addresses: personal.addresses, limits: personal.limits };
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Skeleton className="h-8 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function AssetTicker({ chain, asset }: { chain: string; asset: string }) {
  return <ChainBadge chain={chain} label={asset} />;
}

export default function Activity({ loaderData }: Route.ComponentProps) {
  const { page, addresses, limits } = loaderData;
  const appData = useRouteLoaderData<typeof appClientLoader>("routes/_app");
  const chains = appData?.chains ?? [];
  const retentionDays =
    limits === undefined
      ? (appData?.capabilities.limits.activityRetentionDays ?? 90)
      : limits.activityRetentionDays;

  const [extraItems, setExtraItems] = useState<PricedActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState(page.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [walletFilter, setWalletFilter] = useState<string>("all");

  const allItems = [...page.items, ...extraItems];
  const items = allItems.filter((item) => {
    if (chainFilter !== "all" && item.chain !== chainFilter) return false;
    if (walletFilter !== "all") {
      const wallet = addresses.find((a) => a.id === walletFilter);
      if (!wallet || item.chain !== wallet.chain || item.address !== wallet.address) return false;
    }
    return true;
  });

  const labelFor = (chain: string, address: string) =>
    addresses.find((a) => a.chain === chain && a.address === address)?.label ?? null;

  const loadMore = async () => {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const next = await getActivityValue(PAGE_SIZE, nextCursor);
      setExtraItems((prev) => [...prev, ...next.items]);
      setNextCursor(next.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtering = chainFilter !== "all" || walletFilter !== "all";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[chainFilter]}
          onValueChange={(values) => {
            const next = values[0];
            if (typeof next === "string") setChainFilter(next);
          }}
        >
          <ToggleGroupItem value="all" aria-label="All chains">
            All
          </ToggleGroupItem>
          {chains.map((chain) => (
            <ToggleGroupItem key={chain.id} value={chain.id} aria-label={chain.name}>
              {chain.asset}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          value={walletFilter}
          onValueChange={(value) => setWalletFilter(value as string)}
          items={[
            { value: "all", label: "All wallets" },
            ...addresses.map((a) => ({
              value: a.id,
              label: a.label ?? truncateAddress(a.address),
            })),
          ]}
        >
          <SelectTrigger className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wallets</SelectItem>
            {addresses.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label ?? truncateAddress(a.address)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-right">
          <p className="font-mono text-sm font-semibold tabular-nums">
            {formatFiat(page.total, page.currency)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {retentionDays === null ? "received, all time" : `received, last ${retentionDays} days`}
            {page.unpricedCount > 0 && ` (${page.unpricedCount} unpriced)`}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowDownToLineIcon />
            </EmptyMedia>
            <EmptyTitle>
              {filtering ? "Nothing matches these filters" : "No deposits yet"}
            </EmptyTitle>
            <EmptyDescription>
              {filtering
                ? "Try a different chain or wallet, or load more history."
                : retentionDays === null
                  ? "Deposits to your watched wallets show up here and stay forever."
                  : `Deposits to your watched wallets show up here and stay for ${retentionDays} days.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const explorer = chainExplorerTxUrl(item.chain, item.txHash);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger render={<span>{formatRelative(item.createdAt)}</span>} />
                        <TooltipContent>{formatDateTime(item.createdAt)}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AssetTicker chain={item.chain} asset={item.asset} />
                        <span className="max-w-40 truncate">
                          {labelFor(item.chain, item.address) ?? (
                            <span className="font-mono">{truncateAddress(item.address)}</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-positive tabular-nums">
                      +{formatAmount(item.amount, item.asset)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                      {item.fiatValue !== null ? (
                        formatFiat(item.fiatValue, page.currency)
                      ) : (
                        <Tooltip>
                          <TooltipTrigger render={<span>—</span>} />
                          <TooltipContent>No fresh price for {item.asset}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono text-muted-foreground">
                          {truncateHash(item.txHash)}
                        </span>
                        <CopyButton value={item.txHash} label="Copy transaction hash" />
                        {explorer && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="View on explorer"
                            render={<a href={explorer} target="_blank" rel="noreferrer noopener" />}
                          >
                            <ExternalLinkIcon />
                          </Button>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {nextCursor !== null && (
        <Button
          variant="outline"
          size="sm"
          className="self-center"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore && <Spinner />}
          Load older deposits
        </Button>
      )}
    </div>
  );
}
