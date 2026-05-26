/**
 * Gobern.AI Brand Theme
 *
 * Paleta de colores oficial de la marca.
 * Los valores hex se usan en CSS custom properties y componentes inline.
 * Los valores oklch se usan en el sistema de temas de shadcn/ui (globals.css).
 */

export const colors = {
  // Primario — acento principal de la marca
  primary: "#003686" as const,
  primaryLight: "#0046dc" as const,

  // Oscuro de contraste — fondos oscuros, tarjetas métricas
  dark: "#000F17" as const,

  // Derivados para hover, estados, gradientes
  primaryHover: "#0046dc" as const,
  primaryMuted: "#002a6b" as const,
} as const;

export type GobernColor = keyof typeof colors;

/**
 * Gradientes predefinidos.
 * Útiles para mention-chips, tarjetas métricas, resumen ejecutivo.
 */
export const gradients = {
  mentionChip: `linear-gradient(135deg, ${colors.primaryLight}, ${colors.primary})`,
  metricCard: `linear-gradient(135deg, ${colors.primary}, ${colors.dark})`,
} as const;

/**
 * CSS custom properties de la marca.
 * Se inyectan en :root via globals.css, pero se referencian desde TS.
 */
export const cssVars = {
  primaryBorderColor: "--primary-border-color",
} as const;
