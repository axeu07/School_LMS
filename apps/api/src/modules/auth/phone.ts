/**
 * Normalises a phone number to E.164. Ten-digit numbers are treated as Indian
 * mobile numbers (+91), matching how parents type them.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 11 && digits.startsWith("0"))
    return "+91" + digits.slice(1);
  if (digits.length >= 11 && digits.length <= 15) return "+" + digits;
  return null;
}
