import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlaceChooser } from '@/components/PlaceChooser';
import { Screen } from '@/components/Screen';
import { canScheduleExactAlarms, ensureAlarmPermission, openExactAlarmSettings, stopAlarmSound } from '@/lib/alarms';
import { clock, clockParts, longDate, minutesWords, signedMinutes, timeLeft } from '@/lib/format';
import { hijriText } from '@/lib/hijri';
import type { Place } from '@/lib/places';
import { PRAYERS, PRAYER_NAMES, addDays, localDay, type PrayerKey } from '@/lib/prayerTimes';
import { timesFor } from '@/lib/schedule';
import { updateSettings, useSettings } from '@/lib/settings';
import { setSettingsTab, useTabs } from '@/lib/tabs';
import { useSoundPlaying } from '@/lib/useSoundPlaying';
import { radius, spacing, type, useColors } from '@/theme';

type Row = { key: PrayerKey | 'sunrise'; name: string; at: number };

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** A small picture in front of each name: the sun's place in the sky at that time. */
const ROW_ICONS: Record<Row['key'], IconName> = {
  fajr: 'weather-sunset-up',
  sunrise: 'white-balance-sunny',
  dhuhr: 'weather-sunny',
  asr: 'sun-angle-outline',
  maghrib: 'weather-sunset-down',
  isha: 'weather-night',
};

function exactAlarmsAllowed(): boolean {
  try {
    return canScheduleExactAlarms();
  } catch {
    return true;
  }
}

/**
 * Today's prayer times for the chosen place, with the next one on top. Until a place is chosen
 * it asks for one instead (no times and no alarms without it).
 */
export function HomeScreen() {
  const colors = useColors();
  const [settings, ready] = useSettings();

  if (!ready) return <View style={[styles.fill, { backgroundColor: colors.background }]} />;
  if (!settings.place) {
    return (
      <PlaceChooser
        insetBottom={false}
        header={
          <View style={styles.intro}>
            <Text style={[type.title, { color: colors.text }]}>Where do you pray?</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>
              Prayer times and the Qibla depend on your place. Choose it once; you can change it later in Settings.
            </Text>
          </View>
        }
      />
    );
  }
  return <PrayerTimes place={settings.place} />;
}

function PrayerTimes({ place }: { place: Place }) {
  const colors = useColors();
  const { setTab } = useTabs();
  const [settings] = useSettings();
  const playing = useSoundPlaying();
  const [now, setNow] = useState(() => Date.now());
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [exactOn, setExactOn] = useState(exactAlarmsAllowed);

  const checkPermissions = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then((status) => setNotificationsOn(status.granted))
      .catch(() => {});
    setExactOn(exactAlarmsAllowed());
  }, []);

  // Ask once for permission to show the alarms, then keep the screen up to date.
  useEffect(() => {
    ensureAlarmPermission()
      .then(setNotificationsOn)
      .catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
        checkPermissions();
      }
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [checkPermissions]);

  const allowNotifications = async () => {
    try {
      const status = await Notifications.getPermissionsAsync();
      if (status.granted) {
        setNotificationsOn(true);
      } else if (status.canAskAgain) {
        setNotificationsOn(await ensureAlarmPermission());
      } else {
        await Linking.openSettings();
      }
    } catch {
      Linking.openSettings().catch(() => {});
    }
  };

  const today = localDay(now);
  const times = timesFor(today, place, settings);
  const tomorrow = timesFor(addDays(today, 1), place, settings);

  const rows: Row[] = [
    { key: 'fajr', name: PRAYER_NAMES.fajr, at: times.fajr },
    { key: 'sunrise', name: 'Shuruq', at: times.sunrise },
    { key: 'dhuhr', name: PRAYER_NAMES.dhuhr, at: times.dhuhr },
    { key: 'asr', name: PRAYER_NAMES.asr, at: times.asr },
    { key: 'maghrib', name: PRAYER_NAMES.maghrib, at: times.maghrib },
    { key: 'isha', name: PRAYER_NAMES.isha, at: times.isha },
  ];

  const nextToday = PRAYERS.find((prayer) => times[prayer] > now);
  const next = nextToday
    ? { key: nextToday, at: times[nextToday], isTomorrow: false }
    : { key: 'fajr' as PrayerKey, at: tomorrow.fajr, isTomorrow: true };
  const left = timeLeft(now, next.at);
  const leftWords =
    [left.hours ? `${left.hours} ${left.hours === 1 ? 'hour' : 'hours'}` : '', left.minutes ? minutesWords(left.minutes) : '']
      .filter(Boolean)
      .join(' ') || 'now';

  const silenced = PRAYERS.filter((prayer) => !settings.prayerOn[prayer]);
  const silencedNames = silenced.map((prayer) => PRAYER_NAMES[prayer]);
  const silencedText =
    silencedNames.length > 1
      ? `${silencedNames.slice(0, -1).join(', ')} and ${silencedNames[silencedNames.length - 1]}`
      : silencedNames[0];

  // The sound icon on each prayer row switches its reminders and adhan on or off.
  const toggleSound = (prayer: PrayerKey) => {
    if (!settings.enabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      ToastAndroid.show('Alarms are off. Turn them on in Settings.', ToastAndroid.SHORT);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateSettings((prev) => ({ ...prev, prayerOn: { ...prev.prayerOn, [prayer]: !prev.prayerOn[prayer] } }));
  };

  const islamicDate = hijriText(now, settings.hijriCorrection);

  const reminders =
    settings.firstMinutes === settings.secondMinutes
      ? `Spoken reminder ${minutesWords(settings.firstMinutes)} before`
      : `Spoken reminders ${Math.max(settings.firstMinutes, settings.secondMinutes)} and ${minutesWords(
          Math.min(settings.firstMinutes, settings.secondMinutes),
        )} before`;

  return (
    <Screen style={styles.page} insetBottom={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Place: ${place.name}. Change it`}
            onPress={() => {
              setSettingsTab('times');
              setTab('settings');
            }}
            hitSlop={8}
          >
            <Text numberOfLines={1} style={[type.label, { color: colors.textFaint }]}>
              {place.name.toUpperCase()}
            </Text>
          </Pressable>
          <Text style={[type.heading, { color: colors.text }]}>{longDate(now)}</Text>
          {islamicDate ? <Text style={[type.body, { color: colors.textMuted }]}>{islamicDate}</Text> : null}
        </View>
      </View>

      {playing ? (
        <Button title="Stop the sound" onPress={() => stopAlarmSound().catch(() => {})} style={styles.notice} />
      ) : null}

      {settings.enabled && !notificationsOn ? (
        <View style={[styles.notice, styles.warning, { borderColor: colors.warning }]}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>Notifications are off</Text>
          <Text style={[type.small, { color: colors.textMuted }]}>
            Allow them so the reminders and the adhan can show on your phone.
          </Text>
          <Button title="Allow notifications" variant="secondary" onPress={allowNotifications} />
        </View>
      ) : null}

      {settings.enabled && !exactOn ? (
        <View style={[styles.notice, styles.warning, { borderColor: colors.warning }]}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>Alarms may be late</Text>
          <Text style={[type.small, { color: colors.textMuted }]}>
            Allow alarms for this app so every reminder comes exactly on time.
          </Text>
          <Button
            title="Allow alarms"
            variant="secondary"
            onPress={() => openExactAlarmSettings().catch(() => {})}
          />
        </View>
      ) : null}

      <View style={styles.next}>
        <Text style={[type.label, { color: colors.accent }]}>NEXT PRAYER</Text>
        <Text style={[type.title, { color: colors.text }]}>{PRAYER_NAMES[next.key]}</Text>
        <Text
          accessibilityLabel={`Time left: ${leftWords}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.left, type.numeric, { color: colors.text }]}
        >
          {left.hours === 0 && left.minutes === 0 ? 'Now' : null}
          {left.hours > 0 ? (
            <>
              {left.hours}
              <Text style={[styles.leftUnit, { color: colors.textMuted }]}> h{left.minutes > 0 ? '  ' : ''}</Text>
            </>
          ) : null}
          {left.minutes > 0 ? (
            <>
              {left.minutes}
              <Text style={[styles.leftUnit, { color: colors.textMuted }]}> min</Text>
            </>
          ) : null}
        </Text>
        <Text style={[type.body, type.numeric, { color: colors.textMuted }]}>
          {next.isTomorrow ? 'Tomorrow at ' : 'At '}
          {clock(next.at, settings.hour24)}
        </Text>
      </View>

      <View style={[styles.list, { borderColor: colors.border }]}>
        {rows.map((row) => {
          const prayer = row.key === 'sunrise' ? null : row.key;
          const isNext = prayer !== null && !next.isTomorrow && prayer === next.key;
          const isPast = row.at <= now;
          const parts = clockParts(row.at, settings.hour24);
          const adjust = prayer ? settings.adjust[prayer] : 0;
          const soundOn = prayer !== null && settings.enabled && settings.prayerOn[prayer];
          const textColor = isNext ? colors.accent : isPast ? colors.textMuted : colors.text;
          return (
            <View key={row.key} style={[styles.row, isNext && { backgroundColor: colors.accentSoft }]}>
              <MaterialCommunityIcons
                name={ROW_ICONS[row.key]}
                size={22}
                color={isNext ? colors.accent : colors.textMuted}
              />
              <View style={styles.rowName}>
                <Text style={[type.bodyStrong, { color: textColor }]}>{row.name}</Text>
                {adjust !== 0 ? (
                  <Text style={[type.small, { color: colors.textFaint }]}>{signedMinutes(adjust)}</Text>
                ) : null}
              </View>
              <Text style={[styles.time, type.numeric, { color: textColor }]}>
                {parts.time}
                {parts.suffix ? (
                  <Text style={[type.small, { color: isNext ? colors.accent : colors.textFaint }]}> {parts.suffix}</Text>
                ) : null}
              </Text>
              {prayer ? (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={`Reminders and adhan for ${row.name}`}
                  accessibilityState={{ checked: soundOn, disabled: !settings.enabled }}
                  onPress={() => toggleSound(prayer)}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.sound,
                    !settings.enabled && styles.soundDisabled,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={soundOn ? 'volume-high' : 'volume-off'}
                    size={22}
                    color={soundOn ? colors.accent : colors.textFaint}
                  />
                </Pressable>
              ) : (
                <View style={styles.sound} />
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setSettingsTab('alarms');
          setTab('settings');
        }}
        style={({ pressed }) => [
          styles.summary,
          { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
        ]}
      >
        <MaterialCommunityIcons
          name={settings.enabled ? 'bell-outline' : 'bell-off-outline'}
          size={22}
          color={settings.enabled ? colors.accent : colors.textMuted}
        />
        <View style={styles.summaryText}>
          {settings.enabled && silenced.length === PRAYERS.length ? (
            <>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Alarms are off for every prayer</Text>
              <Text style={[type.small, { color: colors.textMuted }]}>Tap to choose prayers</Text>
            </>
          ) : settings.enabled ? (
            <>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{reminders}</Text>
              <Text style={[type.small, { color: colors.textMuted }]}>
                {silenced.length > 0 ? `Adhan at each prayer, except ${silencedText}` : 'Adhan at each prayer time'}
              </Text>
            </>
          ) : (
            <>
              <Text style={[type.bodyStrong, { color: colors.text }]}>Alarms are off</Text>
              <Text style={[type.small, { color: colors.textMuted }]}>Tap to turn them back on</Text>
            </>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textFaint} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  intro: { gap: spacing.sm, marginTop: spacing.sm },
  page: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  notice: { marginTop: spacing.lg },
  warning: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  next: { marginTop: spacing.xl, gap: spacing.xs },
  left: { fontSize: 64, lineHeight: 72, fontWeight: '700', letterSpacing: -2 },
  leftUnit: { fontSize: 28, fontWeight: '500', letterSpacing: 0 },
  list: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 56,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginHorizontal: -spacing.md,
    borderRadius: radius.md,
  },
  rowName: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  sound: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, marginLeft: -spacing.xs },
  soundDisabled: { opacity: 0.6 },
  time: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  spacer: { flex: 1, minHeight: spacing.xl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  summaryText: { flex: 1, gap: 2 },
});
