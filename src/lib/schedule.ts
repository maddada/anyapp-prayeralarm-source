// The link between the user's settings and the alarms on the phone.
// The alarms themselves are planned by the native side (modules/alarms: PrayerPlan.kt and
// PrayerScheduler.kt), which renews them every time one rings and after the phone restarts,
// so they keep going even if the app is never opened. This file only hands over the settings.
import { setPrayerConfig } from './alarms';
import { diary } from './diary';
import { minutesWords } from './format';
import type { Place } from './places';
import { PRAYERS, prayerTimesFor, type Day, type DayTimes } from './prayerTimes';
import type { Settings } from './settings';
import { adhanEndMs } from './sounds';

/** A day's prayer times at a place by the chosen method, with the user's own minutes added. */
export function timesFor(day: Day, place: Place, settings: Settings): DayTimes {
  const times = prayerTimesFor(day, place, settings.method, settings.asrSchool);
  for (const prayer of PRAYERS) times[prayer] += settings.adjust[prayer] * 60_000;
  return times;
}

/** The text spoken before a prayer (the same words as in PrayerPlan.kt). */
export function reminderSpeech(prayerName: string, minutes: number): string {
  return `${prayerName} prayer is in ${minutesWords(minutes)}.`;
}

/** Which prayers had their alarms off at the last hand-over, for the diary. */
let lastOff: string | null = null;

function noteSilencedPrayers(settings: Settings) {
  const off = PRAYERS.filter((prayer) => !settings.prayerOn[prayer]);
  const key = off.join(',');
  if (lastOff !== null && key !== lastOff) {
    diary(
      off.length === 0
        ? 'Alarms on for every prayer'
        : `Alarms off for ${off.length} ${off.length === 1 ? 'prayer' : 'prayers'} (${off.join(', ')})`,
    );
  }
  lastOff = key;
}

/** Whether a place was chosen at the last hand-over, for the diary. */
let lastHadPlace: boolean | null = null;

function notePlace(settings: Settings) {
  const has = settings.place !== null;
  if (has !== lastHadPlace && !has) diary('No place chosen yet: no times shown and no alarms set');
  lastHadPlace = has;
}

let running = false;
let waiting: Settings | null = null;

function takeWaiting(): Settings | null {
  const next = waiting;
  waiting = null;
  return next;
}

/**
 * Makes the alarms on the phone match the settings. Safe to call often: calls made while one
 * is still working are merged, and the newest settings win.
 */
export async function syncAlarms(settings: Settings): Promise<void> {
  if (running) {
    waiting = settings;
    return;
  }
  running = true;
  try {
    let next: Settings | null = settings;
    while (next) {
      noteSilencedPrayers(next);
      notePlace(next);
      try {
        await setPrayerConfig({
          // No place yet: the native side plans no alarms and hides the notification.
          latitude: next.place?.latitude ?? null,
          longitude: next.place?.longitude ?? null,
          enabled: next.enabled,
          firstMinutes: next.firstMinutes,
          secondMinutes: next.secondMinutes,
          adjust: next.adjust,
          prayerOn: next.prayerOn,
          hour24: next.hour24,
          method: next.method,
          asrSchool: next.asrSchool,
          adhanSound: next.adhanSound,
          adhanEndMs: adhanEndMs(next.adhanSound, next.adhanLength) ?? 0,
          hijriCorrection: next.hijriCorrection,
          statusBar: next.statusBar,
        });
      } catch (error) {
        console.warn('Could not set the prayer alarms', error);
        diary('Could not hand the prayer settings to the alarms');
      }
      next = takeWaiting();
    }
  } finally {
    running = false;
  }
}
