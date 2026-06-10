import type { JSX } from 'react';
import type { BackendProjectType } from '../../../../shared/types';

/**
 * Backend/web feature presentation — brand colors + logo marks. Owned by the
 * backend feature layer so the presentational ServiceColumn carries no
 * per-type knowledge.
 */
export const BACKEND_COLORS: Record<BackendProjectType, string> = {
  'dotnet':      '#512bd4',
  'spring-boot': '#6db33f',
  'ktor':        '#e05522',
  'nextjs':      '#e8e8e8',
  'react':       '#20232a',
  'nodejs':      '#215732',
  'express':     '#3d3d3d',
  'nestjs':      '#e0234e',
};

export const BACKEND_FG: Record<BackendProjectType, string> = {
  'dotnet':      '#fff',
  'spring-boot': '#fff',
  'ktor':        '#fff',
  'nextjs':      '#111',
  'react':       '#61dafb',
  'nodejs':      '#6cc24a',
  'express':     '#bbb',
  'nestjs':      '#fff',
};

function BackendTypeIcon({ type, color }: { type: BackendProjectType; color: string }): JSX.Element | null {
  switch (type) {
    case 'react':
      return (
        <g>
          <circle cx="24" cy="24" r="3.5" fill={color} />
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke={color} strokeWidth="1.8" fill="none" />
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke={color} strokeWidth="1.8" fill="none" transform="rotate(60 24 24)" />
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke={color} strokeWidth="1.8" fill="none" transform="rotate(120 24 24)" />
        </g>
      );
    case 'dotnet':
      return (
        <text x="24" y="31" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">.NET</text>
      );
    case 'spring-boot':
      return (
        <g>
          <path
            d="M24 8 C14 12 10 20 10 26 C10 33 16 40 24 40 C32 40 38 33 38 26 C38 20 34 12 24 8Z"
            stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round"
          />
          <path d="M24 8 C28 18 30 30 24 40" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'ktor':
      return (
        <path
          d="M14 12 L14 36 M14 24 L28 12 M14 24 L30 36"
          stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      );
    case 'nextjs':
      return (
        <path
          d="M13 36 L13 12 L35 36 L35 12"
          stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      );
    case 'nodejs':
      return (
        <g>
          <path
            d="M24 8 L38 16 L38 32 L24 40 L10 32 L10 16Z"
            stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"
          />
          <text x="24" y="30" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">N</text>
        </g>
      );
    case 'express':
      return (
        <path
          d="M27 9 L18 27 L25 27 L21 39 L33 21 L26 21 Z"
          fill={color} strokeLinejoin="round"
        />
      );
    case 'nestjs':
      return (
        <path
          d="M13 36 L13 12 L24 30 L35 12 L35 36"
          stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      );
    default:
      return null;
  }
}

export function BackendTypeLogo({ type }: { type: BackendProjectType }): JSX.Element {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none" className="column-type-logo">
      <rect width="48" height="48" rx="10" fill={BACKEND_COLORS[type]} />
      <BackendTypeIcon type={type} color={BACKEND_FG[type]} />
    </svg>
  );
}
