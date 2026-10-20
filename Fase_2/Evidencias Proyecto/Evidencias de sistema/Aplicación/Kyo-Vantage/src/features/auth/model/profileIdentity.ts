/** One display-name rule for account settings and session UI. */
export function visibleName(metadata: Record<string, unknown> | undefined, fallback = 'Usuario'): string {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  return text(metadata?.name) || text(metadata?.full_name) || [text(metadata?.first_name), text(metadata?.last_name)].filter(Boolean).join(' ') || fallback;
}
