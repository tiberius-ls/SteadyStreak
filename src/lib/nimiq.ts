"use client";

import { ESCROW_ADDRESS, MOCK_MODE_KEY } from "./constants";
import { MOCK_ADDRESS_MARKERS } from "./mock-wallet";

export { isMockWalletAddress } from "./mock-wallet";

export type NimiqClient = {
  listAccounts: () => Promise<string[]>;
  sendCheckinTransaction: (params: {
    saveLuna: number;
    stakeLuna: number;
    cycleId: string;
    dayNumber: number;
  }) => Promise<string>;
  isMock: boolean;
  address: string | null;
};

type ProviderLike = {
  listAccounts: () => Promise<string[] | { error: { message: string; type?: string } }>;
  sendBasicTransactionWithData: (tx: {
    recipient: string;
    value: number;
    data: string;
    fee?: number;
    validityStartHeight?: number;
  }) => Promise<string | { error: { message: string; type?: string } }>;
  isConsensusEstablished?: () => Promise<boolean>;
  getBlockNumber?: () => Promise<number>;
};

function isErrorResponse(
  value: unknown
): value is { error: { message: string; type?: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "object" &&
    (value as { error: unknown }).error !== null
  );
}

function formatWalletError(err: { message: string; type?: string }): string {
  const type = err.type ? `${err.type}: ` : "";
  const msg = err.message || "Nimiq wallet rejected the request";
  // Friendlier common cases
  const lower = msg.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("reject")) {
    return "You cancelled the payment in Nimiq Pay. Tap Mark done again and confirm.";
  }
  if (
    lower.includes("balance") ||
    lower.includes("insufficient") ||
    lower.includes("fund")
  ) {
    return "Not enough NIM in your Nimiq Pay wallet for this check-in (save + stake + fee).";
  }
  if (lower.includes("invalid") || lower.includes("malform")) {
    return `Invalid transaction: ${msg}. Check escrow address and amounts.`;
  }
  return `${type}${msg}`;
}

function unwrap<T>(value: T | { error: { message: string; type?: string } }): T {
  if (isErrorResponse(value)) {
    throw new Error(formatWalletError(value.error));
  }
  return value;
}

function randomTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function mockAddressFromSeed(seed: string): string {
  // Deterministic fake Nimiq-style address for demo (includes DEADBEEFCAFEDEMO marker)
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = (h.toString(16).padStart(8, "0") + MOCK_ADDRESS_MARKERS[0])
    .padEnd(32, "0")
    .slice(0, 32);
  const groups = hex.match(/.{1,4}/g)!;
  return `NQ${String((h % 90) + 10)} ${groups.join(" ").toUpperCase()}`;
}

/** Compact memo so txs stay small; full cycle id is stored in the app. */
function checkinData(
  cycleId: string,
  dayNumber: number,
  saveLuna: number,
  stakeLuna: number
): string {
  const short = cycleId.replace(/-/g, "").slice(0, 12);
  return `SS|${short}|d${dayNumber}|s${saveLuna}|k${stakeLuna}`;
}

export function isNimiqPayEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.nimiq || window.nimiqPay);
}

export function isMockPreferred(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MOCK_MODE_KEY) === "1";
}

export function setMockPreferred(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(MOCK_MODE_KEY, "1");
  else localStorage.removeItem(MOCK_MODE_KEY);
}

/**
 * Connect to Nimiq Pay via @nimiq/mini-app-sdk, or fall back to a local mock
 * provider so the app is fully usable in a regular browser for development.
 */
export async function connectWallet(options?: {
  forceMock?: boolean;
}): Promise<NimiqClient> {
  // Inside Nimiq Pay always prefer the real wallet — never stick on old demo mode.
  const inPay = isNimiqPayEnvironment();
  const forceMock = Boolean(options?.forceMock) || (!inPay && isMockPreferred());

  if (!forceMock && typeof window !== "undefined") {
    try {
      const { init } = await import("@nimiq/mini-app-sdk");
      const provider = (await init({ timeout: 8_000 })) as ProviderLike;
      const accounts = unwrap(await provider.listAccounts());
      if (!accounts?.length) {
        throw new Error(
          "No Nimiq accounts in Nimiq Pay. Create or import a wallet first."
        );
      }
      const address = accounts[0];
      // Real wallet connected — clear sticky demo flag
      setMockPreferred(false);

      return {
        isMock: false,
        address,
        listAccounts: async () => unwrap(await provider.listAccounts()),
        sendCheckinTransaction: async ({
          saveLuna,
          stakeLuna,
          cycleId,
          dayNumber,
        }) => {
          const total = Math.floor(saveLuna) + Math.floor(stakeLuna);
          if (total <= 0) {
            throw new Error("Check-in amount must be greater than 0");
          }

          if (provider.isConsensusEstablished) {
            const ready = await provider.isConsensusEstablished();
            if (!ready) {
              throw new Error(
                "Nimiq network is still syncing. Wait a few seconds and try again."
              );
            }
          }

          const recipient = ESCROW_ADDRESS.trim();
          if (!recipient || /0000 0000 0000 0000 0000 0000 0000 0000/.test(recipient)) {
            throw new Error(
              "Escrow address is not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS."
            );
          }

          const data = checkinData(cycleId, dayNumber, Math.floor(saveLuna), Math.floor(stakeLuna));

          try {
            const hash = unwrap(
              await provider.sendBasicTransactionWithData({
                recipient,
                value: total,
                data,
              })
            );
            return hash;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            // Surface raw message if already formatted
            throw new Error(
              msg.includes("Nimiq") || msg.includes("cancel") || msg.includes("NIM")
                ? msg
                : `Check-in transaction failed: ${msg}`
            );
          }
        },
      };
    } catch (err) {
      // Fall through to mock only when not inside Nimiq Pay
      const message = err instanceof Error ? err.message : String(err);
      if (inPay) {
        // Real failures inside Pay should not silently become demo mode
        throw err instanceof Error ? err : new Error(message);
      }
      if (
        !message.toLowerCase().includes("timeout") &&
        !message.toLowerCase().includes("not found") &&
        !message.toLowerCase().includes("inject")
      ) {
        if (typeof window !== "undefined" && window.nimiq) {
          throw err;
        }
      }
    }
  }

  // Mock provider for browser / hackathon demo
  setMockPreferred(true);
  const seed =
    typeof window !== "undefined"
      ? localStorage.getItem("steadystreak:mock-seed") ||
        (() => {
          const s = `demo-${Date.now()}`;
          localStorage.setItem("steadystreak:mock-seed", s);
          return s;
        })()
      : "demo";
  const address = mockAddressFromSeed(seed);

  return {
    isMock: true,
    address,
    listAccounts: async () => [address],
    sendCheckinTransaction: async ({
      saveLuna,
      stakeLuna,
      cycleId,
      dayNumber,
    }) => {
      const total = Math.floor(saveLuna) + Math.floor(stakeLuna);
      if (total <= 0) throw new Error("Check-in amount must be greater than 0");
      await new Promise((r) => setTimeout(r, 600));
      const hash = randomTxHash();
      console.info("[SteadyStreak mock tx]", {
        to: ESCROW_ADDRESS,
        value: total,
        data: checkinData(cycleId, dayNumber, Math.floor(saveLuna), Math.floor(stakeLuna)),
        hash,
      });
      return hash;
    },
  };
}

export function shortAddress(address: string, chars = 4): string {
  const compact = address.replace(/\s+/g, "");
  if (compact.length <= chars * 2 + 2) return address;
  return `${compact.slice(0, chars + 2)}…${compact.slice(-chars)}`;
}
