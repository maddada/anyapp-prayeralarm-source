// Finds the five prayer times on a photo of a mosque's prayer time board.
//
// The phone's text recognition (BoardReader.kt) gives us every line of text with its position.
// Boards differ a lot (labels in Arabic, 12 or 24 hour clocks, a column for the iqama, the date,
// a big clock), so instead of trusting labels we use what we already know: today's calculated
// times. Each prayer gets the time on the board that is closest to its calculated time, the five
// must come in order, and each board time is used once. English labels next to a time help a bit.
// The user checks and can fix the result before anything is saved.
import type { BoardText, TextBox } from './alarms';
import { PRAYERS, type PrayerKey } from './prayerTimes';

/** How far (minutes) a board time may be from the calculated one and still count. */
export const BOARD_WINDOW = 60;

type Candidate = { minutes: number; text: string; box: TextBox };

/** Letters that text recognition often reads instead of the digits of an LED board. */
const LOOKALIKES: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', i: '1', Z: '2', z: '2', S: '5', s: '5', B: '8', G: '6', b: '6', g: '9', q: '9' };

/** Turns lookalike letters into digits, but only inside groups that are mostly digits. */
function digitize(text: string): string {
  return text.replace(/[0-9OoDQIl|iZzSsBGbgq:.]{3,}/g, (group) => {
    const digits = group.replace(/[^0-9]/g, '').length;
    if (digits < 2) return group;
    return group.replace(/[OoDQIl|iZzSsBGbgq]/g, (ch) => LOOKALIKES[ch] ?? ch);
  });
}

/** Every "5:13", "05.13", "17:34" or "5 13" in a line, as minutes after midnight (as written). */
export function timesInText(raw: string): { minutes: number; text: string }[] {
  const text = digitize(raw);
  const found: { minutes: number; text: string }[] = [];
  const pattern = /(\d{1,2})\s?[:.∶：]\s?(\d{2})|(\d{1,2}) (\d{2})/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = text.slice(Math.max(0, start - 1), start);
    const after = text.slice(end, end + 2);
    // Skip dates (11.11.2026, 11/11), years and longer numbers, then look again one step on.
    if (/[\d./-]/.test(before) || /^\d|^[./-]\d/.test(after)) {
      pattern.lastIndex = start + 1;
      continue;
    }
    const hours = Number(match[1] ?? match[3]);
    const minutes = Number(match[2] ?? match[4]);
    if (hours > 23 || minutes > 59) continue;
    found.push({ minutes: hours * 60 + minutes, text: match[0] });
  }
  return found;
}

const LABELS: Record<PrayerKey, RegExp> = {
  fajr: /fajr|fajer|fadjr|subh|sobh/i,
  dhuhr: /dhuhr|duhr|zuhr|dhuhur|zohr|thuhr|duhur/i,
  asr: /\basr\b|asar/i,
  maghrib: /maghrib|magrib|maghreb/i,
  isha: /isha|esha|ishaa/i,
};

function overlaps(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.min(a2, b2) - Math.max(a1, b1) > 0;
}

/** True when a label sits on the same row or in the same column as the time. */
function labelled(prayer: PrayerKey, candidate: Candidate, lines: TextBox[]): boolean {
  const box = candidate.box;
  return lines.some((line) => {
    if (!LABELS[prayer].test(line.text)) return false;
    const sameRow = overlaps(box.top, box.bottom, line.top, line.bottom);
    const sameColumn = overlaps(box.left, box.right, line.left, line.right);
    return sameRow || sameColumn;
  });
}

export type BoardResult = {
  /** The board time for each prayer, in minutes after midnight, or null when not found. */
  times: Record<PrayerKey, number | null>;
  /** How many times the photo had in total (to tell "nothing readable" from "no match"). */
  timesSeen: number;
};

/**
 * Picks the five prayer times from what was read on the board.
 * `expected` is today's calculated time for each prayer in minutes after midnight (the phone's clock).
 */
export function matchBoard(board: BoardText, expected: Record<PrayerKey, number>): BoardResult {
  const candidates: Candidate[] = [];
  for (const line of board.lines) {
    for (const time of timesInText(line.text)) candidates.push({ ...time, box: line });
  }
  // Times split over two words ("5" "13") that the line did not join.
  if (candidates.length === 0) {
    for (const word of board.words) {
      for (const time of timesInText(word.text)) candidates.push({ ...time, box: word });
    }
  }

  // The options for each prayer: a board time read as written, or 12 hours later (12-hour boards).
  type Option = { index: number; minutes: number; cost: number };
  // Boards list the prayers in order, top to bottom or left to right. Picking a time that sits
  // before the previous prayer's time on the board costs extra (it is probably an iqama or the
  // wrong row), but is still allowed in case the photo was read out of order.
  const OUT_OF_ORDER = 15;
  const comesAfter = (a: TextBox, b: TextBox) => {
    const rowHeight = Math.max(1, Math.min(a.bottom - a.top, b.bottom - b.top));
    if (Math.abs(b.top - a.top) <= rowHeight / 2) return b.left > a.left; // same row, further right
    return b.top > a.top; // lower down
  };
  const options: Record<PrayerKey, Option[]> = { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [] };
  for (const prayer of PRAYERS) {
    candidates.forEach((candidate, index) => {
      const readings = new Set([candidate.minutes]);
      if (candidate.minutes < 13 * 60) readings.add((candidate.minutes + 720) % 1440);
      for (const minutes of readings) {
        const distance = Math.abs(minutes - expected[prayer]);
        if (distance > BOARD_WINDOW) continue;
        const cost = distance - (labelled(prayer, candidate, board.lines) ? 8 : 0);
        options[prayer].push({ index, minutes, cost });
      }
    });
  }

  // Try every combination (there are only a few options per prayer) and keep the cheapest one in
  // which the times go up from Fajr to Isha and no board time is used twice. A missing prayer
  // costs more than any match, so as many prayers as possible are found.
  const MISSING = BOARD_WINDOW + 20;
  let best: { cost: number; picks: (Option | null)[] } = { cost: Infinity, picks: [] };
  const picks: (Option | null)[] = [];
  const search = (i: number, cost: number, used: Set<number>, last: Option | null) => {
    if (cost >= best.cost) return;
    if (i === PRAYERS.length) {
      best = { cost, picks: [...picks] };
      return;
    }
    for (const option of options[PRAYERS[i]]) {
      if (used.has(option.index) || (last && option.minutes <= last.minutes)) continue;
      const lastBox = last ? candidates[last.index].box : null;
      const box = candidates[option.index].box;
      const order = lastBox && lastBox !== box && !comesAfter(lastBox, box) ? OUT_OF_ORDER : 0;
      used.add(option.index);
      picks.push(option);
      search(i + 1, cost + option.cost + order, used, option);
      picks.pop();
      used.delete(option.index);
    }
    picks.push(null);
    search(i + 1, cost + MISSING, used, last);
    picks.pop();
  };
  search(0, 0, new Set(), null);

  const times = { fajr: null, dhuhr: null, asr: null, maghrib: null, isha: null } as Record<PrayerKey, number | null>;
  PRAYERS.forEach((prayer, i) => {
    times[prayer] = best.picks[i]?.minutes ?? null;
  });
  return { times, timesSeen: candidates.length };
}
