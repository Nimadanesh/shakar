/**
 * Shekar logo mark — inline vector S ribbon. Uses currentColor so the mark
 * adapts to the theme automatically (white on dark, black on light).
 * Source: shakar-logo-mark.svg (Navid, 2026-10-05).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="135 135 233 233"
      fill="none"
      role="img"
      aria-label="لوگوی شکار"
      className={className}
    >
      <path
        fill="currentColor"
        d="M182.7 151.7
           C191.7 146.1 202.4 143.1 213.2 143.1
           H330.1
           C337.5 143.1 344.1 147.2 347.5 153.8
           C351.0 160.4 350.1 168.2 345.2 173.8
           L298.4 227.0
           C294.7 231.2 289.3 233.6 283.7 233.6
           H180.0
           C168.0 233.6 158.1 226.6 154.4 215.2
           C150.7 203.8 154.6 191.4 164.2 184.2
           L182.7 170.3
           C178.8 164.0 179.0 157.4 182.7 151.7Z"
      />
      <path
        fill="currentColor"
        d="M329.3 284.9
           C340.0 291.8 345.7 302.5 344.3 313.7
           C343.6 319.4 340.9 324.7 336.7 328.8
           L316.2 348.7
           C308.8 355.8 298.8 359.8 288.5 359.8
           H180.0
           C172.2 359.8 165.1 355.2 161.7 348.2
           C158.3 341.2 159.5 332.9 164.8 327.2
           L214.2 274.3
           C217.9 270.4 223.1 268.2 228.5 268.2
           H309.7
           C316.8 268.2 323.6 271.2 329.3 276.2
           L329.3 284.9Z"
      />
    </svg>
  );
}
