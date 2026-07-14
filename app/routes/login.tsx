import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import { CheckIcon, CopyIcon, DownloadIcon, TriangleAlertIcon } from "lucide-react";

import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { ApiError, getPersonal, mintKey } from "~/lib/api";
import { getKey, KEY_PATTERN, setKey } from "~/lib/auth";
import { downloadTextFile } from "~/lib/format";
import { Logo } from "~/components/logo";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

export function meta() {
  return [{ title: "Sign in - Cointer" }];
}

export async function clientLoader() {
  if (getKey()) throw redirect("/");
  return null;
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}

function PasteKeyForm() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!KEY_PATTERN.test(key)) {
      setError("Keys look like ck_ followed by 43 characters.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await getPersonal(key);
      setKey(key);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That key isn't valid. Check for missing characters."
          : err instanceof Error
            ? err.message
            : "Couldn't verify the key.",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={error !== null}>
        <FieldLabel htmlFor="personal-key">Personal key</FieldLabel>
        <Input
          id="personal-key"
          className="font-mono"
          placeholder="ck_…"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <FieldDescription>The key you saved when you created your account.</FieldDescription>
        )}
      </Field>
      <Button type="submit" disabled={checking || value.trim() === ""}>
        {checking && <Spinner />}
        Continue
      </Button>
    </form>
  );
}

function NewKeyReveal({ personalKey }: { personalKey: string }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex flex-col gap-4">
      <InputGroup>
        <InputGroupInput
          readOnly
          className="font-mono text-xs"
          value={personalKey}
          onFocus={(e) => e.currentTarget.select()}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Copy key" onClick={() => copy(personalKey)}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label="Download key"
            onClick={() => downloadTextFile("cointer-key.txt", `${personalKey}\n`)}
          >
            <DownloadIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs/relaxed">
        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <p>
          This key is the only way into your account and it is never shown again. Save it somewhere
          safe before continuing.
        </p>
      </div>
      <Label className="flex items-center gap-2 text-xs/relaxed">
        <Checkbox checked={saved} onCheckedChange={(checked) => setSaved(checked === true)} />I
        saved my key
      </Label>
      <Button
        disabled={!saved}
        onClick={() => {
          setKey(personalKey);
          navigate("/");
        }}
      >
        Continue
      </Button>
    </div>
  );
}

function CreateKeyForm() {
  const [minted, setMinted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);

  if (minted) return <NewKeyReveal personalKey={minted} />;

  const create = async () => {
    setMinting(true);
    setError(null);
    try {
      const { personalKey } = await mintKey();
      setMinted(personalKey);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many new keys from your network. Try again in an hour."
          : err instanceof Error
            ? err.message
            : "Couldn't create a key.",
      );
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs/relaxed text-muted-foreground">
        A personal key is your whole account. No email, no password. You get one chance to save it.
      </p>
      {error && <p className="text-xs/relaxed text-destructive">{error}</p>}
      <Button onClick={create} disabled={minting}>
        {minting && <Spinner />}
        Create a key
      </Button>
    </div>
  );
}

export default function Login() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo className="size-9" />
          <h1 className="text-lg font-semibold tracking-tight">Cointer</h1>
          <p className="text-xs/relaxed text-muted-foreground">
            Watch wallets. Get pinged when funds arrive.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <Tabs defaultValue="paste">
            <TabsList className="w-full">
              <TabsTrigger value="paste">I have a key</TabsTrigger>
              <TabsTrigger value="create">Create a key</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="pt-3">
              <PasteKeyForm />
            </TabsContent>
            <TabsContent value="create" className="pt-3">
              <CreateKeyForm />
            </TabsContent>
          </Tabs>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <a
            href="https://cointer.app/terms"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="https://cointer.app/privacy"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
