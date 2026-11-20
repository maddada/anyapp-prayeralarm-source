// The direction of the Kaaba in Makkah from any place on earth (great circle), and how far it is.
const KAABA = { latitude: 21.422487, longitude: 39.826206 };

const RAD = Math.PI / 180;

/** Degrees clockwise from true north towards the Kaaba. */
export function qiblaBearing(latitude: number, longitude: number): number {
  const p1 = latitude * RAD;
  const p2 = KAABA.latitude * RAD;
  const dl = (KAABA.longitude - longitude) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Kilometres to the Kaaba. */
export function distanceToKaaba(latitude: number, longitude: number): number {
  const p1 = latitude * RAD;
  const p2 = KAABA.latitude * RAD;
  const dp = p2 - p1;
  const dl = (KAABA.longitude - longitude) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** The nearest of the eight compass directions: "west", "north-east". */
export function compassWord(bearing: number): string {
  return POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** The smallest turn (degrees, -180 to 180) from `from` to `to`; positive means turn right. */
export function turnBetween(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}
