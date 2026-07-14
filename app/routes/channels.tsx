import { useEffect, useState } from "react";
import { useFetcher, useRouteLoaderData } from "react-router";
import {
  BellRingIcon,
  HashIcon,
  MailIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RadioIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import type { Route } from "./+types/channels";
import type { clientLoader as appClientLoader } from "./_app";
import {
  addChannel,
  ApiError,
  deleteChannel,
  listChannels,
  patchChannel,
  testChannel,
} from "~/lib/api";
import type { Channel, ChannelConfig, ChannelType } from "~/lib/api-types";
import { formatDate } from "~/lib/format";
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
import { Skeleton } from "~/components/ui/skeleton";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: "Channels - Cointer" }];
}

export async function clientLoader() {
  return { channels: await listChannels() };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent") as string;
  try {
    switch (intent) {
      case "add": {
        await addChannel({
          type: form.get("type") as ChannelType,
          config: JSON.parse(form.get("config") as string) as ChannelConfig,
        });
        return { ok: true as const, intent };
      }
      case "edit": {
        await patchChannel(form.get("channelId") as string, {
          config: JSON.parse(form.get("config") as string) as ChannelConfig,
        });
        return { ok: true as const, intent };
      }
      case "toggle": {
        await patchChannel(form.get("channelId") as string, {
          enabled: form.get("enabled") === "true",
        });
        return { ok: true as const, intent };
      }
      case "delete": {
        await deleteChannel(form.get("channelId") as string);
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
    <div className="mx-auto max-w-3xl space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

const CHANNEL_META: Record<ChannelType, { name: string; icon: typeof RadioIcon; blurb: string }> = {
  ntfy: { name: "ntfy", icon: BellRingIcon, blurb: "Push via ntfy.sh or your own server" },
  discord: { name: "Discord", icon: HashIcon, blurb: "Webhook into a Discord channel" },
  slack: { name: "Slack", icon: MessageSquareIcon, blurb: "Webhook into a Slack channel" },
  email: { name: "Email", icon: MailIcon, blurb: "Plain email to any address" },
};

function configPreview(channel: Channel): string {
  const config = channel.config;
  if ("topic" in config) return config.topic;
  if ("to" in config) return config.to;
  return config.url;
}

function ChannelConfigFields({
  type,
  values,
  onChange,
}: {
  type: ChannelType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (type === "ntfy") {
    return (
      <>
        <Field>
          <FieldLabel htmlFor="cfg-topic">Topic</FieldLabel>
          <Input
            id="cfg-topic"
            className="font-mono"
            placeholder="my-deposits"
            autoComplete="off"
            value={values.topic ?? ""}
            onChange={(e) => onChange("topic", e.target.value)}
          />
          <FieldDescription>
            Anyone who knows the topic can subscribe to it. Pick something hard to guess.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="cfg-server">Server</FieldLabel>
          <Input
            id="cfg-server"
            className="font-mono"
            placeholder="https://ntfy.sh"
            autoComplete="off"
            value={values.server ?? ""}
            onChange={(e) => onChange("server", e.target.value)}
          />
          <FieldDescription>Optional. Leave empty for ntfy.sh.</FieldDescription>
        </Field>
      </>
    );
  }
  if (type === "email") {
    return (
      <Field>
        <FieldLabel htmlFor="cfg-to">Send to</FieldLabel>
        <Input
          id="cfg-to"
          type="email"
          placeholder="you@example.com"
          value={values.to ?? ""}
          onChange={(e) => onChange("to", e.target.value)}
        />
      </Field>
    );
  }
  return (
    <Field>
      <FieldLabel htmlFor="cfg-url">Webhook URL</FieldLabel>
      <Input
        id="cfg-url"
        className="font-mono"
        placeholder={
          type === "discord"
            ? "https://discord.com/api/webhooks/…"
            : "https://hooks.slack.com/services/…"
        }
        autoComplete="off"
        spellCheck={false}
        value={values.url ?? ""}
        onChange={(e) => onChange("url", e.target.value)}
      />
      <FieldDescription>
        {type === "discord"
          ? "Server settings → Integrations → Webhooks."
          : "Create one at api.slack.com/messaging/webhooks."}
      </FieldDescription>
    </Field>
  );
}

function buildConfig(type: ChannelType, values: Record<string, string>): ChannelConfig {
  if (type === "ntfy") {
    const server = (values.server ?? "").trim();
    return { topic: (values.topic ?? "").trim(), ...(server ? { server } : {}) };
  }
  if (type === "email") return { to: (values.to ?? "").trim() };
  return { url: (values.url ?? "").trim() };
}

function configComplete(type: ChannelType, values: Record<string, string>): boolean {
  if (type === "ntfy") return (values.topic ?? "").trim() !== "";
  if (type === "email") return (values.to ?? "").trim() !== "";
  return (values.url ?? "").trim() !== "";
}

function AddChannelDialog({
  open,
  onOpenChange,
  emailAvailable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailAvailable: boolean;
}) {
  const fetcher = useFetcher<typeof clientAction>();
  const [type, setType] = useState<ChannelType | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (open) {
      setType(null);
      setValues({});
    }
  }, [open]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "add" && fetcher.data.ok) {
      onOpenChange(false);
      toast.success("Channel added", {
        description: "Send a test to make sure alerts get through.",
      });
    }
  }, [fetcher.state, fetcher.data]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!type) return;
    fetcher.submit(
      { intent: "add", type, config: JSON.stringify(buildConfig(type, values)) },
      { method: "post" },
    );
  };

  const error = fetcher.data?.intent === "add" && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a channel</DialogTitle>
          <DialogDescription>Deposit alerts are sent to every enabled channel.</DialogDescription>
        </DialogHeader>
        {!type ? (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CHANNEL_META) as ChannelType[]).map((t) => {
              const meta = CHANNEL_META[t];
              const disabled = t === "email" && !emailAvailable;
              const tile = (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:border-ring hover:bg-accent",
                  )}
                >
                  <meta.icon className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium">{meta.name}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {meta.blurb}
                  </span>
                </button>
              );
              return disabled ? (
                <Tooltip key={t}>
                  <TooltipTrigger render={<span className="contents">{tile}</span>} />
                  <TooltipContent>Email isn't set up on this server.</TooltipContent>
                </Tooltip>
              ) : (
                tile
              );
            })}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <ChannelConfigFields
              type={type}
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />
            {error && <p className="text-xs/relaxed text-destructive">{error}</p>}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setType(null)}>
                Back
              </Button>
              <Button type="submit" disabled={busy || !configComplete(type, values)}>
                {busy && <Spinner />}
                Add {CHANNEL_META[type].name}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditChannelDialog({
  channel,
  onOpenChange,
}: {
  channel: Channel | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<typeof clientAction>();
  const [values, setValues] = useState<Record<string, string>>({});
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (!channel) return;
    // Webhook URLs come back redacted, so start empty and require a re-paste.
    if (channel.type === "ntfy" && "topic" in channel.config) {
      setValues({ topic: channel.config.topic, server: channel.config.server ?? "" });
    } else if (channel.type === "email" && "to" in channel.config) {
      setValues({ to: channel.config.to });
    } else {
      setValues({});
    }
  }, [channel]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "edit" && fetcher.data.ok) {
      onOpenChange(false);
      toast.success("Channel updated");
    }
  }, [fetcher.state, fetcher.data]);

  const error = fetcher.data?.intent === "edit" && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <Dialog open={channel !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {channel ? CHANNEL_META[channel.type].name : ""} channel</DialogTitle>
          {channel && (channel.type === "discord" || channel.type === "slack") && (
            <DialogDescription>
              For safety the saved URL isn't shown. Paste it again to change it.
            </DialogDescription>
          )}
        </DialogHeader>
        {channel && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetcher.submit(
                {
                  intent: "edit",
                  channelId: channel.id,
                  config: JSON.stringify(buildConfig(channel.type, values)),
                },
                { method: "post" },
              );
            }}
            className="flex flex-col gap-4"
          >
            <ChannelConfigFields
              type={channel.type}
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
            />
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" disabled={busy || !configComplete(channel.type, values)}>
              {busy && <Spinner />}
              Save
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteChannelDialog({
  channel,
  onOpenChange,
}: {
  channel: Channel | null;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<typeof clientAction>();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.intent === "delete") {
      onOpenChange(false);
      if (fetcher.data.ok) toast.success("Channel removed");
      else toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <AlertDialog open={channel !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this channel?</AlertDialogTitle>
          <AlertDialogDescription>
            Alerts stop going to{" "}
            <span className="font-mono">{channel ? configPreview(channel) : ""}</span>. Any
            per-wallet settings for it are removed too.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!channel) return;
              fetcher.submit({ intent: "delete", channelId: channel.id }, { method: "post" });
            }}
          >
            {busy && <Spinner />}
            Remove channel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChannelRow({
  channel,
  onEdit,
  onDelete,
}: {
  channel: Channel;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggleFetcher = useFetcher<typeof clientAction>();
  const [testing, setTesting] = useState(false);
  const meta = CHANNEL_META[channel.type];

  // While the toggle is in flight, show the submitted state instead of the server state.
  const enabled = toggleFetcher.formData
    ? toggleFetcher.formData.get("enabled") === "true"
    : channel.enabled;

  useEffect(() => {
    if (
      toggleFetcher.state === "idle" &&
      toggleFetcher.data?.intent === "toggle" &&
      !toggleFetcher.data.ok
    ) {
      toast.error(toggleFetcher.data.error);
    }
  }, [toggleFetcher.state, toggleFetcher.data]);

  const sendTest = async () => {
    setTesting(true);
    try {
      const result = await testChannel(channel.id);
      if (result.sent) toast.success(`Test sent to ${meta.name}`);
      else toast.error(`Test failed: ${result.error ?? "unknown error"}`);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 429
          ? "Test limit reached. Up to 10 tests per hour."
          : err instanceof Error
            ? err.message
            : "Test failed",
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <meta.icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{meta.name}</span>
          {!enabled && (
            <Badge variant="secondary" className="text-[10px]">
              Off
            </Badge>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {configPreview(channel)}
          <span className="ml-1.5 font-sans">added {formatDate(channel.createdAt)}</span>
        </p>
      </div>
      <Button variant="outline" size="xs" onClick={sendTest} disabled={testing || !enabled}>
        {testing ? <Spinner /> : <SendIcon />}
        Test
      </Button>
      <Switch
        checked={enabled}
        onCheckedChange={(checked) =>
          toggleFetcher.submit(
            { intent: "toggle", channelId: channel.id, enabled: String(checked) },
            { method: "post" },
          )
        }
        aria-label={`${meta.name} enabled`}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label="Channel actions" />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon /> Edit
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

export default function Channels({ loaderData }: Route.ComponentProps) {
  const { channels } = loaderData;
  const appData = useRouteLoaderData<typeof appClientLoader>("routes/_app");
  const emailAvailable = appData?.capabilities.email ?? false;
  const maxChannels = appData?.capabilities.limits.maxChannelsPerKey ?? 10;
  const atLimit = channels.length >= maxChannels;

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState<Channel | null>(null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs/relaxed text-muted-foreground">
          Where deposit alerts go, besides mobile push. {channels.length}/{maxChannels} in use.
        </p>
        {atLimit ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span>
                  <Button size="xs" disabled>
                    <PlusIcon /> Add channel
                  </Button>
                </span>
              }
            />
            <TooltipContent>This server allows {maxChannels} channels per key.</TooltipContent>
          </Tooltip>
        ) : (
          <Button size="xs" onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add channel
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RadioIcon />
            </EmptyMedia>
            <EmptyTitle>No channels yet</EmptyTitle>
            <EmptyDescription>
              Add {emailAvailable ? "ntfy, Discord, Slack, or email" : "ntfy, Discord, or Slack"} to
              get deposit alerts wherever you already look.
            </EmptyDescription>
          </EmptyHeader>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon /> Add your first channel
          </Button>
        </Empty>
      ) : (
        <div className="divide-y rounded-lg border">
          {channels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              onEdit={() => setEditing(channel)}
              onDelete={() => setDeleting(channel)}
            />
          ))}
        </div>
      )}

      <AddChannelDialog open={addOpen} onOpenChange={setAddOpen} emailAvailable={emailAvailable} />
      <EditChannelDialog channel={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <DeleteChannelDialog channel={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </div>
  );
}
