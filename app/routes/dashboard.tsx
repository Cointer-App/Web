import { useEffect, useState } from "react";
import { Link, useFetcher, useRevalidator, useRouteLoaderData } from "react-router";
import {
  ArrowUpRightIcon,
  BellIcon,
  BellOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { Route } from "./+types/dashboard";
import type { clientLoader as appClientLoader } from "./_app";
import {
  addAddress,
  ApiError,
  deleteAddress,
  getActivitySummary,
  getActivityValue,
  getAddressNotifications,
  getPersonal,
  getWalletValues,
  patchAddressNotifications,
  renameAddress,
} from "~/lib/api";
import type {
  AddressNotifications,
  PersonalAddress,
  SummaryWindow,
  WalletBalance,
  WalletValues,
} from "~/lib/api-types";
import { CHAIN_CONFIG, chainTicker } from "~/lib/chains";
import {
  formatAmount,
  formatDate,
  formatFiat,
  formatRelative,
  truncateAddress,
} from "~/lib/format";
import { ChainBadge } from "~/components/chain-badge";
import { CopyButton } from "~/components/copy-button";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

export function meta() {
  return [{ title: "Dashboard - Cointer" }];
}

export async function clientLoader() {
  const [personal, summary, recent] = await Promise.all([
    getPersonal(),
    getActivitySummary(),
    getActivityValue(8),
  ]);
  return { personal, summary, recent };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent") as string;
  try {
    switch (intent) {
      case "add-wallet": {
        const label = ((form.get("label") as string) ?? "").trim();
        const viewKey = ((form.get("viewKey") as string) ?? "").trim();
        await addAddress({
          chain: form.get("chain") as string,
          address: (form.get("address") as string).trim(),
          ...(label ? { label } : {}),
          ...(viewKey ? { viewKey } : {}),
        });
        return { ok: true as const, intent };
      }
      case "rename": {
        const label = ((form.get("label") as string) ?? "").trim();
        await renameAddress(form.get("addressId") as string, label === "" ? null : label);
        return { ok: true as const, intent };
      }
      case "delete": {
        await deleteAddress(form.get("addressId") as string);
        return { ok: true as const, intent };
      }
      default:
        return { ok: false as const, intent, error: "Unknown action" };
    }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false as const, intent, error: error.message };
    throw error;
  }
}

export function HydrateFallback() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,0.45fr)]">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

const WALLET_VALUE_POLL_MS = 30_000;

function useWalletValues() {
  const [data, setData] = useState<WalletValues | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getWalletValues()
        .then((values) => {
          if (!cancelled) setData(values);
        })
        .catch(() => {
          // Keep showing the last known values on a transient failure.
        });
    };
    load();
    const interval = setInterval(load, WALLET_VALUE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}

function StatTile({
  label,
  window,
  currency,
}: {
  label: string;
  window: SummaryWindow;
  currency: string;
}) {
  return (
    <div className="bg-background p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Received {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
        {formatFiat(window.fiatTotal, currency)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {window.count} deposit{window.count === 1 ? "" : "s"}
        {window.unpricedCount > 0 && ` (${window.unpricedCount} unpriced)`}
      </p>
    </div>
  );
}

function AddWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const appData = useRouteLoaderData<typeof appClientLoader>("routes/_app");
  const chains = appData?.chains ?? [];
  const fetcher = useFetcher<typeof clientAction>();
  const [chain, setChain] = useState(chains[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const busy = fetcher.state !== "idle";
  const isMonero = chain === "monero";

  useEffect(() => {
    if (open) {
      setAddress("");
      setLabel("");
      setViewKey("");
      setClientError(null);
      setChain(chains[0]?.id ?? "");
    }
  }, [open]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "add-wallet" && fetcher.data.ok) {
      onOpenChange(false);
      toast.success("Wallet added. Existing history is loading in the background.");
    }
  }, [fetcher.state, fetcher.data]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const rule = CHAIN_CONFIG[chain];
    if (rule && !rule.addressPattern.test(address.trim())) {
      setClientError(rule.addressHint);
      return;
    }
    if (isMonero && !/^[0-9a-fA-F]{64}$/.test(viewKey.trim())) {
      setClientError("View key must be a 64-character hex string.");
      return;
    }
    setClientError(null);
    fetcher.submit(
      { intent: "add-wallet", chain, address: address.trim(), label, viewKey: viewKey.trim() },
      { method: "post" },
    );
  };

  const error = clientError ?? (fetcher.data?.intent === "add-wallet" ? fetcher.data.error : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a wallet</DialogTitle>
          <DialogDescription>
            You'll be notified whenever this address receives funds. Past transactions are loaded
            quietly, with no alerts for them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Chain</FieldLabel>
            <Select
              value={chain}
              onValueChange={(value) => setChain(value as string)}
              items={chains.map((c) => ({ value: c.id, label: c.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chains.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field data-invalid={error !== null}>
            <FieldLabel htmlFor="wallet-address">Address</FieldLabel>
            <Input
              id="wallet-address"
              className="font-mono"
              placeholder={CHAIN_CONFIG[chain]?.addressPlaceholder}
              autoComplete="off"
              spellCheck={false}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          {isMonero && (
            <Field>
              <FieldLabel htmlFor="wallet-view-key">View key</FieldLabel>
              <Input
                id="wallet-view-key"
                className="font-mono"
                placeholder="Private view key (64 hex chars)"
                autoComplete="off"
                spellCheck={false}
                value={viewKey}
                onChange={(e) => setViewKey(e.target.value)}
              />
              <FieldDescription>
                Your private view key, needed to detect incoming payments. Never your seed or spend
                key.
              </FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="wallet-label">Label</FieldLabel>
            <Input
              id="wallet-label"
              placeholder="Cold storage, tips jar…"
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <FieldDescription>Optional</FieldDescription>
          </Field>
          <Button
            type="submit"
            disabled={
              busy || address.trim() === "" || chain === "" || (isMonero && viewKey.trim() === "")
            }
          >
            {busy && <Spinner />}
            Add wallet
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  wallet,
  onOpenChange,
}: {
  wallet: PersonalAddress | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<typeof clientAction>();
  const [label, setLabel] = useState("");
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (wallet) setLabel(wallet.label ?? "");
  }, [wallet]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "rename" && fetcher.data.ok) {
      onOpenChange(false);
      toast.success("Label saved");
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Dialog open={wallet !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename wallet</DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {wallet && truncateAddress(wallet.address)}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!wallet) return;
            fetcher.submit({ intent: "rename", addressId: wallet.id, label }, { method: "post" });
          }}
          className="flex flex-col gap-4"
        >
          <Field data-invalid={fetcher.data?.intent === "rename" && !fetcher.data.ok}>
            <FieldLabel htmlFor="rename-label">Label</FieldLabel>
            <Input
              id="rename-label"
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Leave empty to remove the label"
            />
            {fetcher.data?.intent === "rename" && !fetcher.data.ok && (
              <FieldError>{fetcher.data.error}</FieldError>
            )}
          </Field>
          <Button type="submit" disabled={busy}>
            {busy && <Spinner />}
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteWalletDialog({
  wallet,
  onOpenChange,
}: {
  wallet: PersonalAddress | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<typeof clientAction>();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "delete") {
      onOpenChange(false);
      if (fetcher.data.ok) toast.success("Wallet removed");
      else toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <AlertDialog open={wallet !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this wallet?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono">{wallet ? truncateAddress(wallet.address) : ""}</span> stops
            being watched and its recorded activity is deleted. The wallet itself is not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!wallet) return;
              fetcher.submit({ intent: "delete", addressId: wallet.id }, { method: "post" });
            }}
          >
            {busy && <Spinner />}
            Remove wallet
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NotificationsDialog({
  wallet,
  onOpenChange,
}: {
  wallet: PersonalAddress | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [settings, setSettings] = useState<AddressNotifications | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const revalidator = useRevalidator();

  useEffect(() => {
    setSettings(null);
    setLoadError(null);
    if (!wallet) return;
    getAddressNotifications(wallet.id)
      .then(setSettings)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load settings"));
  }, [wallet]);

  const patch = async (input: { push?: boolean; channels?: Record<string, boolean> }) => {
    if (!wallet) return;
    try {
      setSettings(await patchAddressNotifications(wallet.id, input));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    }
  };

  return (
    <Dialog
      open={wallet !== null}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) revalidator.revalidate();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            {wallet?.label || (wallet && truncateAddress(wallet.address))}: choose where deposit
            alerts for this wallet go.
          </DialogDescription>
        </DialogHeader>
        {loadError ? (
          <p className="text-xs/relaxed text-destructive">{loadError}</p>
        ) : !settings ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-xs font-medium">Mobile push</p>
                <p className="text-[11px] text-muted-foreground">Cointer app on your devices</p>
              </div>
              <Switch
                checked={settings.push.enabled}
                onCheckedChange={(checked) => patch({ push: checked })}
              />
            </div>
            {settings.channels.map((channel) => (
              <div key={channel.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-xs font-medium capitalize">{channel.type}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {"topic" in channel.config
                      ? channel.config.topic
                      : "to" in channel.config
                        ? channel.config.to
                        : channel.config.url}
                  </p>
                </div>
                <Switch
                  checked={channel.enabledForWallet}
                  onCheckedChange={(checked) => patch({ channels: { [channel.id]: checked } })}
                />
              </div>
            ))}
            {settings.channels.length === 0 && (
              <p className="py-2 text-xs/relaxed text-muted-foreground">
                No channels yet. Add one on the{" "}
                <Link to="/channels" className="underline underline-offset-2">
                  Channels
                </Link>{" "}
                page to get alerts beyond push.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WalletValue({
  balance,
  currency,
}: {
  balance: WalletBalance | undefined;
  currency: string;
}) {
  if (!balance) {
    return <Skeleton className="ml-auto h-7 w-20" />;
  }
  const priced = balance.assets.filter((a) => a.fiatValue !== null);
  const summary =
    balance.assets.length === 0
      ? "no balance"
      : balance.assets
          .slice(0, 2)
          .map((a) => formatAmount(a.amount, a.asset))
          .join(" + ") + (balance.assets.length > 2 ? "…" : "");

  return (
    <div className="text-right">
      <p className="font-mono text-xs font-medium tabular-nums">
        {balance.fiatValue !== null
          ? formatFiat(balance.fiatValue, currency)
          : priced.length === 0 && balance.assets.length > 0
            ? "unpriced"
            : "—"}
        {balance.approximate && (
          <Tooltip>
            <TooltipTrigger
              render={<span className="ml-1 cursor-help text-muted-foreground">*</span>}
            />
            <TooltipContent>
              Monero is view-only: this is lifetime received, not a live spendable balance.
            </TooltipContent>
          </Tooltip>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">{summary}</p>
    </div>
  );
}

function WalletRow({
  wallet,
  balance,
  currency,
  onRename,
  onNotifications,
  onDelete,
}: {
  wallet: PersonalAddress;
  balance: WalletBalance | undefined;
  currency: string;
  onRename: () => void;
  onNotifications: () => void;
  onDelete: () => void;
}) {
  const muted = wallet.notifications.pushMuted || wallet.notifications.mutedChannelIds.length > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <ChainBadge chain={wallet.chain} label={chainTicker(wallet.chain)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">
            {wallet.label ?? truncateAddress(wallet.address)}
          </span>
          {muted && (
            <Tooltip>
              <TooltipTrigger
                render={<BellOffIcon className="size-3 shrink-0 text-muted-foreground" />}
              />
              <TooltipContent>Some alerts are muted for this wallet</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {wallet.label && <span className="font-mono">{truncateAddress(wallet.address)}</span>}
          <span>added {formatDate(wallet.createdAt)}</span>
        </div>
      </div>
      <WalletValue balance={balance} currency={currency} />
      <CopyButton value={wallet.address} label="Copy address" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label="Wallet actions" />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onRename}>
            <PencilIcon /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNotifications}>
            <BellIcon /> Notifications
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { personal, summary, recent } = loaderData;
  const appData = useRouteLoaderData<typeof appClientLoader>("routes/_app");
  const maxWallets =
    personal.limits === undefined
      ? (appData?.capabilities.limits.maxAddressesPerKey ?? 10)
      : personal.limits.maxAddresses;
  const retentionDays =
    personal.limits === undefined
      ? (appData?.capabilities.limits.activityRetentionDays ?? 90)
      : personal.limits.activityRetentionDays;
  const isAdmin = personal.isAdmin ?? false;
  const currency = summary.currency;

  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState<PersonalAddress | null>(null);
  const [editingNotifications, setEditingNotifications] = useState<PersonalAddress | null>(null);
  const [deleting, setDeleting] = useState<PersonalAddress | null>(null);

  const walletValues = useWalletValues();
  const balanceById = new Map(walletValues?.wallets.map((w) => [w.id, w]) ?? []);

  const wallets = personal.addresses;
  const atLimit = maxWallets !== null && wallets.length >= maxWallets;
  const labelFor = (chain: string, address: string) =>
    wallets.find((w) => w.chain === chain && w.address === address)?.label ?? null;

  const totalFiat = summary.assets.reduce((sum, a) => sum + (a.fiatValue ?? 0), 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {wallets.length > 0 && (
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Portfolio value
          </p>
          {walletValues ? (
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {formatFiat(walletValues.total, walletValues.currency)}
            </p>
          ) : (
            <Skeleton className="mt-2 h-8 w-40" />
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {walletValues?.priceAsOf != null
              ? `live balances, prices as of ${formatRelative(walletValues.priceAsOf)}`
              : "fetching live balances…"}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <StatTile label="24h" window={summary.windows["24h"]} currency={currency} />
        {isAdmin ? (
          <>
            <StatTile label="30d" window={summary.windows["30d"]} currency={currency} />
            <StatTile label="1y" window={summary.windows["1y"]} currency={currency} />
          </>
        ) : (
          <>
            <StatTile label="7d" window={summary.windows["7d"]} currency={currency} />
            <StatTile label="30d" window={summary.windows["30d"]} currency={currency} />
          </>
        )}
        <div className="bg-background p-4">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {isAdmin ? "Received all time" : "Watched wallets"}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {isAdmin ? (
              formatFiat(totalFiat, currency)
            ) : (
              <>
                {wallets.length}
                {maxWallets !== null && (
                  <span className="text-sm font-normal text-muted-foreground">/{maxWallets}</span>
                )}
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary.priceAsOf !== null
              ? `prices as of ${formatRelative(summary.priceAsOf)}`
              : "no price data"}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_minmax(280px,0.45fr)]">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Wallets
            </h2>
            {atLimit ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span>
                      <Button size="xs" disabled>
                        <PlusIcon /> Add wallet
                      </Button>
                    </span>
                  }
                />
                <TooltipContent>This server allows {maxWallets} wallets per key.</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="xs" onClick={() => setAddOpen(true)}>
                <PlusIcon /> Add wallet
              </Button>
            )}
          </div>
          {wallets.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WalletIcon />
                </EmptyMedia>
                <EmptyTitle>No wallets yet</EmptyTitle>
                <EmptyDescription>
                  Add an address to start watching for incoming deposits.
                </EmptyDescription>
              </EmptyHeader>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <PlusIcon /> Add your first wallet
              </Button>
            </Empty>
          ) : (
            <div className="divide-y rounded-lg border">
              {wallets.map((wallet) => (
                <WalletRow
                  key={wallet.id}
                  wallet={wallet}
                  balance={balanceById.get(wallet.id)}
                  currency={walletValues?.currency ?? currency}
                  onRename={() => setRenaming(wallet)}
                  onNotifications={() => setEditingNotifications(wallet)}
                  onDelete={() => setDeleting(wallet)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Recent deposits
              </h2>
              <Link
                to="/activity"
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                View all <ArrowUpRightIcon className="size-3" />
              </Link>
            </div>
            {recent.items.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs/relaxed text-muted-foreground">
                Deposits to your watched wallets appear here.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {recent.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">
                        {labelFor(item.chain, item.address) ?? truncateAddress(item.address)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatRelative(item.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-medium text-positive tabular-nums">
                        +{formatAmount(item.amount, item.asset)}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {item.fiatValue !== null ? formatFiat(item.fiatValue, currency) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {summary.assets.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {retentionDays === null
                  ? "Received by asset, all time"
                  : `Received by asset, last ${retentionDays} days`}
              </h2>
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                {summary.assets.map((asset) => {
                  const share =
                    asset.fiatValue !== null && totalFiat > 0 ? asset.fiatValue / totalFiat : 0;
                  return (
                    <div key={`${asset.chain}:${asset.asset}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-medium">{asset.asset}</span>
                        <span className="font-mono text-xs tabular-nums">
                          {formatAmount(asset.amount, "")}
                          <span className="ml-2 text-muted-foreground">
                            {asset.fiatValue !== null
                              ? formatFiat(asset.fiatValue, currency)
                              : "unpriced"}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(share * 100, asset.fiatValue ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      <AddWalletDialog open={addOpen} onOpenChange={setAddOpen} />
      <RenameDialog wallet={renaming} onOpenChange={(open) => !open && setRenaming(null)} />
      <NotificationsDialog
        wallet={editingNotifications}
        onOpenChange={(open) => !open && setEditingNotifications(null)}
      />
      <DeleteWalletDialog wallet={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </div>
  );
}
