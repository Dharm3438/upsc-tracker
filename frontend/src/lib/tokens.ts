// Palette values that components need as *strings* rather than as Tailwind
// classes — chart strokes, inline fills — plus the one shared scale that was
// previously copy-pasted into four different files.

/** Confidence 1-5 as depth of fill. Pale is weak, saturated is strong. */
export const DEPTH_BG: Record<number, string> = {
  0: 'bg-hairline',
  1: 'bg-depth-1',
  2: 'bg-depth-2',
  3: 'bg-depth-3',
  4: 'bg-depth-4',
  5: 'bg-depth-5',
}

/** Text that stays legible on top of each step of the ramp. */
export const DEPTH_TEXT: Record<number, string> = {
  0: 'text-muted',
  1: 'text-ink',
  2: 'text-ink',
  3: 'text-ink',
  4: 'text-surface',
  5: 'text-surface',
}

export const DEPTH_HEX: Record<number, string> = {
  0: '#E8DFD1',
  1: '#EAE3D5',
  2: '#CBD5C4',
  3: '#9DB7A8',
  4: '#63897B',
  5: '#2E5A50',
}

export const COLOR = {
  canvas: '#FBF7F0',
  surface: '#FFFDF9',
  hairline: '#E8DFD1',
  edge: '#D6C9B5',
  navy: '#16233A',
  ink: '#1C2434',
  muted: '#5A6373',
  faint: '#8C8478',
  accent: '#B45309',
  accentSoft: '#FDF2E0',
  danger: '#A82F2A',
  success: '#2E5A50',
} as const

/** Past this many days late, a row earns the alert tone. Was duplicated in
 *  review/DueList.tsx, tree/NodeRow.tsx and progress/Heatmap.tsx. */
export const ATTENTION_DAYS = 14
