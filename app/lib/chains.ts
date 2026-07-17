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
  "bitcoin-cash": {
    ticker: "BCH",
    badgeClassName: "bg-lime-500/15 text-lime-700 dark:text-lime-400",
    addressPattern: /^(bitcoincash:)?(q|p)[a-z0-9]{41}$|^[13][a-zA-Z0-9]{25,34}$/,
    addressHint: "Bitcoin Cash addresses start with bitcoincash:q, q, or (legacy) 1/3.",
    addressPlaceholder: "bitcoincash:q… or 1…",
    explorerTxUrl: (tx) => `https://blockchair.com/bitcoin-cash/transaction/${tx}`,
  },
  base: {
    ticker: "ETH",
    badgeClassName: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    addressPattern: /^0x[a-fA-F0-9]{40}$/,
    addressHint: "Base addresses are 0x followed by 40 hex characters.",
    addressPlaceholder: "0x…",
    explorerTxUrl: (tx) => `https://basescan.org/tx/${tx}`,
  },
  solana: {
    ticker: "SOL",
    badgeClassName: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    addressHint: "Solana addresses are 32-44 base58 characters.",
    addressPlaceholder: "Base58 address…",
    explorerTxUrl: (tx) => `https://solscan.io/tx/${tx}`,
  },
  litecoin: {
    ticker: "LTC",
    badgeClassName: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
    addressPattern: /^(ltc1[a-z0-9]{25,87}|[LM3][a-zA-Z0-9]{25,34})$/,
    addressHint: "Litecoin addresses start with ltc1, L, M, or 3.",
    addressPlaceholder: "ltc1… or L…",
    explorerTxUrl: (tx) => `https://litecoinspace.org/tx/${tx}`,
  },
  monero: {
    ticker: "XMR",
    badgeClassName: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    addressPattern: /^[48][1-9A-HJ-NP-Za-km-z]{94,105}$/,
    addressHint:
      "Monero addresses are 95 (or 106 for integrated) base58 characters starting with 4 or 8.",
    addressPlaceholder: "4… or 8…",
    explorerTxUrl: (tx) => `https://xmrchain.net/tx/${tx}`,
  },
};

export function chainTicker(chain: string): string {
  return CHAIN_CONFIG[chain]?.ticker ?? chain;
}

export function chainExplorerTxUrl(chain: string, txHash: string): string | null {
  return CHAIN_CONFIG[chain]?.explorerTxUrl(txHash) ?? null;
}
