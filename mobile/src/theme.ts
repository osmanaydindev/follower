import { Platform, ViewStyle } from 'react-native';

export const colors = {
  bg: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFBFD',
  border: '#ECECEF',
  text: '#1A1A1F',
  textMuted: '#8A8A93',
  primary: '#E1306C', // Instagram pink
  primaryDark: '#C1275B',
  secondary: '#833AB4', // Instagram gradient purple
  accent: '#3E5DE7', // blue
  success: '#22B573',
  danger: '#F0453A',
  warning: '#F39C12',
  // tints for soft card backgrounds
  dangerTint: '#FFF0EF',
  accentTint: '#EEF1FE',
  successTint: '#ECFAF3',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

// Soft, consistent elevation for cards.
export const shadow = (level: 1 | 2 = 1): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1A1A2E',
      shadowOpacity: level === 1 ? 0.06 : 0.1,
      shadowRadius: level === 1 ? 10 : 18,
      shadowOffset: { width: 0, height: level === 1 ? 4 : 8 },
    },
    android: { elevation: level === 1 ? 2 : 5 },
    default: {},
  }) as ViewStyle;
