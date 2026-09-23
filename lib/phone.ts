// Normalizes a phone number before storage/comparison: strips spaces,
// dots, dashes and parentheses (the formats people actually type), but
// keeps the digits and a leading "+" (international prefix). Used both
// when creating an account and at login, so "06 01 02 03 04" and
// "0601020304" are recognized as the same number.
export function normalizePhone(value: string | undefined | null): string {
  if (!value) return "";
  return value.trim().replace(/[\s.\-()]/g, "");
}

// Combines a country's dial code with a number typed locally (national
// format) into one normalized international number, e.g.
// composeInternationalPhone("+225", "01 02 03 04 05") -> "+22501020304050".
// Most countries whose domestic numbers start with a "0" trunk prefix drop
// it once the dial code is prepended (e.g. France: "06 01 02 03 04" ->
// "+33601020304") — we strip a leading 0 generically, which is harmless
// for the countries that don't use one. This is also the field used for
// WhatsApp alerts, so it must stay a real, reachable number.
export function composeInternationalPhone(
  dialCode: string,
  localNumber: string | undefined | null
): string {
  const digitsOnly = normalizePhone(localNumber).replace(/^0+/, "");
  return normalizePhone(`${dialCode}${digitsOnly}`);
}
