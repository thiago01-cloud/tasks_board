// Small text + icon logo, no external dependency (inline SVG).
// Same principle as the houses project: reusable on a light background
// (public pages) or a dark one (`light` variant, e.g. sidebar).
import { APP_NAME } from "@/lib/constants";

export default function Logo({
  size = "normal",
  light = false,
}: {
  size?: "normal" | "large";
  light?: boolean;
}) {
  const isLarge = size === "large";
  const textColor = light ? "#ffffff" : "var(--color-primary)";
  const accentColor = "var(--color-accent)";
  const checkColor = light ? "#ffffff" : "var(--color-primary)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: isLarge ? 12 : 9,
      }}
    >
      <svg
        width={isLarge ? 34 : 26}
        height={isLarge ? 34 : 26}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="24" height="24" rx="7" fill={accentColor} />
        <path
          d="M10 16.5L14 20.5L22 11.5"
          stroke={checkColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={light ? 0.9 : 1}
        />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 700,
          fontSize: isLarge ? 26 : 20,
          letterSpacing: "0.01em",
          color: textColor,
          lineHeight: 1,
        }}
      >
        {APP_NAME}
      </span>
    </div>
  );
}
