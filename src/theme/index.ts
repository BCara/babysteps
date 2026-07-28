import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#7C6FEA',
    primaryContainer: '#E8E5FA',
    secondary: '#F4A261',
    secondaryContainer: '#FCECDD',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceVariant: '#F3F4F6',
    error: '#E76F51',
  },
  roundness: 12,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#9F95EF',
    primaryContainer: '#2D2764',
    secondary: '#F4A261',
    secondaryContainer: '#6E4522',
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2C2C2C',
    error: '#FF8A80',
  },
  roundness: 12,
};
