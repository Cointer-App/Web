import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  SunIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { Route } from "./+types/settings";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { ApiError, deleteAccount, deletePushToken, getPersonal, rotateKey } from "~/lib/api";
import { clearKey, getKey, maskKey, setKey } from "~/lib/auth";
import type { PushToken } from "~/lib/api-types";
import { downloadTextFile, formatDate } from "~/lib/format";
import { CopyButton } from "~/components/copy-button";
import { useTheme } from "~/components/theme-provider";
import { Badge } from "~/components/ui/badge";
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
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

export function meta() {
  return [{ title: "Settings - Cointer" }];
}

export async function clientLoader() {
  return { personal: await getPersonal() };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent") as string;
  try {
    switch (intent) {
      case "remove-device": {
        await deletePushToken(form.get("tokenId") as string);
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
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function KeySection({ createdAt, isAdmin }: { createdAt: number; isAdmin: boolean }) {
  const key = getKey() ?? "";
  const [revealed, setRevealed] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [savedNewKey, setSavedNewKey] = useState(false);
  const { copied: newKeyCopied, copy: copyNewKey } = useCopyToClipboard();

  const rotate = async () => {
    setRotating(true);
    try {
      const { personalKey } = await rotateKey();
      // Old key is already dead, so save the new one now in case the tab closes.
      setKey(personalKey);
      setNewKey(personalKey);
      setRotateOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rotate the key");
    } finally {
      setRotating(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <SectionTitle>Personal key</SectionTitle>
        {isAdmin && <Badge variant="secondary">Admin</Badge>}
      </div>
      {isAdmin && (
        <p className="text-xs text-muted-foreground">
          Admin key: no wallet, channel, or device limits, and activity is kept forever.
        </p>
      )}
      <InputGroup>
        <InputGroupInput
          readOnly
          className="font-mono text-xs"
          value={revealed ? key : maskKey(key) + "•".repeat(28)}
          onFocus={(e) => revealed && e.currentTarget.select()}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={revealed ? "Hide key" : "Reveal key"}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
          <InputGroupButton size="icon-xs" aria-label="Copy key" onClick={() => copy(key)}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label="Download key"
            onClick={() => downloadTextFile("cointer-key.txt", `${key}\n`)}
          >
            <DownloadIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Created {formatDate(createdAt)}</p>
        <Button variant="outline" size="xs" onClick={() => setRotateOpen(true)}>
          <RefreshCwIcon /> Rotate key
        </Button>
      </div>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate your key?</AlertDialogTitle>
            <AlertDialogDescription>
              A new key replaces this one right away. Anything using the old key, including the
              Cointer app on your phone, stops working until you sign in again with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={rotating} onClick={rotate}>
              {rotating && <Spinner />}
              Rotate key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={newKey !== null}
        onOpenChange={(open) => {
          if (!open && savedNewKey) {
            setNewKey(null);
            setSavedNewKey(false);
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Your new key</DialogTitle>
            <DialogDescription>
              This is the only time it's shown. Save it before closing.
            </DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupInput
              readOnly
              className="font-mono text-xs"
              value={newKey ?? ""}
              onFocus={(e) => e.currentTarget.select()}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Copy new key"
                onClick={() => newKey && copyNewKey(newKey)}
              >
                {newKeyCopied ? <CheckIcon /> : <CopyIcon />}
              </InputGroupButton>
              <InputGroupButton
                size="icon-xs"
                aria-label="Download new key"
                onClick={() => newKey && downloadTextFile("cointer-key.txt", `${newKey}\n`)}
              >
                <DownloadIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Label className="flex items-center gap-2 text-xs/relaxed">
            <Checkbox
              checked={savedNewKey}
              onCheckedChange={(checked) => setSavedNewKey(checked === true)}
            />
            I saved my new key
          </Label>
          <Button
            disabled={!savedNewKey}
            onClick={() => {
              setNewKey(null);
              setSavedNewKey(false);
              toast.success("Key rotated");
            }}
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DevicesSection({ pushTokens }: { pushTokens: PushToken[] }) {
  const fetcher = useFetcher<typeof clientAction>();
  const [removing, setRemoving] = useState<PushToken | null>(null);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "remove-device") {
      setRemoving(null);
      if (fetcher.data.ok) toast.success("Device removed");
      else toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <section className="space-y-3">
      <SectionTitle>Mobile devices</SectionTitle>
      {pushTokens.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs/relaxed text-muted-foreground">
          No devices yet. Install the Cointer app and sign in with your key. It will show up here.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {pushTokens.map((token) => (
            <div key={token.id} className="flex items-center gap-3 px-3 py-2.5">
              <SmartphoneIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">
                  {token.platform === "ios" ? "iPhone / iPad" : "Android"}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {token.token.slice(0, 28)}… registered {formatDate(token.createdAt)}
                </p>
              </div>
              <Button variant="ghost" size="xs" onClick={() => setRemoving(token)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this device?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops receiving push alerts until the app signs in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (!removing) return;
                fetcher.submit(
                  { intent: "remove-device", tokenId: removing.id },
                  { method: "post" },
                );
              }}
            >
              {busy && <Spinner />}
              Remove device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="space-y-3">
      <SectionTitle>Appearance</SectionTitle>
      <ToggleGroup
        value={[theme]}
        onValueChange={(values) => {
          const next = values[0];
          if (next === "light" || next === "dark" || next === "system") setTheme(next);
        }}
        variant="outline"
        spacing={0}
      >
        <ToggleGroupItem value="light" aria-label="Light theme">
          <SunIcon /> Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Dark theme">
          <MoonIcon /> Dark
        </ToggleGroupItem>
        <ToggleGroupItem value="system" aria-label="Match system theme">
          <MonitorIcon /> System
        </ToggleGroupItem>
      </ToggleGroup>
    </section>
  );
}

function SupportSection() {
  return (
    <section className="space-y-3">
      <SectionTitle>Support</SectionTitle>
      <div className="rounded-lg border px-3 py-2.5">
        <p className="text-xs/relaxed text-muted-foreground">
          Have a question, found a bug, or want a new feature? Email{" "}
          <a
            href="mailto:support@cointer.app"
            className="font-medium text-foreground hover:underline"
          >
            support@cointer.app
          </a>{" "}
          and we'll get back to you.
        </p>
      </div>
    </section>
  );
}

const DONATION_WALLETS = [
  {
    chain: "Base",
    asset: "ETH",
    address: "0x83eA1Db55cc6E34fCD11Da2b7849621af67b6E34",
    preferred: true,
  },
  { chain: "Ethereum", asset: "ETH", address: "0x83eA1Db55cc6E34fCD11Da2b7849621af67b6E34" },
  { chain: "Bitcoin", asset: "BTC", address: "bc1qrxc3vpnl6qhh9p8akjmjukcgmgmq852ua64h05" },
  { chain: "Solana", asset: "SOL", address: "T4BF5ioySVUjwaPNw4Sdu7oK8SXLxgQRcMaTQ6YJ2UJ" },
  {
    chain: "Bitcoin Cash",
    asset: "BCH",
    address: "bitcoincash:qq460sfz69hdcgsq2d0j8dt8glheaq2tfurwwkazjr",
  },
];

function DonateSection() {
  return (
    <section className="space-y-3">
      <SectionTitle>Donate</SectionTitle>
      <div className="rounded-lg border">
        <p className="px-3 py-2.5 text-xs/relaxed text-muted-foreground">
          Cointer is free. Donations pay for the servers, and the more that comes in, the more
          chains we can add support for.
        </p>
        <div className="divide-y border-t">
          {DONATION_WALLETS.map((wallet) => (
            <div key={wallet.chain} className="flex items-center gap-2 px-3 py-2">
              <span className="w-24 shrink-0 text-xs font-medium">
                {wallet.chain}
                {wallet.preferred && <span className="ml-1 text-[10px] text-primary">★</span>}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {wallet.address}
              </span>
              <CopyButton value={wallet.address} label={`Copy ${wallet.chain} address`} />
            </div>
          ))}
        </div>
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          Base is preferred, it has the lowest fees. QR codes and details at{" "}
          <a
            href="https://cointer.app/donate"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            cointer.app/donate
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function DangerSection() {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const signOut = () => {
    clearKey();
    navigate("/login");
  };

  const destroy = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      clearKey();
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the account");
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-3">
      <SectionTitle>Danger zone</SectionTitle>
      <div className="divide-y rounded-lg border border-destructive/30">
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium">Sign out</p>
            <p className="text-[11px] text-muted-foreground">
              Removes the key from this browser. Your key keeps working, so make sure it's saved.
            </p>
          </div>
          <Button variant="outline" size="xs" onClick={signOut}>
            Sign out
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium">Delete everything</p>
            <p className="text-[11px] text-muted-foreground">
              Permanently deletes your key, wallets, channels, devices, and activity.
            </p>
          </div>
          <Button variant="destructive" size="xs" onClick={() => setDeleteOpen(true)}>
            Delete…
          </Button>
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmation("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-1.5">
              <TriangleAlertIcon className="size-4 text-destructive" />
              Delete everything?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes your key and every wallet, channel, device, and activity record tied to
              it. There is no undo and no recovery. Type{" "}
              <span className="font-mono font-medium">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            className="font-mono"
            placeholder="DELETE"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmation !== "DELETE" || deleting}
              onClick={destroy}
            >
              {deleting && <Spinner />}
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { personal } = loaderData;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <KeySection createdAt={personal.createdAt} isAdmin={personal.isAdmin ?? false} />
      <Separator />
      <DevicesSection pushTokens={personal.pushTokens} />
      <Separator />
      <AppearanceSection />
      <Separator />
      <SupportSection />
      <Separator />
      <DonateSection />
      <Separator />
      <DangerSection />
    </div>
  );
}
