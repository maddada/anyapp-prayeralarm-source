// Prayer times for the chosen place, worked out on the phone (no internet needed), by one of
// several well-known calculation methods. The default ('uae') is fitted to the official timetable
// published by the UAE General Authority of Islamic Affairs, Endowments and Zakat (Awqaf): checked
// minute for minute against the official table for October 2026, and against published times for
// November, December and July.
//
// Clock times and calendar days follow the phone's own time zone (summer time included).
//
// KEEP IN STEP with modules/alarms/.../PrayerPlan.kt, which works out the same times for the
// alarms while the app is closed. Change both together.

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYERS)[number];

export const PRAYER_NAMES: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/** One day's times as timestamps in milliseconds. */
export type DayTimes = Record<PrayerKey, number> & { sunrise: number };

/** A calendar day in the phone's time zone. `month` is 1 to 12. */
export type Day = { year: number; month: number; day: number };

/** Where the times are worked out for, in degrees (north and east are positive). */
export type Coordinates = { latitude: number; longitude: number };

/**
 * Minutes the phone's clock is ahead of UTC on a day, taken at its local noon (the same as
 * PrayerPlan.kt `offsetMinutes`).
 */
export function utcOffsetMinutes({ year, month, day }: Day): number {
  return -new Date(year, month - 1, day, 12).getTimezoneOffset();
}

export type MethodId = 'uae' | 'karachi' | 'mwl' | 'ummalqura' | 'egypt' | 'gulf' | 'kuwait' | 'qatar' | 'isna';
export type AsrSchool = 'standard' | 'hanafi';

type Method = {
  id: MethodId;
  name: string;
  /** A short note shown under the name. */
  detail: string;
  /** Sun below the horizon (degrees) at Fajr. */
  fajrAngle: number;
  /** Sun below the horizon (degrees) at Isha, or null when Isha is a fixed time after Maghrib. */
  ishaAngle: number | null;
  /** Minutes after Maghrib for Isha when `ishaAngle` is null. */
  ishaAfterMaghrib: number;
  /** Sun's centre below the horizon at sunrise and at sunset (refraction, the sun's radius, height). */
  sunriseAngle: number;
  sunsetAngle: number;
  /** Minutes added to each time after rounding. */
  added: { fajr: number; sunrise: number; dhuhr: number; asr: number; maghrib: number; isha: number };
};

const NONE = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

function standard(id: MethodId, name: string, detail: string, fajrAngle: number, isha: number | 'after90'): Method {
  return {
    id,
    name,
    detail,
    fajrAngle,
    ishaAngle: isha === 'after90' ? null : isha,
    ishaAfterMaghrib: isha === 'after90' ? 90 : 0,
    sunriseAngle: 0.833,
    sunsetAngle: 0.833,
    added: NONE,
  };
}

export const METHODS: Method[] = [
  {
    id: 'uae',
    name: 'UAE Awqaf',
    detail: 'The official UAE timetable',
    fajrAngle: 18.18,
    ishaAngle: 18,
    ishaAfterMaghrib: 0,
    sunriseAngle: 0.89,
    sunsetAngle: 1.15,
    added: { fajr: 0, sunrise: -3, dhuhr: 2, asr: 0, maghrib: 1, isha: 0 },
  },
  standard('karachi', 'Karachi', 'University of Islamic Sciences, Karachi', 18, 18),
  standard('mwl', 'Muslim World League', 'Used in much of the world', 18, 17),
  standard('ummalqura', 'Umm al-Qura, Makkah', 'Isha 90 minutes after Maghrib', 18.5, 'after90'),
  standard('egypt', 'Egyptian Authority', 'Egyptian General Authority of Survey', 19.5, 17.5),
  standard('gulf', 'Gulf Region', 'Isha 90 minutes after Maghrib', 19.5, 'after90'),
  standard('kuwait', 'Kuwait', 'Ministry of Awqaf, Kuwait', 18, 17.5),
  standard('qatar', 'Qatar', 'Isha 90 minutes after Maghrib', 18, 'after90'),
  standard('isna', 'North America (ISNA)', 'Islamic Society of North America', 15, 15),
];

export function methodById(id: string): Method {
  return METHODS.find((m) => m.id === id) ?? METHODS[0];
}

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const tan = (deg: number) => Math.tan(deg * RAD);
const turn = (deg: number) => ((deg % 360) + 360) % 360;

/** Julian day number at 00:00 UTC of a calendar date. */
function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** The sun's declination (degrees) and the equation of time (minutes) at a Julian day. */
function sunPosition(jd: number): { declination: number; equationOfTime: number } {
  const t = (jd - 2451545) / 36525;
  const meanLongitude = turn(280.46646 + t * (36000.76983 + 0.0003032 * t));
  const meanAnomaly = turn(357.52911 + t * (35999.05029 - 0.0001537 * t));
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnomaly) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const longitude = meanLongitude + centre - 0.00569 - 0.00478 * sin(omega);
  const obliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * cos(omega);
  const declination = Math.asin(sin(obliquity) * sin(longitude)) / RAD;
  const y = tan(obliquity / 2) ** 2;
  const equationOfTime =
    (4 *
      (y * sin(2 * meanLongitude) -
        2 * eccentricity * sin(meanAnomaly) +
        4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude) -
        0.5 * y * y * sin(4 * meanLongitude) -
        1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly))) /
    RAD;
  return { declination, equationOfTime };
}

/**
 * The prayer times for one day at a place by a calculation method (before the user's own
 * adjustments). Works for any date; the times are absolute moments.
 */
export function prayerTimesFor(
  { year, month, day }: Day,
  { latitude, longitude }: Coordinates,
  methodId: MethodId = 'uae',
  asrSchool: AsrSchool = 'standard',
): DayTimes {
  const offset = utcOffsetMinutes({ year, month, day });
  const method = methodById(methodId);
  const shadow = asrSchool === 'hanafi' ? 2 : 1;
  const jd0 = julianDay(year, month, day);
  const sunAt = (minutes: number) => sunPosition(jd0 + (minutes - offset) / 1440);
  const noonAt = (minutes: number) => 720 - 4 * longitude - sunAt(minutes).equationOfTime + offset;

  // Minutes after local midnight when the sun reaches `altitude` degrees, before (-1) or after (+1) noon.
  const when = (altitude: number | ((declination: number) => number), side: -1 | 1, guess: number) => {
    let minutes = guess;
    for (let i = 0; i < 4; i++) {
      const sun = sunAt(minutes);
      const target = typeof altitude === 'function' ? altitude(sun.declination) : altitude;
      const cosHour =
        (sin(target) - sin(latitude) * sin(sun.declination)) / (cos(latitude) * cos(sun.declination));
      const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHour))) / RAD;
      minutes = 720 - 4 * longitude - sun.equationOfTime + offset + side * 4 * hourAngle;
    }
    return minutes;
  };

  let noon = 720;
  for (let i = 0; i < 3; i++) noon = noonAt(noon);

  const minutes = {
    fajr: when(-method.fajrAngle, -1, 300),
    sunrise: when(-method.sunriseAngle, -1, 360),
    dhuhr: noon,
    asr: when((declination) => Math.atan(1 / (shadow + tan(Math.abs(latitude - declination)))) / RAD, 1, 960),
    maghrib: when(-method.sunsetAngle, 1, 1080),
    isha: method.ishaAngle === null ? 0 : when(-method.ishaAngle, 1, 1140),
  };

  const midnight = Date.UTC(year, month - 1, day) - offset * 60_000;
  const stamp = (key: keyof typeof minutes) =>
    midnight + (Math.round(minutes[key]) + method.added[key]) * 60_000;
  const maghrib = stamp('maghrib');
  return {
    fajr: stamp('fajr'),
    sunrise: stamp('sunrise'),
    dhuhr: stamp('dhuhr'),
    asr: stamp('asr'),
    maghrib,
    isha: method.ishaAngle === null ? maghrib + (method.ishaAfterMaghrib + method.added.isha) * 60_000 : stamp('isha'),
  };
}

/** The calendar day on the phone's clock at a given moment. */
export function localDay(at: number): Day {
  const d = new Date(at);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** The day `count` days after `from` (negative for earlier). */
export function addDays(from: Day, count: number): Day {
  const d = new Date(Date.UTC(from.year, from.month - 1, from.day + count));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** "20261110": used in alarm ids. */
export function dayKey({ year, month, day }: Day): string {
  return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}
