import type { Lesson } from '../types';
import { Icon } from './Icon';

const CAT: Record<Lesson['category'], { bg: string; fg: string; label: string }> = {
  light: { bg: '#FDF3DD', fg: '#C98A12', label: 'Light and shadow' },
  colour: { bg: '#FCE4E0', fg: '#C0473A', label: 'Colour' },
  proportion: { bg: '#E7F0F7', fg: '#185C66', label: 'Proportion' },
  composition: { bg: '#F1ECFA', fg: '#6B4BB0', label: 'Composition' },
  perspective: { bg: '#E3F1DA', fg: '#2F6A1E', label: 'Perspective' },
  shapes: { bg: '#FFF1E0', fg: '#B5651D', label: 'Shapes' },
};

export const categoryLabel = (c: Lesson['category']) => CAT[c]?.label || c;

/** Small illustration tile for a lesson, drawn per category. */
export function LessonArt({ category, size = 64 }: { category: Lesson['category']; size?: number }) {
  const c = CAT[category] || CAT.light;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0, borderRadius: 14 }}>
      <rect width="64" height="64" fill={c.bg} />
      {category === 'light' && (
        <>
          <circle cx="30" cy="30" r="16" fill="#F4B942" />
          <path d="M30 14a16 16 0 0 1 0 32 22 22 0 0 0 0-32z" fill="#C98A12" />
          <ellipse cx="36" cy="50" rx="16" ry="4" fill="#1D2B2E" opacity="0.2" />
        </>
      )}
      {category === 'colour' && (
        <>
          <rect x="8" y="14" width="22" height="36" rx="4" fill="#F7B267" />
          <rect x="34" y="14" width="22" height="36" rx="4" fill="#6FA8DC" />
          <circle cx="19" cy="24" r="5" fill="#E86A5A" />
          <circle cx="45" cy="24" r="5" fill="#8C6BC8" />
        </>
      )}
      {category === 'proportion' && (
        <>
          <ellipse cx="32" cy="32" rx="16" ry="21" fill="#fff" stroke="#185C66" strokeWidth="2.5" />
          <path d="M16 32h32M32 11v42" stroke="#9CC3C9" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="25" cy="32" r="2.5" fill="#1D2B2E" />
          <circle cx="39" cy="32" r="2.5" fill="#1D2B2E" />
          <path d="M27 44h10" stroke="#C0473A" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {category === 'composition' && (
        <>
          <path d="M21 6v52M43 6v52M6 21h52M6 43h52" stroke="#DCD0F2" strokeWidth="2" />
          <path d="M6 43 C20 38 40 46 58 40 V58 H6Z" fill="#7BB662" />
          <circle cx="43" cy="21" r="7" fill="#F4B942" />
          <rect x="16" y="32" width="10" height="14" fill="#E86A5A" />
        </>
      )}
      {category === 'perspective' && (
        <>
          <path d="M4 26h56" stroke="#2F6A1E" strokeWidth="1.5" />
          <path d="M8 60 L32 26 L56 60Z" fill="#9AA5A8" />
          <path d="M32 30v4M32 40v6M32 52v8" stroke="#fff" strokeWidth="2.5" />
          <circle cx="12" cy="40" r="6" fill="#4E9A4A" />
          <circle cx="50" cy="38" r="4" fill="#4E9A4A" />
        </>
      )}
      {category === 'shapes' && (
        <>
          <ellipse cx="34" cy="40" rx="16" ry="12" fill="#8C6BC8" />
          <circle cx="22" cy="26" r="10" fill="#8C6BC8" />
          <path d="M14 20 L15 10 L22 17Z M30 20 L29 10 L22 17Z" fill="#8C6BC8" />
          <circle cx="19" cy="25" r="1.6" fill="#1D2B2E" />
          <circle cx="25" cy="25" r="1.6" fill="#1D2B2E" />
        </>
      )}
    </svg>
  );
}

export function BadgeMedal({ icon, color, earned, size = 48 }: { icon: string; color: string; earned: boolean; size?: number }) {
  return (
    <span className="medal" style={{ width: size, height: size, background: earned ? color : 'var(--line-2)', color: earned ? '#fff' : 'var(--soft)' }}>
      <Icon name={icon === 'flame' ? 'flame' : icon === 'ball' ? 'ball' : icon} size={size * 0.5} color="currentColor" />
    </span>
  );
}
