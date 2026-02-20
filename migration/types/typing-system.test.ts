import { describe, expect, it } from "vitest";

import {
  DEFAULT_TYPING_SYSTEM_SETTINGS,
  minutesToMilliseconds,
  sanitizeTypingSystemSettings,
} from "./typing-system";

describe("typing system helpers", () => {
  it("converts minutes to milliseconds accurately", () => {
    expect(minutesToMilliseconds(3)).toBe(180_000);
    expect(minutesToMilliseconds(1.5)).toBe(90_000);
  });

  it("sanitizes invalid settings and keeps defaults", () => {
    const sanitized = sanitizeTypingSystemSettings({
      typingSystemMode: "invalid" as never,
      liveIdleMinutes: 0,
    });

    expect(sanitized.typingSystemMode).toBe(
      DEFAULT_TYPING_SYSTEM_SETTINGS.typingSystemMode
    );
    expect(sanitized.liveIdleMinutes).toBe(1);
    expect(sanitized.liveScope).toBe("document");
    expect(sanitized.deferredScope).toBe("document");
    expect(sanitized.keepNavigationMapInPlain).toBe(true);
  });

  it("accepts supported modes and clamps live idle minutes", () => {
    const sanitized = sanitizeTypingSystemSettings({
      typingSystemMode: "auto-live",
      liveIdleMinutes: 99,
    });

    expect(sanitized.typingSystemMode).toBe("auto-live");
    expect(sanitized.liveIdleMinutes).toBe(15);
  });
});
