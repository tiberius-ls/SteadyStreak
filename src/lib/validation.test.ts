import { describe, expect, it } from "vitest";
import {
  isValidNimiqAddress,
  parseLunaAmount,
  parseStreak,
  sanitizeHabit,
} from "./validation";

describe("isValidNimiqAddress", () => {
  it("accepts spaced and compact user-friendly addresses", () => {
    expect(
      isValidNimiqAddress("NQ71 CSCP 3N1P T0UP RMJR BQFR DTL3 1G8S KTGF")
    ).toBe(true);
    expect(
      isValidNimiqAddress("NQ71CSCP3N1PT0UPRMJRBQFRDTL31G8SKTGF")
    ).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidNimiqAddress("not-an-address")).toBe(false);
    expect(isValidNimiqAddress("")).toBe(false);
  });
});

describe("sanitizeHabit", () => {
  it("trims and caps length", () => {
    expect(sanitizeHabit("  Meditate  ")).toBe("Meditate");
    expect(sanitizeHabit("x".repeat(100)).length).toBe(80);
  });
});

describe("parseStreak / parseLunaAmount", () => {
  it("bounds numbers", () => {
    expect(parseStreak(3.9)).toBe(3);
    expect(parseStreak(-1)).toBeNull();
    expect(parseLunaAmount(12.7)).toBe(12);
    expect(parseLunaAmount(-5)).toBeNull();
  });
});
