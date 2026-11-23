import Link from "next/link";

export const productName = "ACADMAXIS";

/** The "AX" monogram as an SVG data URL, for places that take an image logo. */
export const productLogo =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#6558ee"/><stop offset="1" stop-color="#4030b4"/>' +
      "</linearGradient></defs>" +
      '<rect width="64" height="64" rx="18" fill="url(#g)"/>' +
      '<text x="32" y="42" text-anchor="middle" font-family="Inter,Arial,sans-serif" ' +
      'font-size="28" font-weight="800" letter-spacing="-1" fill="#fff">AX</text>' +
      "</svg>",
  );

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={productName + " home"}>
      <span className="brand-mark" aria-hidden="true">
        AX
      </span>
      <span>
        ACADM<span className="brand-accent">AXIS</span>
      </span>
    </Link>
  );
}
