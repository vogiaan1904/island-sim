import type { ReactNode } from 'react';

/**
 * The UI icon set: the one place every line icon lives (island-ui, references/icons.md). To add an icon, add a key to
 * `LINE_ICONS` below with the shapes of a 24 x 24 icon (copy the inner elements of a Lucide SVG) and use
 * `<Icon name="..." />`; never paste an ad hoc SVG into a screen. Buildings, goods and key staff are rendered pictures
 * from `/icons/*.png`, not part of this set.
 *
 * License: the line icons are Lucide shapes (https://lucide.dev, ISC license, partly Feather, MIT), copied as path
 * data from the approved mockup's icon sheet; the text is in `apps/client/src/ui/icons.LICENSE.md`, and
 * `assets/SOURCES.md` lists them. The coin is our own filled illustration.
 *
 * Icons are decorative: they are hidden from screen readers, and the button or text beside them carries the name.
 */
const LINE_ICONS = {
  hammer: (
    <>
      <path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9" />
      <path d="M17.64 15 22 10.64" />
      <path d="m20.91 11.7-1.25-1.25a3.2 3.2 0 0 1-.93-2.25v-.86L16 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h2.47l2.26 1.91" />
    </>
  ),
  staff: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v2M16 2v2" />
      <circle cx="12" cy="11" r="3" />
      <path d="M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
    </>
  ),
  anchor: (
    <>
      <path d="M12 22V8" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      <circle cx="12" cy="5" r="3" />
    </>
  ),
  layers: (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>
  ),
  book: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  userx: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 8 5 5M22 8l-5 5" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  sack: (
    <>
      <path d="M9 3h6l-1.6 3.2C17 7.8 20 11 20 15a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6c0-4 3-7.2 6.6-8.8z" />
      <path d="M9.5 6.5h5" />
    </>
  ),
  bread: (
    <>
      <path d="M4 11a8 5 0 0 1 16 0 2 2 0 0 1-1 1.7V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6.3A2 2 0 0 1 4 11z" />
      <path d="M9 10l1.5 2M13 9.5l1.5 2" />
    </>
  ),
  wheat: (
    <>
      <path d="M2 22 16 8" />
      <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
      <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
      <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
      <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
    </>
  ),
  tree: (
    <>
      <path d="M12 22v-5" />
      <path d="M12 2.5a5.5 5.5 0 0 1 5.3 7A4.5 4.5 0 0 1 16 18H8a4.5 4.5 0 0 1-1.3-8.5A5.5 5.5 0 0 1 12 2.5z" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  up: (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  down: (
    <>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  /** Turn a ghost a quarter (Lucide rotate-cw). */
  rotate: (
    <>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  /** Take back what was drawn so far (Lucide undo-2). */
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </>
  ),
  plus: <path d="M5 12h14M12 5v14" />,
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14v-5l-2-5H7l-2 5z" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  fish: (
    <>
      <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" />
      <path d="M18 12v.5" />
      <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" />
    </>
  ),
  store: (
    <>
      <path d="M2 9 4.5 4h15L22 9z" />
      <path d="M4 9v11h16V9" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  eraser: (
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  palm: (
    <>
      <path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4" />
      <path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3" />
      <path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35" />
      <path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  /** The gear on the HUD: it opens Settings. */
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  /** Water: the island's water need. */
  droplet: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
} satisfies Record<string, ReactNode>;

/** Filled illustrations with their own colors (not drawn in the text color). */
const FILLED_ICONS = {
  coin: (
    <>
      <circle cx="12" cy="12" r="10" fill="#f6c445" stroke="#b9821a" strokeWidth="2" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#e0a526" strokeWidth="1.6" />
      <path d="M9 8.5q2-2 3 0" stroke="#fff3c4" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof LINE_ICONS | keyof typeof FILLED_ICONS;

export const ICON_NAMES = [...Object.keys(LINE_ICONS), ...Object.keys(FILLED_ICONS)] as IconName[];

export interface IconProps {
  name: IconName;
  /** CSS px, default 24. */
  size?: number;
  /** Line icons only: 2 by default, about 2.4 to 3 for small bold glyphs such as a close X. */
  strokeWidth?: number;
}

/** One icon, decorative: the control or text next to it carries the accessible name. */
export function Icon({ name, size = 24, strokeWidth = 2 }: IconProps) {
  const common = { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, focusable: false } as const;
  if (name in FILLED_ICONS) return <svg {...common}>{FILLED_ICONS[name as keyof typeof FILLED_ICONS]}</svg>;
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {LINE_ICONS[name as keyof typeof LINE_ICONS]}
    </svg>
  );
}
