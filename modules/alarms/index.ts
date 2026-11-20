// Exact alarms that fire while the app is closed and after a reboot, and can play a sound and
// speak text. Native code: modules/alarms/android (Kotlin). Usage: see AGENTS.md, "Alarms".
import { requireNativeModule } from 'expo';

export type AlarmInput = {
  /** Your own stable id. Scheduling the same id again replaces the old alarm. */
  id: string;
  /** When to fire: a Date or a timestamp in milliseconds. */
  at: Date | number;
  /** Notification title. */
  title: string;
  /** Notification text. Defaults to `speak`. */
  body?: string;
  /** Text spoken aloud (text to speech) when the alarm fires, on the alarm volume. */
  speak?: string;
  /** Speech language as a BCP-47 tag, e.g. 'en-US' or 'ar'. Defaults to the phone's language. */
  language?: string;
  /** A file in assets/sounds/ without extension (e.g. 'adhan' for assets/sounds/adhan.mp3), played before the speech. */
  sound?: string;
  /** 'daily' fires again every day at the same local time until cancelled. */
  repeat?: 'daily';
  /**
   * For alarms with `sound` or `speak` (default true): when the phone is locked or its screen is
   * off, show a full-screen alarm with a Stop button (it wakes the screen) and lower other audio
   * while it plays. When the phone is in use it shows as a normal heads-up notification instead.
   * Use false for gentle announcements that should only speak.
   */
  fullScreen?: boolean;
  /** Stop `sound` this many milliseconds in, with a 1 second fade out. Left out: play all of it. */
  soundEndMs?: number;
};

export type ScheduledAlarm = Omit<AlarmInput, 'at'> & { at: number };

type NativeAlarm = Omit<AlarmInput, 'at'> & { at: number };

type AnyappAlarmsNative = {
  schedule(alarm: NativeAlarm): Promise<{ id: string; exact: boolean }>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  getAll(): Promise<ScheduledAlarm[]>;
  fireNow(alarm: NativeAlarm): Promise<void>;
  setPrayerConfig(json: string): Promise<void>;
  readText(uri: string): Promise<BoardText>;
  stopPlayback(): Promise<void>;
  isPlaying(): boolean;
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): Promise<void>;
  canUseFullScreenAlarms(): boolean;
  openFullScreenAlarmSettings(): Promise<void>;
};

const Native = requireNativeModule<AnyappAlarmsNative>('AnyappAlarms');

function toNative(alarm: AlarmInput): NativeAlarm {
  const at = alarm.at instanceof Date ? alarm.at.getTime() : alarm.at;
  return { ...alarm, at };
}

/** Schedules (or replaces) an alarm. `exact` is false only if the user revoked exact alarms. */
export function scheduleAlarm(alarm: AlarmInput): Promise<{ id: string; exact: boolean }> {
  return Native.schedule(toNative(alarm));
}

export function cancelAlarm(id: string): Promise<void> {
  return Native.cancel(id);
}

export function cancelAllAlarms(): Promise<void> {
  return Native.cancelAll();
}

/** Alarms still waiting to fire, soonest first. */
export function getScheduledAlarms(): Promise<ScheduledAlarm[]> {
  return Native.getAll();
}

/** Fires an alarm right now (notification, sound, speech): handy for a "Test" button. */
export function testAlarm(alarm: Omit<AlarmInput, 'at'>): Promise<void> {
  return Native.fireNow({ ...alarm, at: Date.now() });
}

/**
 * Hands the prayer settings to the native side, which sets the prayer alarms and keeps renewing
 * them by itself (on every alarm, after a restart), even if the app is never opened again.
 * See PrayerPlan.kt and PrayerScheduler.kt.
 */
export function setPrayerConfig(config: {
  /** The chosen place in degrees, or null while none is chosen (then no alarms are planned). */
  latitude: number | null;
  longitude: number | null;
  enabled: boolean;
  firstMinutes: number;
  secondMinutes: number;
  adjust: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', number>;
  /** Per prayer: false means no reminders and no adhan for it. A missing prayer counts as on. */
  prayerOn: Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', boolean>;
  hour24: boolean;
  method: string;
  asrSchool: 'standard' | 'hanafi';
  adhanSound: string;
  /** Where the short adhan stops (ms), or 0 for the whole adhan. */
  adhanEndMs: number;
  hijriCorrection: number;
  statusBar: boolean;
}): Promise<void> {
  return Native.setPrayerConfig(JSON.stringify(config));
}

/** A piece of text found on a photo, with its box in pixels. */
export type TextBox = { text: string; left: number; top: number; right: number; bottom: number };
export type BoardText = { width: number; height: number; lines: TextBox[]; words: TextBox[] };

/**
 * Reads the text on a photo (a file:// or content:// address) with Google's on-device text
 * recognition. No internet and no account needed. See BoardReader.kt.
 */
export function readBoardText(uri: string): Promise<BoardText> {
  return Native.readText(uri);
}

/** Silences an alarm that is playing its sound or speaking right now. */
export function stopAlarmSound(): Promise<void> {
  return Native.stopPlayback();
}

/** True while an alarm is playing its sound or speaking. */
export function isAlarmSoundPlaying(): boolean {
  return Native.isPlaying();
}

export function canScheduleExactAlarms(): boolean {
  return Native.canScheduleExactAlarms();
}

export function openExactAlarmSettings(): Promise<void> {
  return Native.openExactAlarmSettings();
}

/** False if the user turned off full-screen alarms for this app (Android 14+ setting). */
export function canUseFullScreenAlarms(): boolean {
  return Native.canUseFullScreenAlarms();
}

export function openFullScreenAlarmSettings(): Promise<void> {
  return Native.openFullScreenAlarmSettings();
}
