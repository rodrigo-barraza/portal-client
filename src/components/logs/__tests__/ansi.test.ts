import { describe, expect, it } from "vitest";
import { ansi256ToHex, parseAnsiSegments, stripAnsi } from "../ansi";

const ESC = "\x1b";

describe("stripAnsi", () => {
  it("removes colour codes and other control sequences", () => {
    expect(stripAnsi(`${ESC}[32mready${ESC}[0m`)).toBe("ready");
    expect(stripAnsi(`${ESC}[2K${ESC}[1Gprogress 50%`)).toBe("progress 50%");
    expect(stripAnsi(`${ESC}]8;;https://rod.dev${ESC}\\link${ESC}]8;;${ESC}\\`)).toBe("link");
    expect(stripAnsi("plain")).toBe("plain");
  });
});

describe("parseAnsiSegments", () => {
  it("returns plain text untouched", () => {
    expect(parseAnsiSegments("hello")).toEqual([{ text: "hello" }]);
    expect(parseAnsiSegments("")).toEqual([]);
  });

  it("styles text between SGR codes and resets", () => {
    expect(parseAnsiSegments(`a ${ESC}[31;1mred${ESC}[0m b`)).toEqual([
      { text: "a " },
      { text: "red", style: { color: "#ef4444", fontWeight: 700 } },
      { text: " b" },
    ]);
  });

  it("supports 256-colour and 24-bit colour without misreading their parameters", () => {
    expect(parseAnsiSegments(`${ESC}[38;5;196mx`)).toEqual([
      { text: "x", style: { color: "#ff0000" } },
    ]);
    // `2` and `0` inside 38;2;r;g;b must not be taken as dim / reset.
    expect(parseAnsiSegments(`${ESC}[1m${ESC}[38;2;0;128;255my`)).toEqual([
      { text: "y", style: { color: "#0080ff", fontWeight: 700 } },
    ]);
    expect(parseAnsiSegments(`${ESC}[48;2;16;32;48mz`)).toEqual([
      { text: "z", style: { backgroundColor: "#102030" } },
    ]);
  });

  it("combines underline and strikethrough", () => {
    expect(parseAnsiSegments(`${ESC}[4;9mx`)).toEqual([
      { text: "x", style: { textDecoration: "underline line-through" } },
    ]);
  });

  it("drops non-colour control sequences instead of printing them", () => {
    expect(parseAnsiSegments(`${ESC}[2Kdone`)).toEqual([{ text: "done" }]);
  });
});

describe("ansi256ToHex", () => {
  it("covers the base, cube and grayscale ranges", () => {
    expect(ansi256ToHex(1)).toBe("#ef4444");
    expect(ansi256ToHex(9)).toBe("#f87171");
    expect(ansi256ToHex(21)).toBe("#0000ff");
    expect(ansi256ToHex(232)).toBe("#080808");
    expect(ansi256ToHex(255)).toBe("#eeeeee");
  });
});
