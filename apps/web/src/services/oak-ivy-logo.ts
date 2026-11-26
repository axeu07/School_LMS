/**
 * The Oak and Ivy tree mark, drawn as SVG so it stays crisp at every size.
 * `tile` adds the rounded app-icon background.
 */
export type TreePalette = {
  tile?: string;
  trunk: string;
  leaf: string;
  leafAlt: string;
  ivy: string;
};

export const oakIvyColours = {
  forest: "#1f3d2e",
  cream: "#f3eee2",
  sage: "#a9c29e",
};

/** Cream tree on forest green: the app icon. */
export const tilePalette: TreePalette = {
  tile: oakIvyColours.forest,
  trunk: oakIvyColours.cream,
  leaf: oakIvyColours.cream,
  leafAlt: oakIvyColours.sage,
  ivy: oakIvyColours.sage,
};

/** Forest tree for light backgrounds. */
export const lightPalette: TreePalette = {
  trunk: "#1f3d2e",
  leaf: "#1f3d2e",
  leafAlt: "#7f9f78",
  ivy: "#5f8259",
};

/** Cream tree with no tile, for the dark sidebar. */
export const darkPalette: TreePalette = {
  trunk: oakIvyColours.cream,
  leaf: oakIvyColours.cream,
  leafAlt: oakIvyColours.sage,
  ivy: oakIvyColours.sage,
};

const rings = [
  {
    r: 27,
    size: [4.1, 7.4],
    angles: [-180, -160, -140, -120, -100, -80, -60, -40, -20, 0],
  },
  { r: 18, size: [3.9, 7], angles: [-170, -145, -118, -90, -62, -35, -10] },
  { r: 9, size: [3.6, 6.4], angles: [-150, -110, -70, -30] },
  { r: 0, size: [3.4, 6], angles: [-90] },
];

export function oakIvySvg(palette: TreePalette) {
  const cx = 50;
  const cy = 39;
  let index = 0;
  const leaves = rings
    .flatMap(({ r, size: [rx, ry], angles }) =>
      angles.map((angle) => {
        const radians = (angle * Math.PI) / 180;
        const x = (cx + r * Math.cos(radians)).toFixed(1);
        const y = (cy + r * 0.95 * Math.sin(radians)).toFixed(1);
        const fill = index++ % 3 === 1 ? palette.leafAlt : palette.leaf;
        return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${angle - 90} ${x} ${y})"/>`;
      }),
    )
    .join("");
  const t = palette.trunk;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    (palette.tile
      ? `<rect width="100" height="100" rx="22" fill="${palette.tile}"/>`
      : "") +
    `<g fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round">` +
    `<path d="M17 84 Q50 75 83 84"/>` +
    `<path d="M47 60 C42 55 36 51 28 47"/><path d="M53 60 C58 55 64 51 72 47"/>` +
    `<path d="M48 56 C45 50 43 45 41 38"/><path d="M52 56 C55 50 57 45 59 38"/>` +
    `<path d="M50 58 L50 36"/></g>` +
    `<path d="M41 82 C45 79 46.5 73 46.6 66 L46.4 56 L53.6 56 L53.4 66 C53.5 73 55 79 59 82 Z" fill="${t}"/>` +
    leaves +
    `<path d="M47 80 C55 76.5 44 72.5 51.5 68.5 C57 65.5 45 63.5 50.5 59.5" fill="none" stroke="${palette.ivy}" stroke-width="2.1" stroke-linecap="round"/>` +
    `<ellipse cx="56" cy="75" rx="2.3" ry="3.5" fill="${palette.ivy}" transform="rotate(52 56 75)"/>` +
    `<ellipse cx="44" cy="69.5" rx="2.3" ry="3.5" fill="${palette.ivy}" transform="rotate(-52 44 69.5)"/>` +
    `<ellipse cx="55.5" cy="63.5" rx="2" ry="3.1" fill="${palette.ivy}" transform="rotate(48 55.5 63.5)"/>` +
    `</svg>`
  );
}

export function svgDataUrl(svg: string) {
  return "data:image/svg+xml;base64," + btoa(svg);
}

/** The default school logo stored in branding (passes the logo rules). */
export const oakIvyLogo = svgDataUrl(oakIvySvg(tilePalette));
