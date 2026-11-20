// Words and numbers shown on screen and spoken aloud. Clock times follow the phone's own clock.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A clock time in two parts, so "AM" can be drawn smaller: { time: '5:13', suffix: 'AM' }. */
export function clockParts(at: number, hour24: boolean): { time: string; suffix: string } {
  const d = new Date(at);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (hour24) return { time: `${String(hours).padStart(2, '0')}:${minutes}`, suffix: '' };
  return { time: `${hours % 12 || 12}:${minutes}`, suffix: hours < 12 ? 'AM' : 'PM' };
}

/** "5:13 AM" or "05:13". */
export function clock(at: number, hour24: boolean): string {
  const { time, suffix } = clockParts(at, hour24);
  return suffix ? `${time} ${suffix}` : time;
}

/** "Tuesday, 10 November". */
export function longDate(at: number): string {
  const d = new Date(at);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The time left until a moment, in whole hours and minutes (rounded up, never negative). */
export function timeLeft(from: number, to: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.ceil((to - from) / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

/** "1 minute", "20 minutes". */
export function minutesWords(count: number): string {
  return count === 1 ? '1 minute' : `${count} minutes`;
}

/** "+1 day", "-2 days", "0 days". */
export function signedDays(count: number): string {
  return `${count > 0 ? '+' : ''}${count} ${Math.abs(count) === 1 ? 'day' : 'days'}`;
}

/** "+2 min", "-3 min", "0 min". */
export function signedMinutes(count: number): string {
  return `${count > 0 ? '+' : ''}${count} min`;
}
