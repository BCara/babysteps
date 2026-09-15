const channels = (hex: string) =>
  [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);

const linear = (channel: number) =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG relative luminance. */
export const relativeLuminance = (hex: string) => {
  const [red, green, blue] = channels(hex).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/** WCAG contrast ratio between two opaque colours, from 1 to 21. */
export const contrastRatio = (first: string, second: string) => {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};
