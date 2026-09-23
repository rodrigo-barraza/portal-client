/**
 * Decode a dynamic route segment. Next may hand a segment over still
 * percent-encoded; a malformed sequence (a literal "%") would make
 * decodeURIComponent throw and take the page down, so fall back to the
 * raw value instead.
 */
export function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
