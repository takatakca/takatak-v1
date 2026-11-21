// TAKATAK visual system for the native app (BRAND.md): deep navy ground, midnight panels, electric-blue light,
// cyan highlights, silver secondary text. Green, red and amber only for status. Montserrat for titles, Inter for text.
import { Platform } from 'react-native';

export const colors = {
  ink: '#F5F8FC',
  ink2: '#D6DEE9',
  muted: '#B8C4D3',
  faint: '#7F8DA3',
  canvas: '#060D1F',
  surface: '#0B1B3D',
  raised: '#10244D',
  sunken: '#0A1631',
  navy: '#060D1F',
  navy2: '#0B1B3D',
  navy3: '#1F8BFF',
  line: 'rgba(184,196,211,0.13)',
  lineStrong: 'rgba(184,196,211,0.26)',
  primary: '#1F8BFF',
  primaryDark: '#1565D8',
  primarySoft: 'rgba(31,139,255,0.15)',
  accent: '#29C3FF',
  accentInk: '#29C3FF',
  accentSoft: 'rgba(41,195,255,0.08)',
  accentLine: 'rgba(41,195,255,0.28)',
  green: '#3DDC97',
  greenPale: 'rgba(61,220,151,0.13)',
  amber: '#FFC857',
  amberBg: 'rgba(255,200,87,0.13)',
  red: '#FF6B7A',
  redBg: 'rgba(255,107,122,0.13)',
  white: '#FFFFFF',
};

export const fonts = {
  display: 'Montserrat_700Bold',
  displayBold: 'Montserrat_800ExtraBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const radius = { sm: 6, md: 12, lg: 18, xl: 24, pill: 999 };
export const space = (n: number) => n * 4;

export const shadow = Platform.select({
  ios: { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  default: { elevation: 3 },
});

/** Soft electric-blue glow for the hero elements (iOS shadow; Android keeps the elevation). */
export const glow = Platform.select({
  ios: { shadowColor: '#1F8BFF', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  default: { elevation: 6 },
});

export const type = {
  display: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.semibold, fontSize: 16.5, lineHeight: 22, color: colors.ink, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.display, fontSize: 10.5, lineHeight: 14, color: colors.accent, letterSpacing: 2.2, textTransform: 'uppercase' as const },
};
