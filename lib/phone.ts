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
// for the countries that don't use one.
//
// Only ONE leading zero is stripped, not every leading zero: the trunk
// prefix is always a single digit, and the subscriber number after it can
// itself legitimately start with "0" — Gabon's post-2021 numbering plan is
// exactly this case (an 8-digit subscriber number, some ranges of which
// start with 0), where national "074582442" (trunk 0 + subscriber
// "74582442") is international "+24174582442", but national "004582442"
// (trunk 0 + subscriber "04582442", itself starting with 0) is
// international "+24104582442" — stripping every leading zero would wrongly
// collapse that second case to "+2414582442" (one digit short). This is
// also the field used for WhatsApp alerts, so it must stay a real,
// reachable number.
export function composeInternationalPhone(
  dialCode: string,
  localNumber: string | undefined | null
): string {
  const digitsOnly = normalizePhone(localNumber).replace(/^0/, "");
  return normalizePhone(`${dialCode}${digitsOnly}`);
}

// Whether `value` looks like an email address rather than a phone number —
// used by the "add a teammate" lookup (POST /api/agents) and login
// (POST /api/auth/login), both of which accept either in a single field.
// Deliberately loose (just "has an @ with something on both sides") since
// it only has to distinguish the two input *shapes*, not fully validate an
// email — real validation still happens wherever the value is actually
// used as an email.
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(value.trim());
}

// Gabon's dial code — see lib/countries.ts. The single-field "phone or
// email" lookup below has no country selector, so a bare number (no "+")
// has to be assumed to be in SOME country's national format; Gabon is the
// only sensible default for a tool built for a Libreville-based company.
const DEFAULT_PHONE_DIAL_CODE = "+241";

// Normalizes a phone number typed into a single freeform field (no country
// selector) for lookup/login — see POST /api/agents and
// POST /api/auth/login. Three shapes are accepted:
//   - already international, with a leading "+" (any country): kept as-is
//     (normalized).
//   - the IDD prefix "00" instead of "+" (e.g. "0024174582442"): "00" is
//     replaced with "+", same result as above.
//   - no country marker at all (e.g. "074582442"): assumed to be a Gabon
//     national-format number and composed the same way
//     composeInternationalPhone() does (single leading trunk zero
//     stripped, "+241" prepended) — see that function's own comment for
//     why only one zero is stripped.
// This is intentionally narrower than composeInternationalPhone(): it
// exists for *matching an existing record*, not for composing a phone
// number to store fresh from a country+local-number form (see PhoneField).
export function resolvePhoneQuery(value: string): string {
  const trimmed = normalizePhone(value);
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
  return composeInternationalPhone(DEFAULT_PHONE_DIAL_CODE, trimmed);
}

// Turns whatever was typed into the step-1 search field (see
// resolvePhoneQuery() above) back into the *national-format* digits
// PhoneField's own "local number" input expects, for prefilling step 2 of
// TeamForm.tsx when no account was found. Deliberately NOT just "strip the
// dial code": PhoneField's value round-trips through
// composeInternationalPhone() on submit, which itself strips one leading
// trunk zero — so a query that was already in *international* format
// (dial code included, hence no trunk zero of its own) needs a synthetic
// "0" put back, or composeInternationalPhone would strip a real digit off
// a subscriber number that happens to start with 0 (see that function's
// own comment for why that specific case matters for Gabon). A query
// that had NO dial code is assumed to already be exactly what a person
// would type into that field (trunk zero included, or not, as typed) and
// is passed through untouched.
export function toLocalNumberForPhoneField(query: string): string {
  const trimmed = normalizePhone(query);
  const withoutIdd = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
  const dialDigits = DEFAULT_PHONE_DIAL_CODE.slice(1); // "241"
  if (withoutIdd.startsWith(`+${dialDigits}`)) {
    return `0${withoutIdd.slice(1 + dialDigits.length)}`;
  }
  if (withoutIdd.startsWith("+")) {
    // A different country's international number pasted into the search
    // field — nothing sensible to prefill (the form's country selector
    // defaults to Gabon), leave it empty rather than guessing wrong.
    return "";
  }
  return trimmed;
}

// wa.me wants a plain international number with no "+", spaces or
// punctuation — e.g. "+24174582442" -> "24174582442". Used to build the
// WhatsApp invite link in POST /api/agents/invite.
export function toWhatsAppNumber(phone: string): string {
  return normalizePhone(phone).replace(/^\+/, "");
}
