"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES } from "@/lib/countries";

// Country + phone number pair, shared by every form that creates or looks
// up a User (signup, login, adding a team member): picking a country both
// records it and tells the person which dial code their number will be
// prefixed with (composeInternationalPhone() in lib/phone.ts does the
// actual composition, usually server-side — see each form for details).
//
// The country picker is a small custom dropdown rather than a native
// <select>: once a country is chosen we only want to display its dial
// code (e.g. "+225"), but a native <select> always shows the same text
// for the selected value as for the option in the open list — it can't
// show the full "Country (+code)" while open and just "+code" once
// closed. See .custom-select* in globals.css for the styling.
export default function PhoneField({
  country,
  onCountryChange,
  phone,
  onPhoneChange,
  required = true,
  label = "Téléphone",
}: {
  country: string;
  onCountryChange: (code: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  required?: boolean;
  // e.g. "Numéro WhatsApp" in TeamForm.tsx's invite step, where the number
  // doubles as the wa.me contact used for the WhatsApp invite option.
  label?: string;
}) {
  const selected = COUNTRIES.find((c) => c.code === country);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    // The dropdown panel is anchored to this whole row (not to the narrow
    // trigger) so its width always matches the row's own — already safe on
    // any screen size — instead of risking an overflow past the right edge
    // on very narrow phones.
    <div className="phone-field" ref={containerRef}>
      <div className="field-grid field-grid-narrow-first">
        <div className="field">
          <label htmlFor="country-trigger">Pays</label>
          <button
            type="button"
            id="country-trigger"
            className="custom-select-trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {selected ? (
              selected.dialCode
            ) : (
              <span className="custom-select-placeholder">Pays</span>
            )}
          </button>
        </div>

        <div className="field">
          <label htmlFor="phone">
            {label}
            {selected ? ` (${selected.dialCode})` : ""}
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="ex. 07 01 02 03 04"
            required={required}
          />
        </div>
      </div>

      {open && (
        <ul className="custom-select-panel" role="listbox">
          {COUNTRIES.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="custom-select-option"
                role="option"
                aria-selected={c.code === country}
                onClick={() => {
                  onCountryChange(c.code);
                  setOpen(false);
                }}
              >
                {c.name} ({c.dialCode})
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
