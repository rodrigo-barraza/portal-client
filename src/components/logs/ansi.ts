import type { CSSProperties } from "react";

/**
 * ANSI escape handling for the log terminal: SGR colour/style codes become
 * styled segments; every other control sequence (cursor moves, line
 * clears, OSC hyperlinks) is dropped instead of leaking "[2K" into a line.
 *
 * The palette is a terminal's, so it is literal hex on purpose — the log
 * viewer always renders on the dark twilight theme.
 */

const ANSI_COLORS = [
  null, // 0 – default (inherit)
  "#ef4444", // 1 – red
  "#22c55e", // 2 – green
  "#eab308", // 3 – yellow
  "#3b82f6", // 4 – blue
  "#a855f7", // 5 – magenta
  "#06b6d4", // 6 – cyan
  "#d4d4d8", // 7 – white
];

const ANSI_BRIGHT_COLORS = [
  "#71717a", // 0 – bright black (gray)
  "#f87171", // 1 – bright red
  "#4ade80", // 2 – bright green
  "#fde047", // 3 – bright yellow
  "#60a5fa", // 4 – bright blue
  "#c084fc", // 5 – bright magenta
  "#22d3ee", // 6 – bright cyan
  "#ffffff", // 7 – bright white
];

// CSI sequences (ESC [ params final-byte) and OSC sequences (ESC ] … BEL|ST).
const ESCAPE_PATTERN =
  /\x1b\[([0-9;?]*)([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

export interface AnsiSegment {
  text: string;
  style?: CSSProperties;
}

function hexByte(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

/** xterm 256-colour index → hex. */
export function ansi256ToHex(index: number): string | null {
  if (index < 8) return ANSI_COLORS[index];
  if (index < 16) return ANSI_BRIGHT_COLORS[index - 8];
  if (index < 232) {
    const cube = index - 16;
    return `#${hexByte(Math.floor(cube / 36) * 51)}${hexByte((Math.floor(cube / 6) % 6) * 51)}${hexByte((cube % 6) * 51)}`;
  }
  const gray = (index - 232) * 10 + 8;
  return `#${hexByte(gray)}${hexByte(gray)}${hexByte(gray)}`;
}

/** Remove every escape sequence, leaving the visible text. */
export function stripAnsi(text: string): string {
  return text.includes("\x1b") ? text.replace(ESCAPE_PATTERN, "") : text;
}

interface SgrState {
  color: string | null;
  background: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

const RESET: SgrState = {
  color: null,
  background: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

function styleOf(state: SgrState): CSSProperties | undefined {
  const style: CSSProperties = {};
  if (state.color) style.color = state.color;
  if (state.background) style.backgroundColor = state.background;
  if (state.bold) style.fontWeight = 700;
  if (state.dim) style.opacity = 0.6;
  if (state.italic) style.fontStyle = "italic";
  const decorations = [
    state.underline ? "underline" : "",
    state.strikethrough ? "line-through" : "",
  ].filter(Boolean);
  if (decorations.length > 0) style.textDecoration = decorations.join(" ");
  return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Parse an extended colour (`38;5;n` / `38;2;r;g;b`) starting at `codes[at]`
 * (the `5` or `2`). Returns the colour and how many codes it consumed.
 */
function extendedColor(codes: number[], at: number): [string | null, number] {
  if (codes[at] === 5 && codes[at + 1] != null)
    return [ansi256ToHex(codes[at + 1]), 2];
  if (codes[at] === 2 && codes[at + 3] != null) {
    return [
      `#${hexByte(codes[at + 1])}${hexByte(codes[at + 2])}${hexByte(codes[at + 3])}`,
      4,
    ];
  }
  return [null, 0];
}

function applySgr(state: SgrState, params: string): SgrState {
  const codes = params
    ? params.split(";").map((code) => Number(code) || 0)
    : [0];
  let next = { ...state };
  for (let index = 0; index < codes.length; index++) {
    const code = codes[index];
    if (code === 0) next = { ...RESET };
    else if (code === 1) next.bold = true;
    else if (code === 2) next.dim = true;
    else if (code === 3) next.italic = true;
    else if (code === 4) next.underline = true;
    else if (code === 9) next.strikethrough = true;
    else if (code === 22) next = { ...next, bold: false, dim: false };
    else if (code === 23) next.italic = false;
    else if (code === 24) next.underline = false;
    else if (code === 29) next.strikethrough = false;
    else if (code === 39) next.color = null;
    else if (code === 49) next.background = null;
    else if (code >= 30 && code <= 37) next.color = ANSI_COLORS[code - 30];
    else if (code >= 40 && code <= 47) next.background = ANSI_COLORS[code - 40];
    else if (code >= 90 && code <= 97)
      next.color = ANSI_BRIGHT_COLORS[code - 90];
    else if (code >= 100 && code <= 107)
      next.background = ANSI_BRIGHT_COLORS[code - 100];
    else if (code === 38 || code === 48) {
      const [color, consumed] = extendedColor(codes, index + 1);
      if (code === 38) next.color = color;
      else next.background = color;
      index += consumed;
    }
  }
  return next;
}

/**
 * Split ANSI-coded text into styled segments. Supports reset, bold, dim,
 * italic, underline, strikethrough, the 8 + 8 bright colours, 256-colour
 * and 24-bit colour, foreground and background.
 */
export function parseAnsiSegments(text: string): AnsiSegment[] {
  if (!text.includes("\x1b")) return text ? [{ text }] : [];

  const segments: AnsiSegment[] = [];
  let state = RESET;
  let lastIndex = 0;

  const push = (chunk: string) => {
    if (!chunk) return;
    const style = styleOf(state);
    segments.push(style ? { text: chunk, style } : { text: chunk });
  };

  for (const match of text.matchAll(ESCAPE_PATTERN)) {
    push(text.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
    if (match[2] === "m") state = applySgr(state, match[1] ?? "");
  }
  push(text.slice(lastIndex));
  return segments;
}
