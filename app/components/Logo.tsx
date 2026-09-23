// Small text + icon logo, no external dependency (inline SVG).
// Same principle as the houses project: reusable on a light background
// (public pages) or a dark one (`light` variant, e.g. sidebar).
import { APP_NAME } from "@/lib/constants";

export default function Logo({
  size = "normal",
  light = false,
  companyName,
}: {
  size?: "normal" | "large";
  light?: boolean;
  // When set (dashboard sidebar/mobile bar, where a company is always in
  // context), the company's name takes the primary spot and APP_NAME
  // becomes a small subtitle underneath, instead of the plain wordmark.
  companyName?: string;
}) {
  const isLarge = size === "large";
  const textColor = light ? "#ffffff" : "var(--color-primary)";
  const accentColor = "var(--color-accent)";
  const checkColor = light ? "#ffffff" : "var(--color-primary)";
  const subtitleColor = light ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-muted)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: isLarge ? 12 : 9,
        minWidth: 0,
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
      {companyName ? (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 700,
              fontSize: isLarge ? 20 : 15,
              color: textColor,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {companyName}
          </span>
          <span
            style={{
              fontSize: isLarge ? 11 : 9.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: subtitleColor,
            }}
          >
            {APP_NAME}
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
