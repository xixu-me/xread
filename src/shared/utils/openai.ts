export function countGPTToken(input?: string | null) {
  if (!input) {
    return 0;
  }

  return Math.max(1, Math.ceil(Buffer.byteLength(input, "utf8") / 4));
}
