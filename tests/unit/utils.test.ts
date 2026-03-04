import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatHours,
  daysUntil,
  formatPropertyType,
  cn,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats positive numbers", () => {
    expect(formatCurrency(1500)).toBe("$1,500");
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("returns dash for null/undefined", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("converts decimals to percentages", () => {
    expect(formatPercent(0.95)).toBe("95.0%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("returns dash for null/undefined", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("formats numbers with commas", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(0)).toBe("0");
  });

  it("returns dash for null/undefined", () => {
    expect(formatNumber(null)).toBe("—");
  });
});

describe("formatHours", () => {
  it("formats hours", () => {
    expect(formatHours(24.5)).toBe("24.5h");
    expect(formatHours(1)).toBe("1.0h");
  });

  it("formats sub-hour as minutes", () => {
    expect(formatHours(0.5)).toBe("30m");
    expect(formatHours(0.25)).toBe("15m");
  });

  it("returns dash for null/undefined", () => {
    expect(formatHours(null)).toBe("—");
  });
});

describe("daysUntil", () => {
  it("returns null for null input", () => {
    expect(daysUntil(null)).toBeNull();
  });

  it("returns positive for future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const result = daysUntil(future.toISOString().slice(0, 10));
    expect(result).toBeGreaterThanOrEqual(29);
    expect(result).toBeLessThanOrEqual(31);
  });

  it("returns negative for past dates", () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    const result = daysUntil(past.toISOString().slice(0, 10));
    expect(result).toBeLessThan(0);
  });
});

describe("formatPropertyType", () => {
  it("converts snake_case to Title Case", () => {
    expect(formatPropertyType("single_family")).toBe("Single Family");
    expect(formatPropertyType("multi_family")).toBe("Multi Family");
    expect(formatPropertyType("mixed_use")).toBe("Mixed Use");
    expect(formatPropertyType("commercial")).toBe("Commercial");
  });
});

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("returns empty string for no classes", () => {
    expect(cn(false, null)).toBe("");
  });
});
