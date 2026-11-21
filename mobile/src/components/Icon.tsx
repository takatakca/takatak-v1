// Line icons drawn for the app (1.7 stroke, round caps).
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

const P = {
  home: <Path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />,
  folder: <Path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />,
  calendar: <><Rect x="3.5" y="5" width="17" height="15.5" rx="2" /><Path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  file: <><Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><Path d="M14 3v5h5" /></>,
  image: <><Rect x="3" y="4" width="18" height="16" rx="2" /><Circle cx="9" cy="10" r="2" /><Path d="m21 16-5-5-9 9" /></>,
  camera: <><Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><Circle cx="12" cy="13.5" r="3.5" /></>,
  message: <Path d="M4 5h16v11H9l-5 4z" />,
  send: <Path d="M4 12 20 4l-6 16-3-7z" />,
  chevron: <Path d="m9 5 7 7-7 7" />,
  back: <Path d="m15 5-7 7 7 7" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7" />,
  clock: <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.5V12l3 2" /></>,
  shield: <Path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" />,
  lock: <><Rect x="5" y="10.5" width="14" height="10" rx="2" /><Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  scale: <Path d="M12 4v16M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0zM12 4l-1-1h2z" />,
  search: <><Circle cx="11" cy="11" r="6.5" /><Path d="m16 16 4.5 4.5" /></>,
  download: <Path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />,
  upload: <Path d="M12 16V5m-4.5 4.5L12 5l4.5 4.5M5 19.5h14" />,
  logout: <Path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  bell: <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  star: <Path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />,
  link: <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  video: <><Rect x="3" y="6" width="13" height="12" rx="2" /><Path d="m16 10.5 5-3v9l-5-3z" /></>,
  phone: <Path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z" />,
  info: <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 11v5.5M12 7.8v.2" /></>,
  sparkle: <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  briefcase: <><Rect x="3" y="7" width="18" height="13" rx="2" /><Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18" /></>,
  inbox: <Path d="M3 13.5 5.5 5h13l2.5 8.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13.5h5l1.5 2.5h5l1.5-2.5h5" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  fingerprint: <Path d="M12 11v3a8 8 0 0 1-2 5M8.5 8.5A5 5 0 0 1 17 12v2M6.5 13a5.5 5.5 0 0 1 0-1 5.5 5.5 0 0 1 1-3M16 17.5a12 12 0 0 1-.8 2.5M12 7a5 5 0 0 0-5 5" />,
  globe: <><Circle cx="12" cy="12" r="8.5" /><Path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z" /></>,
  trash: <Path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
  chart: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  grid: <><Rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><Rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><Rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><Rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  arrow: <Path d="M5 12h14m-5-5 5 5-5 5" />,
  up: <Path d="m6 14 6-6 6 6" />,
  down: <Path d="m6 10 6 6 6-6" />,
  megaphone: <Path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6" />,
  server: <><Rect x="3.5" y="4" width="17" height="7" rx="1.5" /><Rect x="3.5" y="13" width="17" height="7" rx="1.5" /><Path d="M7 7.5h.01M7 16.5h.01" /></>,
  receipt: <Path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />,
  users: <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.5 5" /></>,
  food: <Path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 2 2M9 3v5a2 2 0 0 1-2 2M17 21V3c-2 1.5-3 4-3 7v4h3" />,
  support: <><Circle cx="12" cy="12" r="8.5" /><Circle cx="12" cy="12" r="3.5" /><Path d="m6 6 3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18" /></>,
  swap: <Path d="M7 7h12l-3-3M17 17H5l3 3" />,
  pin: <><Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><Circle cx="12" cy="10" r="2.5" /></>,
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.7 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </Svg>
  );
}
