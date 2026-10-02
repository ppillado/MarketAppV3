/** 1990 -> "1.990" (Chilean thousands separator). Accepts a number or a digit string. */
export function formatPrice(value: number | string) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "hace 10 min", "hace 3 h", "hace 2 d". */
export function formatTimeAgo(date: Date, now: number) {
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** 350 -> "a 350 m", 1234 -> "a 1.2 km". */
export function formatDistance(meters: number) {
  if (meters < 1000) return `a ${Math.round(meters / 10) * 10} m`;
  return `a ${(meters / 1000).toFixed(1)} km`;
}
