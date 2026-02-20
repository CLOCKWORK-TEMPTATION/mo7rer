import { describe, expect, it } from "vitest";

import { resolveTypingOnEnter, resolveTypingOnTab } from "./typing-workflow-rules";

describe("typing workflow rules", () => {
  it("moves scene-header-1 to scene-header-2 on Tab", () => {
    expect(resolveTypingOnTab("scene-header-1").nextFormat).toBe("scene-header-2");
  });

  it("moves scene-header-2 to scene-header-3 on Tab", () => {
    expect(resolveTypingOnTab("scene-header-2").nextFormat).toBe("scene-header-3");
  });

  it("moves scene-header-3 to action on Enter", () => {
    expect(resolveTypingOnEnter("scene-header-3").nextFormat).toBe("action");
  });

  it("keeps action on Enter", () => {
    expect(resolveTypingOnEnter("action").nextFormat).toBe("action");
  });

  it("moves action to character on Tab", () => {
    expect(resolveTypingOnTab("action").nextFormat).toBe("character");
  });

  it("moves character to dialogue on Enter", () => {
    expect(resolveTypingOnEnter("character").nextFormat).toBe("dialogue");
  });

  it("moves dialogue to character on Enter", () => {
    expect(resolveTypingOnEnter("dialogue").nextFormat).toBe("character");
  });

  it("moves dialogue to action on Tab", () => {
    expect(resolveTypingOnTab("dialogue").nextFormat).toBe("action");
  });

  it("moves transition to scene-header-1 on Tab", () => {
    expect(resolveTypingOnTab("transition").nextFormat).toBe("scene-header-1");
  });

  it("keeps transition with ending seed text on Enter", () => {
    expect(resolveTypingOnEnter("transition")).toEqual({
      nextFormat: "transition",
      seedText: "النهاية",
    });
  });
});
