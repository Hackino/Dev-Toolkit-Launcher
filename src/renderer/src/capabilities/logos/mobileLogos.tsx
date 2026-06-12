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
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.523 15.341c0 .472-.383.856-.856.856H7.333a.856.856 0 0 1-.856-.856V9.008h11.046v6.333Z" fill="#3DDC84"/>
      <path d="M6.477 9.008c0-.472.384-.856.856-.856h9.334c.473 0 .856.384.856.856v.5H6.477v-.5Z" fill="#3DDC84"/>
      <path d="M8.5 7.5 6.8 5.8M15.5 7.5l1.7-1.7" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9.5" cy="11" r="1" fill="#fff"/>
      <circle cx="14.5" cy="11" r="1" fill="#fff"/>
      <path d="M8.5 16.2v2.4a.9.9 0 0 0 1.8 0V16.2M13.7 16.2v2.4a.9.9 0 0 0 1.8 0V16.2" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M4.5 10.2v4.6a.9.9 0 0 0 1.8 0V10.2M17.7 10.2v4.6a.9.9 0 0 0 1.8 0V10.2" stroke="#3DDC84" strokeWidth="1.5" strokeLinecap="round"/>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.06 2 3 13.06l3.54 3.54L21.59 2H14.06Z" fill="#54C5F8"/>
      <path d="m6.54 16.6 4.24-4.23 4.24 4.23-4.24 4.24-4.24-4.24Z" fill="#01579B"/>
      <path d="m10.78 12.37 4.24 4.23-2.12 2.12-4.24-4.23 2.12-2.12Z" fill="#29B6F6"/>
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
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2Z" fill="none" stroke="#7F52FF" strokeWidth="1.5"/>
      <path d="M12 2v20M2 7l10 5M22 7l-10 5" stroke="#7F52FF" strokeWidth="1.2" strokeOpacity="0.7"/>
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
