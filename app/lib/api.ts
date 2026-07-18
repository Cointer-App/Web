import { redirect } from "react-router";
import { clearKey, getKey } from "~/lib/auth";
import type {
  ActivitySummary,
  ActivityValuePage,
  Address,
  AddressNotifications,
  Capabilities,
  ChainInfo,
  Channel,
  ChannelConfig,
  ChannelType,
  PersonalConfig,
  PushToken,
  WalletValues,
} from "~/lib/api-types";

export const API_URL = import.meta.env.VITE_API_URL ?? "https://api.cointer.app";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  key?: string;
  auth?: boolean;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, key, auth = true } = options;

  const headers: Record<string, string> = {};
  if (auth) {
    const bearer = key ?? getKey();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the Cointer API. Check your connection.");
  }

  if (!res.ok) {
    if (res.status === 401 && auth && key === undefined) {
      clearKey();
      throw redirect("/login");
    }
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {}
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

export const getChains = () =>
  apiFetch<{ chains: ChainInfo[] }>("/chains", { auth: false }).then((r) => r.chains);

export const getCapabilities = () => apiFetch<Capabilities>("/capabilities", { auth: false });

export const mintKey = () =>
  apiFetch<{ personalKey: string }>("/personal", { method: "POST", auth: false });

export const getPersonal = (key?: string) => apiFetch<PersonalConfig>("/personal", { key });

export const rotateKey = () =>
  apiFetch<{ personalKey: string }>("/personal/rotate", { method: "POST" });

export const deleteAccount = () => apiFetch<{ deleted: true }>("/personal", { method: "DELETE" });

export const listAddresses = () =>
  apiFetch<{ addresses: Address[] }>("/addresses").then((r) => r.addresses);

export const addAddress = (input: {
  chain: string;
  address: string;
  label?: string;
  viewKey?: string;
}) => apiFetch<Address>("/addresses", { method: "POST", body: input });

export const renameAddress = (addressId: string, label: string | null) =>
  apiFetch<Address>(`/addresses/${addressId}`, { method: "PATCH", body: { label } });

export const deleteAddress = (addressId: string) =>
  apiFetch<{ deleted: true }>(`/addresses/${addressId}`, { method: "DELETE" });

export const getAddressNotifications = (addressId: string) =>
  apiFetch<AddressNotifications>(`/addresses/${addressId}/notifications`);

export const patchAddressNotifications = (
  addressId: string,
  input: { push?: boolean; channels?: Record<string, boolean> },
) =>
  apiFetch<AddressNotifications>(`/addresses/${addressId}/notifications`, {
    method: "PATCH",
    body: input,
  });

export const listChannels = () =>
  apiFetch<{ channels: Channel[] }>("/channels").then((r) => r.channels);

export const addChannel = (input: { type: ChannelType; config: ChannelConfig }) =>
  apiFetch<Channel>("/channels", { method: "POST", body: input });

export const patchChannel = (
  channelId: string,
  input: { enabled?: boolean; config?: ChannelConfig },
) => apiFetch<Channel>(`/channels/${channelId}`, { method: "PATCH", body: input });

export const deleteChannel = (channelId: string) =>
  apiFetch<{ deleted: true }>(`/channels/${channelId}`, { method: "DELETE" });

export const testChannel = (channelId: string) =>
  apiFetch<{ sent: boolean; error?: string }>(`/channels/${channelId}/test`, { method: "POST" });

export const deletePushToken = (tokenId: string) =>
  apiFetch<{ deleted: true }>(`/push-token/${tokenId}`, { method: "DELETE" });

const page = (limit?: number, cursor?: number) => {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (cursor !== undefined) params.set("cursor", String(cursor));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const getActivityValue = (limit?: number, cursor?: number) =>
  apiFetch<ActivityValuePage>(`/activity/value${page(limit, cursor)}`);

export const getActivitySummary = () => apiFetch<ActivitySummary>("/activity/summary");

export const getWalletValues = () => apiFetch<WalletValues>("/wallets/value");
