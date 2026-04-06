import type { CSSProperties } from 'react';

/** Brand red for lowercase "v" — matches vThink wordmark */
export const VTHINK_V_RED = '#EF4444';

/** Dark wordmark color on light surfaces */
export const VTHINK_THINK_DARK = '#1E293B';

const ff = "'Inter', system-ui, sans-serif";
const fw = 600 as const;

export function VthinkRedV({ fontSize, style }: { fontSize: number; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontSize,
        fontWeight: fw,
        color: VTHINK_V_RED,
        fontFamily: ff,
        lineHeight: 1,
        letterSpacing: '-0.08em',
        marginRight: '-0.06em',
        ...style,
      }}
    >
      v
    </span>
  );
}

/** "Think" + ® — single word for correct kerning (matches login wordmark) */
export function VthinkThinkReg({
  fontSize,
  thinkColor,
}: {
  fontSize: number;
  thinkColor: string;
}) {
  const regPx = Math.max(8, Math.round(fontSize * 0.44));
  const regLift = Math.round(fontSize * 0.4);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: ff,
        fontWeight: fw,
        lineHeight: 1,
        letterSpacing: '-0.03em',
      }}
    >
      <span
        style={{
          fontSize,
          color: thinkColor,
          fontWeight: fw,
          marginLeft: '-0.04em',
        }}
      >
        Think
      </span>
      <sup
        style={{
          fontSize: regPx,
          color: thinkColor,
          fontWeight: fw,
          marginLeft: Math.max(1, Math.round(fontSize * 0.06)),
          padding: 0,
          lineHeight: 0,
          position: 'relative',
          top: -regLift,
          verticalAlign: 'baseline',
        }}
      >
        ®
      </sup>
    </span>
  );
}

/** Full inline wordmark: vThink® */
export function VthinkWordmark({ fontSize, thinkColor }: { fontSize: number; thinkColor: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
      <VthinkRedV fontSize={fontSize} />
      <VthinkThinkReg fontSize={fontSize} thinkColor={thinkColor} />
    </span>
  );
}

/**
 * In-app header lockup (main content): vThink® + Timesheet — use on Dashboard, Overview, etc.
 */
export function VthinkAppHeaderBrand({
  thinkColor = 'var(--text-1)',
  wordmarkSize = 20,
  timesheetSize = 17,
}: {
  thinkColor?: string;
  wordmarkSize?: number;
  timesheetSize?: number;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      <VthinkWordmark fontSize={wordmarkSize} thinkColor={thinkColor} />
      <span
        style={{
          fontSize: timesheetSize,
          fontWeight: 600,
          color: thinkColor,
          letterSpacing: '-0.02em',
          fontFamily: ff,
          marginLeft: 2,
        }}
      >
        Timesheet
      </span>
    </div>
  );
}

/** White pill on dark purple marketing panel (login / force password) */
export function VthinkWordmarkPill({ fontSize = 24 }: { fontSize?: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 18px',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
      }}
    >
      <VthinkWordmark fontSize={fontSize} thinkColor={VTHINK_THINK_DARK} />
    </div>
  );
}
