"use client";

import { ESCROW_ADDRESS, MOCK_MODE_KEY } from "./constants";

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
  listAccounts: () => Promise<string[] | { error: { message: string } }>;
  sendBasicTransactionWithData: (tx: {
    recipient: string;
    value: number;
    data: string;
    fee?: number;
  }) => Promise<string | { error: { message: string } }>;
  isConsensusEstablished?: () => Promise<boolean>;
  getBlockNumber?: () => Promise<number>;
};

function isErrorResponse(
  value: unknown
): value is { error: { message: string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "object"
  );
}

function unwrap<T>(value: T | { error: { message: string } }): T {
  if (isErrorResponse(value)) {
    throw new Error(value.error.message || "Nimiq wallet rejected the request");
  }
  return value;
}

function randomTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function mockAddressFromSeed(seed: string): string {
  // Deterministic fake Nimiq-style address for demo
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, "0") + "a1b2c3d4e5f67890";
  const groups = hex
    .padEnd(32, "0")
    .slice(0, 32)
    .match(/.{1,4}/g)!;
  return `NQ${String((h % 90) + 10)} ${groups.join(" ").toUpperCase()}`;
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
  const forceMock = options?.forceMock || isMockPreferred();

  if (!forceMock && typeof window !== "undefined") {
    try {
      const { init } = await import("@nimiq/mini-app-sdk");
      const provider = (await init({ timeout: 4_000 })) as ProviderLike;
      const accounts = unwrap(await provider.listAccounts());
      if (!accounts?.length) {
        throw new Error("No Nimiq accounts available. Create one in Nimiq Pay.");
      }
      const address = accounts[0];

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
          const total = saveLuna + stakeLuna;
          if (total <= 0) throw new Error("Check-in amount must be greater than 0");
          const data = `SteadyStreak|c=${cycleId}|d=${dayNumber}|save=${saveLuna}|stake=${stakeLuna}`;
          const hash = unwrap(
            await provider.sendBasicTransactionWithData({
              recipient: ESCROW_ADDRESS,
              value: total,
              data,
            })
          );
          return hash;
        },
      };
    } catch (err) {
      // Fall through to mock when not inside Nimiq Pay
      const message = err instanceof Error ? err.message : String(err);
      if (
        !message.toLowerCase().includes("timeout") &&
        !message.toLowerCase().includes("not found") &&
        !message.toLowerCase().includes("inject")
      ) {
        // Permission denied etc. — rethrow if provider existed
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
      const total = saveLuna + stakeLuna;
      if (total <= 0) throw new Error("Check-in amount must be greater than 0");
      // Simulate network latency + user confirmation
      await new Promise((r) => setTimeout(r, 600));
      const hash = randomTxHash();
      console.info("[SteadyStreak mock tx]", {
        to: ESCROW_ADDRESS,
        value: total,
        data: `SteadyStreak|c=${cycleId}|d=${dayNumber}|save=${saveLuna}|stake=${stakeLuna}`,
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
