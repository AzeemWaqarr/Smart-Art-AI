import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9H3z',
  pencil: 'M4 20l4-1 11-11-3-3L5 16z M14 7l3 3',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l4.5 4.5L19 7',
  plus: 'M12 5v14M5 12h14',
  reset: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  photo: 'M3 4h18v16H3z M21 17l-5-5-9 8',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7.5 M22 21a7 7 0 0 0-4-6.3',
  lock: 'M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3',
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  money: 'M3 6h18v12H3z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z M20 4h-4a3 3 0 0 0-3 3',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H4a3 3 0 0 0 4 4 M16 6h4a3 3 0 0 1-4 4 M12 13v4 M8 20h8',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-1-3-2 .3-1.4-1.4L17 5l-3-1-1 2h-2L10 4 7 5l.4 2L6 8.3 4 8l-1 3 2 1v2l-2 1 1 3 2-.3 1.4 1.4L7 19l3 1 1-2h2l1 2 3-1-.4-2 1.4-1.4 2 .3 1-3-2-1z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  megaphone: 'M3 11v2l13 5V6z M16 9a3 3 0 0 1 0 6 M6 14l1 5h3l-1-4',
  cpu: 'M7 7h10v10H7z M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z',
  ball: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 4a8 8 0 0 1 0 16 11 11 0 0 0 0-16z',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  wifiOff: 'M3 3l18 18 M8.5 16.5a5 5 0 0 1 7 0 M5 13a10 10 0 0 1 5-2.7 M19 13a10 10 0 0 0-2.6-1.8 M2 9.5a15 15 0 0 1 4.2-2.6 M22 9.5A15 15 0 0 0 11 5 M12 20h.01',
};

const FILLED: Record<string, string> = {
  star: 'M12 2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 16.8 6.1 20l1.3-6.5L2.5 8.9l6.6-.8z',
  flame: 'M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .2 2 1 3 2 3.5C11 8.5 11 5 12 2z',
};

export function Icon({ name, size = 24, stroke = 2.1, color = 'currentColor', className, style, title }: { name: string; size?: number; stroke?: number; color?: string; className?: string; style?: CSSProperties; title?: string }) {
  if (FILLED[name]) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden={!title} role={title ? 'img' : undefined} className={className} style={style}>
        {title && <title>{title}</title>}
        <path d={FILLED[name]} />
      </svg>
    );
  }
  const extra = name === 'camera' ? <circle cx="12" cy="13" r="3.5" /> : name === 'photo' ? <circle cx="9" cy="10" r="2" /> : name === 'palette' ? (
    <>
      <circle cx="7.5" cy="11" r="1.2" />
      <circle cx="10.5" cy="7" r="1.2" />
      <circle cx="15.5" cy="7.5" r="1.2" />
    </>
  ) : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden={!title} role={title ? 'img' : undefined} className={className} style={style}>
      {title && <title>{title}</title>}
      <path d={P[name] || P.sparkle} />
      {extra}
    </svg>
  );
}

export function Logo({ size = 40, light = true }: { size?: number; light?: boolean }) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <div style={{ width: size, height: size, borderRadius: size * 0.3, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="palette" size={size * 0.55} color="#1D2B2E" stroke={2} />
      </div>
      <span className="latin" style={{ fontSize: size * 0.55, fontWeight: 900, color: light ? '#fff' : 'var(--ink)' }}>
        Smart <span style={{ color: light ? 'var(--accent)' : 'var(--primary)' }}>Art</span>
      </span>
    </div>
  );
}
