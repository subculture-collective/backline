/** Theme-aware chart colors share the CSS tokens used by the dashboard. */
export const chartColors = {
    canvas: 'rgb(var(--bl-canvas))',
    panel: 'rgb(var(--bl-panel))',
    border: 'rgb(var(--bl-border))',
    ink: 'rgb(var(--bl-ink))',
    muted: 'rgb(var(--bl-muted))',
    accent: 'rgb(var(--bl-accent))',
    success: 'rgb(var(--bl-success))',
    warning: 'rgb(var(--bl-warning))',
    danger: 'rgb(var(--bl-danger))',
};

export const chartPalette = [
    chartColors.accent,
    chartColors.success,
    chartColors.warning,
    chartColors.danger,
    chartColors.muted,
    chartColors.border,
];

/** Canvas libraries and image exports need resolved colors rather than CSS variables. */
export function resolveBrandColor(role: keyof typeof chartColors): string {
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--bl-${role}`)
        .trim();
    return value
        ? `rgb(${value})`
        : role === 'canvas' || role === 'panel'
          ? '#f0ede5'
          : '#1c1d1f';
}
