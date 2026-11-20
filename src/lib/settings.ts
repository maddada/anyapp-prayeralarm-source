// The user's choices, saved on the phone and shared by every screen.
import { useSyncExternalStore } from 'react';

import { cleanPlace, type Place } from './places';
import { ADHAN_SOUNDS, type AdhanLength } from './sounds';
import { METHODS, PRAYERS, type AsrSchool, type MethodId, type PrayerKey } from './prayerTimes';
import { load, save } from './storage';

export type Settings = {
  /** Where the times are for. Null until the user has chosen a place: no times, no alarms. */
  place: Place | null;
  /** Master switch: when false nothing rings or speaks. */
  enabled: boolean;
  /** Minutes before each prayer for the first and the second spoken reminder. */
  firstMinutes: number;
  secondMinutes: number;
  /** The user's own correction for each prayer, in minutes (can be negative). */
  adjust: Record<PrayerKey, number>;
  /** Show times as 17:35 instead of 5:35 PM. */
  hour24: boolean;
  /** Days to move the Islamic date by, for when the moon was seen a day earlier or later. */
  hijriCorrection: number;
  /** How the times are worked out. */
  method: MethodId;
  asrSchool: AsrSchool;
  /** Which adhan recording plays (a file name in assets/sounds without the extension). */
  adhanSound: string;
  /** Only the first "Allahu akbar, Allahu akbar" (short, the default) or the whole adhan. */
  adhanLength: AdhanLength;
  /** Per prayer: false means no reminders and no adhan for it (its time still shows). */
  prayerOn: Record<PrayerKey, boolean>;
  /** A quiet notification with the day's times, and the next prayer's time in the status bar. */
  statusBar: boolean;
};

export const REMINDER_MIN = 1;
export const REMINDER_MAX = 120;
export const ADJUST_LIMIT = 60;
export const HIJRI_CORRECTION_LIMIT = 2;

export const DEFAULT_SETTINGS: Settings = {
  place: null,
  enabled: true,
  firstMinutes: 20,
  secondMinutes: 5,
  adjust: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  prayerOn: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  hour24: false,
  hijriCorrection: 0,
  method: 'uae',
  asrSchool: 'standard',
  adhanSound: 'adhan',
  adhanLength: 'short',
  statusBar: true,
};

const KEY = 'settings';

let current: Settings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function whole(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Makes saved data safe to use, whatever an older version of the app stored. */
function clean(raw: unknown): Settings {
  const saved = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const savedAdjust = (saved.adjust && typeof saved.adjust === 'object' ? saved.adjust : {}) as Partial<
    Record<PrayerKey, number>
  >;
  const adjust = { ...DEFAULT_SETTINGS.adjust };
  for (const prayer of PRAYERS) adjust[prayer] = whole(savedAdjust[prayer], 0, -ADJUST_LIMIT, ADJUST_LIMIT);
  // A missing value means on (also for settings saved before this switch existed).
  const savedOn = (saved.prayerOn && typeof saved.prayerOn === 'object' ? saved.prayerOn : {}) as Partial<
    Record<PrayerKey, boolean>
  >;
  const prayerOn = { ...DEFAULT_SETTINGS.prayerOn };
  for (const prayer of PRAYERS) prayerOn[prayer] = savedOn[prayer] !== false;
  return {
    place: cleanPlace(saved.place),
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULT_SETTINGS.enabled,
    firstMinutes: whole(saved.firstMinutes, DEFAULT_SETTINGS.firstMinutes, REMINDER_MIN, REMINDER_MAX),
    secondMinutes: whole(saved.secondMinutes, DEFAULT_SETTINGS.secondMinutes, REMINDER_MIN, REMINDER_MAX),
    adjust,
    prayerOn,
    hour24: typeof saved.hour24 === 'boolean' ? saved.hour24 : DEFAULT_SETTINGS.hour24,
    hijriCorrection: whole(saved.hijriCorrection, 0, -HIJRI_CORRECTION_LIMIT, HIJRI_CORRECTION_LIMIT),
    method: METHODS.some((m) => m.id === saved.method) ? (saved.method as MethodId) : DEFAULT_SETTINGS.method,
    asrSchool: saved.asrSchool === 'hanafi' ? 'hanafi' : 'standard',
    adhanSound: ADHAN_SOUNDS.some((a) => a.id === saved.adhanSound)
      ? (saved.adhanSound as string)
      : DEFAULT_SETTINGS.adhanSound,
    adhanLength: saved.adhanLength === 'full' ? 'full' : 'short',
    statusBar: typeof saved.statusBar === 'boolean' ? saved.statusBar : DEFAULT_SETTINGS.statusBar,
  };
}

let loading: Promise<void> | null = null;

/** Reads the saved settings once, at app start. */
export function initSettings(): Promise<void> {
  if (!loading) {
    loading = load<unknown>(KEY, null).then((raw) => {
      current = clean(raw);
      loaded = true;
      emit();
    });
  }
  return loading;
}

export function updateSettings(change: (prev: Settings) => Settings) {
  current = clean(change(current));
  save(KEY, current).catch(() => {});
  emit();
}

/** The current settings, and whether the saved ones have been read yet. */
export function useSettings(): [Settings, boolean] {
  const settings = useSyncExternalStore(subscribe, () => current);
  const ready = useSyncExternalStore(subscribe, () => loaded);
  return [settings, ready];
}
