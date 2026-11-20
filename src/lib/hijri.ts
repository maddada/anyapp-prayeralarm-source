// Today's date in the Islamic (Hijri) calendar, worked out on the phone.
// It follows the Umm al-Qura calendar, which the UAE's dates normally match. A month really
// begins when the new moon is seen, so the user can shift the date by a day or two in Settings.

/** 1 Muharram 1447 was 26 June 2025: day 20265 counted from 1 January 1970. */
const FIRST_DAY = 20265;
const FIRST_YEAR = 1447;
const MONTH_COUNT = 1848;

// The length of every month from Muharram 1447 to the end of 1600 (the year 2174), one bit per
// month: 1 = 30 days, 0 = 29 days. Four months per hex digit.
const MONTH_LENGTHS =
  'baa5b52b6a56e4db25b52b6a5ad2ae92f49764b6a56acad655d49da4dd16d955aa5b52da95b4ad5956ca6e4aea4f52b6' +
  '956aaab54bd25d92ea96d4ada95b4aba55b29b54d6a97547693749b5556aa6b52ba8bd46da35caad64db26b94baa5b52' +
  'b695751768b725b52b5655b49da4ed16d8b6aa6d52da95d4ada95b4ab653729762ba95b2ab5555b25d92ec96d2ae956b' +
  '4aba55d29d54daa9b54baa3b49ba4daaaad52da95d45ea2ec9ad556b26b94baa5d52da95b52ba8bb45b92da95ab4ada4' +
  'ed16e8b6a56d535695d4ada8dd46da55b29d62bb15b4ab955aaaae92ec8f5276956aaad655d29d';

const MONTH_NAMES = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

const DAY_MS = 86_400_000;

function monthLength(index: number): number {
  const digit = parseInt(MONTH_LENGTHS[index >> 2], 16);
  return (digit >> (3 - (index & 3))) & 1 ? 30 : 29;
}

export type HijriDate = { day: number; month: number; year: number };

/**
 * The Islamic date of the phone's calendar day at `at`, moved by the user's correction in days.
 * Null outside the years the table covers (before mid 2025 or after 2174).
 */
export function hijriDate(at: number, correctionDays = 0): HijriDate | null {
  const localMs = at - new Date(at).getTimezoneOffset() * 60_000;
  let days = Math.floor(localMs / DAY_MS) + correctionDays - FIRST_DAY;
  if (days < 0) return null;
  for (let index = 0; index < MONTH_COUNT; index++) {
    const length = monthLength(index);
    if (days < length) {
      return { day: days + 1, month: (index % 12) + 1, year: FIRST_YEAR + Math.floor(index / 12) };
    }
    days -= length;
  }
  return null;
}

/** "30 Jumada al-Awwal 1448 AH", or an empty string when the date is not known. */
export function hijriText(at: number, correctionDays = 0): string {
  const date = hijriDate(at, correctionDays);
  return date ? `${date.day} ${MONTH_NAMES[date.month - 1]} ${date.year} AH` : '';
}
