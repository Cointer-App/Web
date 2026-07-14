export type ChannelType = "ntfy" | "discord" | "slack" | "email";

export interface ChainInfo {
  id: string;
  name: string;
  asset: string;
}

export interface Capabilities {
  email: boolean;
  currency: string;
  limits: {
    maxAddressesPerKey: number;
    maxChannelsPerKey: number;
    maxPushTokensPerKey: number;
    activityRetentionDays: number;
  };
}

export interface Address {
  id: string;
  chain: string;
  address: string;
  label: string | null;
  createdAt: number;
}

// Embedded in GET /personal, includes mute state (opt-out model).
export interface PersonalAddress extends Address {
  notifications: {
    pushMuted: boolean;
    mutedChannelIds: string[];
  };
}

// url is for discord/slack, comes back redacted on reads.
export type ChannelConfig = { topic: string; server?: string } | { url: string } | { to: string };

export interface Channel {
  id: string;
  type: ChannelType;
  enabled: boolean;
  config: ChannelConfig;
  createdAt: number;
}

export interface PushToken {
  id: string;
  token: string;
  platform: "ios" | "android";
  createdAt: number;
}

export interface PersonalConfig {
  createdAt: number;
  addresses: PersonalAddress[];
  channels: Channel[];
  pushTokens: PushToken[];
}

export interface AddressNotifications {
  push: { enabled: boolean };
  channels: (Channel & { enabledForWallet: boolean })[];
}

export interface ActivityItem {
  id: number;
  chain: string;
  address: string;
  txHash: string;
  amount: string;
  asset: string;
  createdAt: number;
}

export interface PricedActivityItem extends ActivityItem {
  fiatValue: number | null;
}

export interface ActivityValuePage {
  currency: string;
  priceAsOf: number | null;
  total: number;
  unpricedCount: number;
  items: PricedActivityItem[];
  nextCursor: number | null;
}

export interface SummaryWindow {
  count: number;
  fiatTotal: number;
  unpricedCount: number;
}

export interface ActivitySummary {
  currency: string;
  priceAsOf: number | null;
  windows: {
    "24h": SummaryWindow;
    "7d": SummaryWindow;
    "30d": SummaryWindow;
  };
  assets: {
    chain: string;
    asset: string;
    count: number;
    amount: string;
    fiatValue: number | null;
  }[];
}
