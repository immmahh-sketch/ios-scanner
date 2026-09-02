export const theme = {
  colors: {
    bg: '#0f1115',
    surface: '#1a1d24',
    surfaceAlt: '#232733',
    border: '#2d323f',
    text: '#f5f7fa',
    textDim: '#9aa3b2',
    accent: '#3b82f6',
    accentText: '#ffffff',
    danger: '#ef4444',
    success: '#22c55e',
  },
  radius: 14,
  spacing: (n: number) => n * 8,
} as const;
