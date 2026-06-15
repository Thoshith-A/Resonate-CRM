import { describe, expect, it } from "vitest";
import { IST_OFFSET_MINUTES } from "@resonate/shared";
import { inferSendWindow } from "./inferSendWindows";

/** An order placed at the given IST hour (minute 30) on a fixed date. */
function orderAtIstHour(hour: number): { placedAt: Date } {
  const utcMinutes = hour * 60 + 30 - IST_OFFSET_MINUTES;
  return { placedAt: new Date(Date.UTC(2026, 0, 1, 0, utcMinutes)) };
}

describe("inferSendWindow", () => {
  it("5 evening orders → EVENING HIGH", () => {
    const orders = Array.from({ length: 5 }, () => orderAtIstHour(19)); // 19:30 IST
    const result = inferSendWindow(orders);
    expect(result.window).toBe("EVENING");
    expect(result.confidence).toBe("HIGH");
    expect(result.delayMinutes).toBe(120);
  });

  it("2 orders split across windows → MORNING LOW", () => {
    const orders = [orderAtIstHour(9), orderAtIstHour(19)]; // < 3 orders
    const result = inferSendWindow(orders);
    expect(result.window).toBe("MORNING");
    expect(result.confidence).toBe("LOW");
    expect(result.delayMinutes).toBe(0);
  });

  it("0 orders → MORNING LOW", () => {
    const result = inferSendWindow([]);
    expect(result.window).toBe("MORNING");
    expect(result.confidence).toBe("LOW");
    expect(result.delayMinutes).toBe(0);
  });

  it("exactly 3 morning orders → MORNING HIGH", () => {
    const orders = Array.from({ length: 3 }, () => orderAtIstHour(9)); // 09:30 IST
    const result = inferSendWindow(orders);
    expect(result.window).toBe("MORNING");
    expect(result.confidence).toBe("HIGH");
    expect(result.delayMinutes).toBe(0);
  });

  it("night shopper (4 orders at 23:30 IST) → NIGHT HIGH", () => {
    const orders = Array.from({ length: 4 }, () => orderAtIstHour(23));
    const result = inferSendWindow(orders);
    expect(result.window).toBe("NIGHT");
    expect(result.confidence).toBe("HIGH");
    expect(result.delayMinutes).toBe(180);
  });
});
