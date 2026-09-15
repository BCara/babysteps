import { MD3DarkTheme } from 'react-native-paper';
import { nursingTokens, type NursingMode, type NursingTokens } from './nursingTheme';

/** Paper and custom care screens share the same resolved appearance. */
export const buildAppTheme = (tokens: NursingTokens) => ({
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: tokens.accent,
    onPrimary: tokens.bgPage,
    primaryContainer: tokens.bgPrimary,
    onPrimaryContainer: tokens.textOnFill,
    secondary: tokens.accent,
    onSecondary: tokens.bgPage,
    secondaryContainer: tokens.bgPillActive,
    onSecondaryContainer: tokens.textOnFill,
    tertiary: tokens.accent,
    onTertiary: tokens.bgPage,
    background: tokens.bgPage,
    onBackground: tokens.textPrimary,
    surface: tokens.bgCard,
    onSurface: tokens.textPrimary,
    surfaceVariant: tokens.bgCardActive,
    onSurfaceVariant: tokens.textSecondary,
    surfaceDisabled: tokens.bgCard,
    onSurfaceDisabled: tokens.textTertiary,
    outline: tokens.borderControl,
    outlineVariant: tokens.borderHairline,
    inverseSurface: tokens.textPrimary,
    inverseOnSurface: tokens.bgPage,
    backdrop: 'rgba(0, 0, 0, 0.62)',
    elevation: {
      level0: 'transparent',
      level1: tokens.bgCard,
      level2: tokens.bgCard,
      level3: tokens.bgCardActive,
      level4: tokens.bgCardActive,
      level5: tokens.bgCardActive,
    },
  },
  fonts: {
    ...MD3DarkTheme.fonts,
    labelLarge: { ...MD3DarkTheme.fonts.labelLarge, fontSize: 16, fontWeight: '700' as const },
  },
  roundness: 12,
});

export const appThemes: Record<NursingMode, ReturnType<typeof buildAppTheme>> = {
  standard: buildAppTheme(nursingTokens.standard),
  night: buildAppTheme(nursingTokens.night),
};
