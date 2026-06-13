import { useId } from 'react';
import type { MobilePlatform } from '../../../../shared/types';

/** Official-style multicolor Firebase flame mark. */
export function FirebaseLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Firebase">
      {/* base fold (medium amber) */}
      <path d="M20.684 19.365l-2.25-14a.542.542 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0z" fill="#FFA000" />
      {/* tall left facet (light) */}
      <path d="M3.89 15.673L6.255.461A.542.542 0 017.27.288l2.543 4.771z" fill="#FFCA28" />
      {/* middle crease (dark orange) */}
      <path d="M14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z" fill="#F57C00" />
    </svg>
  );
}

export function AndroidLogo({ size = 24 }: { size?: number }) {
  const green = '#A4C639';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Android">
      {/* antennae */}
      <path d="M8.2 4 6.7 1.8M15.8 4l1.5-2.2" stroke={green} strokeWidth="1.1" strokeLinecap="round"/>
      {/* head dome (flat bottom) */}
      <path d="M4.6 9.6a7.4 7.4 0 0 1 14.8 0Z" fill={green}/>
      {/* eyes */}
      <circle cx="9.3" cy="6.8" r=".85" fill="#fff"/>
      <circle cx="14.7" cy="6.8" r=".85" fill="#fff"/>
      {/* torso */}
      <rect x="4.6" y="10.3" width="14.8" height="9.4" rx="1.8" fill={green}/>
      {/* arms */}
      <rect x="1.9" y="10.7" width="2.3" height="6.7" rx="1.15" fill={green}/>
      <rect x="19.8" y="10.7" width="2.3" height="6.7" rx="1.15" fill={green}/>
      {/* legs */}
      <rect x="7.9" y="18.7" width="2.4" height="4.5" rx="1.2" fill={green}/>
      <rect x="13.7" y="18.7" width="2.4" height="4.5" rx="1.2" fill={green}/>
    </svg>
  );
}

export function IosLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.37 2.83Z" fill="#999"/>
      <path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z" fill="#999"/>
    </svg>
  );
}

export function FlutterLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Flutter">
      {/* upper blade */}
      <path d="M15.4 1.6 3.9 13.1l3.5 3.5L22.4 1.6h-7Z" fill="#47C5FB"/>
      {/* lower blade */}
      <path d="M15.4 12 9.1 18.3l3.5 3.5 3.3-3.3 3-3-3.5-3.5Z" fill="#47C5FB"/>
      {/* dark fold */}
      <path d="m12.6 21.8 3.3-3.3 4.5 4.5h-7l-.8-1.2Z" fill="#00569E"/>
      {/* mid teal */}
      <path d="m9.1 18.3 3.5-3.5 3.3 3.3-3.3 3.3-3.5-3.1Z" fill="#00B5F8"/>
    </svg>
  );
}

export function ReactNativeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="2.05" ry="2.05" fill="#61DAFB"/>
      <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="#61DAFB" strokeWidth="1.2"/>
      <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="#61DAFB" strokeWidth="1.2" transform="rotate(60 12 12)"/>
      <ellipse cx="12" cy="12" rx="10" ry="3.8" stroke="#61DAFB" strokeWidth="1.2" transform="rotate(120 12 12)"/>
    </svg>
  );
}

export function KmpLogo({ size = 24 }: { size?: number }) {
  // Kotlin Multiplatform mark — the Kotlin gradient silhouette.
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Compose Multiplatform">
      <defs>
        <linearGradient id={gradId} x1="21" y1="3" x2="4" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E44857"/>
          <stop offset="0.47" stopColor="#C711E1"/>
          <stop offset="1" stopColor="#7F52FF"/>
        </linearGradient>
      </defs>
      <path d="M21 21 12 12l9-9H3v18h18Z" fill={`url(#${gradId})`}/>
    </svg>
  );
}

const LOGOS: Record<MobilePlatform, (props: { size?: number }) => JSX.Element> = {
  android: AndroidLogo,
  ios: IosLogo,
  flutter: FlutterLogo,
  'react-native': ReactNativeLogo,
  'compose-multiplatform': KmpLogo,
};

export function PlatformLogo({ platform, size }: { platform: MobilePlatform; size?: number }) {
  const Logo = LOGOS[platform];
  return <Logo size={size} />;
}
