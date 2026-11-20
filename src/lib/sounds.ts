// The adhan recordings the user can choose from. Each `id` is a file in assets/sounds/ (without
// .mp3). All are free to use; the ones under CC BY-SA need the credit shown in Settings.
// `shortEndMs` is where the first "Allahu akbar, Allahu akbar" has ended, found by measuring the
// pause of silence after it in each recording. The short adhan stops there with a 1 second fade
// out (done by the alarm player, AlarmService.kt), which only touches the echo after the voice.
export type AdhanSound = {
  id: string;
  name: string;
  detail: string;
  full: string;
  short: string;
  shortEndMs: number;
  credit: string;
};

export type AdhanLength = 'short' | 'full';

export const ADHAN_SOUNDS: AdhanSound[] = [
  {
    id: 'adhan',
    name: 'Calm',
    detail: 'A calm, even voice',
    full: '2 min 33 s',
    short: '17 s',
    shortEndMs: 16_500,
    credit: '"Beautiful adhan" by Adam-synagda, Wikimedia Commons, CC0',
  },
  {
    id: 'adhan_madinah',
    name: 'Madinah',
    detail: "Recorded at the Prophet's Mosque",
    full: '3 min 6 s',
    short: '18 s',
    shortEndMs: 17_800,
    credit: '"Call to prayer from the Prophet\'s Mosque" by ejaz215, Wikimedia Commons, CC BY 3.0',
  },
  {
    id: 'adhan_long',
    name: 'Clear and full',
    detail: 'A strong, clear voice',
    full: '2 min 39 s',
    short: '17 s',
    shortEndMs: 17_100,
    credit: '"Azan" by Andrewler, Wikimedia Commons, CC BY-SA 4.0 (shortened)',
  },
  {
    id: 'adhan_short',
    name: 'Short',
    detail: 'A quicker adhan',
    full: '1 min 24 s',
    short: '5 s',
    shortEndMs: 5_300,
    credit: '"The Adhan" by Aaqib Azeez, uploaded by Atcovi, Wikimedia Commons, CC BY-SA 4.0',
  },
];

export function adhanSoundById(id: string): AdhanSound {
  return ADHAN_SOUNDS.find((sound) => sound.id === id) ?? ADHAN_SOUNDS[0];
}

/** Where to stop the recording for the chosen length, or undefined to play all of it. */
export function adhanEndMs(id: string, length: AdhanLength): number | undefined {
  return length === 'short' ? adhanSoundById(id).shortEndMs : undefined;
}
