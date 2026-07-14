export interface ChainConfig {
  ticker: string;
  badgeClassName: string;
  addressPattern: RegExp;
  addressHint: string;
  addressPlaceholder: string;
  explorerTxUrl: (txHash: string) => string;
}

export const CHAIN_CONFIG: Record<string, ChainConfig> = {
  bitcoin: {
    ticker: "BTC",
    badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    addressPattern: /^(bc1[a-z0-9]{25,87}|[13][a-zA-Z0-9]{25,34})$/,
    addressHint: "Bitcoin addresses start with bc1, 1, or 3.",
    addressPlaceholder: "bc1…",
    explorerTxUrl: (tx) => `https://mempool.space/tx/${tx}`,
  },
  ethereum: {
    ticker: "ETH",
    badgeClassName: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
    addressHint: "Ethereum addresses are 0x followed by 40 hex characters.",
    addressPlaceholder: "0x…",
    explorerTxUrl: (tx) => `https://etherscan.io/tx/${tx}`,
  },
};

export function chainTicker(chain: string): string {
  return CHAIN_CONFIG[chain]?.ticker ?? chain;
}

export function chainExplorerTxUrl(chain: string, txHash: string): string | null {
  return CHAIN_CONFIG[chain]?.explorerTxUrl(txHash) ?? null;
}
