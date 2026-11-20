import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { readBoardText } from '@/lib/alarms';
import { BOARD_WINDOW, matchBoard } from '@/lib/board';
import { clock, signedMinutes } from '@/lib/format';
import { PRAYERS, PRAYER_NAMES, localDay, prayerTimesFor, type PrayerKey } from '@/lib/prayerTimes';
import { ADJUST_LIMIT, updateSettings, useSettings } from '@/lib/settings';
import { radius, spacing, type, useColors } from '@/theme';

type Found = Record<PrayerKey, number | null>;
type Step =
  | { kind: 'start'; message?: string }
  | { kind: 'reading'; uri: string }
  | { kind: 'review'; uri: string; found: Found; missing: number };

/** Minutes after midnight on the phone's clock of a moment. */
function minuteOfDay(at: number): number {
  const d = new Date(at);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Reads the prayer times from a photo of the mosque's board and turns them into the user's
 * adjustments (board time minus calculated time), so every day after follows the mosque.
 */
export function BoardScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const [settings] = useSettings();
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [now] = useState(() => Date.now());

  // Today's calculated times by the chosen method, before the user's own minutes.
  // (Settings sends people here only after a place is chosen; without one nothing is matched.)
  const place = settings.place;
  const official = place ? prayerTimesFor(localDay(now), place, settings.method, settings.asrSchool) : null;
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const expected = Object.fromEntries(
    PRAYERS.map((p) => [p, official ? minuteOfDay(official[p]) : 0]),
  ) as Record<PrayerKey, number>;

  const read = async (uri: string) => {
    setStep({ kind: 'reading', uri });
    try {
      const board = await readBoardText(uri);
      const result = matchBoard(board, expected);
      const missing = PRAYERS.filter((p) => result.times[p] === null).length;
      if (missing === PRAYERS.length) {
        setStep({
          kind: 'start',
          message:
            result.timesSeen === 0
              ? 'No times could be read on that photo. Try again closer, straight on, and without glare.'
              : 'Times were found, but none close to today\'s prayer times. Try a photo of just the board.',
        });
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep({ kind: 'review', uri, found: result.times, missing });
    } catch {
      setStep({ kind: 'start', message: 'That photo could not be read. Please try another one.' });
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setStep({
            kind: 'start',
            message: permission.canAskAgain
              ? 'The camera is needed to take the photo.'
              : 'The camera is turned off for this app. You can turn it on in your phone settings.',
          });
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: true };
      const result =
        source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const uri = result.canceled ? null : result.assets[0]?.uri;
      if (uri) await read(uri);
    } catch {
      setStep({ kind: 'start', message: 'The photo could not be opened. Please try again.' });
    }
  };

  const edit = (prayer: PrayerKey) => {
    if (step.kind !== 'review') return;
    const current = step.found[prayer] ?? expected[prayer];
    DateTimePickerAndroid.open({
      // The picker shows the phone's local time; build a Date whose local hours are the board time.
      value: new Date(2000, 0, 1, Math.floor(current / 60), current % 60),
      mode: 'time',
      is24Hour: settings.hour24,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        const minutes = date.getHours() * 60 + date.getMinutes();
        setStep((prev) => {
          if (prev.kind !== 'review') return prev;
          const found = { ...prev.found, [prayer]: minutes };
          return { ...prev, found, missing: PRAYERS.filter((p) => found[p] === null).length };
        });
      },
    });
  };

  const differences = (found: Found) =>
    Object.fromEntries(
      PRAYERS.map((p) => {
        const value = found[p];
        return [p, value === null ? null : value - expected[p]];
      }),
    ) as Record<PrayerKey, number | null>;

  const save = () => {
    if (step.kind !== 'review') return;
    const diff = differences(step.found);
    updateSettings((prev) => {
      const adjust = { ...prev.adjust };
      for (const prayer of PRAYERS) {
        const d = diff[prayer];
        if (d !== null) adjust[prayer] = Math.max(-ADJUST_LIMIT, Math.min(ADJUST_LIMIT, d));
      }
      return { ...prev, adjust };
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    navigation.goBack();
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
      >
        <MaterialCommunityIcons name="arrow-left" size={26} color={colors.text} />
      </Pressable>
      <Text style={[type.title, { color: colors.text }]}>Mosque board</Text>
    </View>
  );

  if (!place) {
    return (
      <Screen>
        {header}
        <Text style={[type.body, { color: colors.textMuted }]}>
          Choose your place first, so the board can be compared with the right times.
        </Text>
        <Button title="Choose your place" onPress={() => navigation.navigate('Place')} style={styles.main} />
      </Screen>
    );
  }

  if (step.kind === 'reading') {
    return (
      <Screen>
        {header}
        <Image source={{ uri: step.uri }} style={[styles.photo, { borderColor: colors.border }]} resizeMode="cover" />
        <View style={styles.reading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[type.body, { color: colors.textMuted }]}>Reading the board...</Text>
        </View>
      </Screen>
    );
  }

  if (step.kind === 'review') {
    const diff = differences(step.found);
    return (
      <Screen style={styles.page}>
        {header}
        <Image source={{ uri: step.uri }} style={[styles.photo, { borderColor: colors.border }]} resizeMode="cover" />
        <Text style={[type.body, styles.intro, { color: colors.textMuted }]}>
          Check the times against the board. Tap a time to change it.
        </Text>

        <View style={[styles.list, { borderColor: colors.border }]}>
          {PRAYERS.map((prayer, index) => {
            const value = step.found[prayer];
            const d = diff[prayer];
            const atText = value === null ? 'Not found' : clock(midnight + value * 60_000, settings.hour24);
            return (
              <Pressable
                key={prayer}
                accessibilityRole="button"
                accessibilityLabel={`${PRAYER_NAMES[prayer]}: ${atText}. Change`}
                onPress={() => edit(prayer)}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{PRAYER_NAMES[prayer]}</Text>
                  <Text style={[type.small, { color: colors.textMuted }]}>
                    {d === null
                      ? 'Keeps your current time. Tap to enter it'
                      : d === 0
                        ? 'Same as the calculated time'
                        : `${signedMinutes(d)} from the calculated time`}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.time,
                    type.numeric,
                    { color: value === null ? colors.textFaint : colors.text },
                  ]}
                >
                  {atText}
                </Text>
                <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </View>

        {PRAYERS.some((p) => {
          const d = diff[p];
          return d !== null && Math.abs(d) > ADJUST_LIMIT;
        }) ? (
          <Text style={[type.small, styles.note, { color: colors.warning }]}>
            A time is more than an hour from the calculated one, so it is set as close as allowed. Please check it.
          </Text>
        ) : null}

        <View style={styles.spacer} />
        <Text style={[type.small, styles.note, { color: colors.textMuted }]}>
          Your alarms will follow these times. The app keeps the same difference every day, as the times move with the
          seasons.
        </Text>
        <Button title="Use these times" onPress={save} style={styles.main} />
        <Button title="Take another photo" variant="secondary" onPress={() => pick('camera')} style={styles.second} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.page}>
      {header}
      <View style={[styles.illustration, { backgroundColor: colors.accentSoft }]}>
        <MaterialCommunityIcons name="camera-outline" size={40} color={colors.accent} />
      </View>
      <Text style={[type.heading, { color: colors.text }]}>Take a photo of the prayer board</Text>
      <Text style={[type.body, styles.intro, { color: colors.textMuted }]}>
        At your mosque, take a clear photo of the board with today&apos;s prayer times. The app reads the times on your
        phone and sets your alarms to match the mosque.
      </Text>
      <View style={styles.tips}>
        {[
          'Stand straight in front of the board',
          'Avoid glare and reflections',
          'Crop to just the times if you can',
        ].map((tip) => (
          <View key={tip} style={styles.tip}>
            <MaterialCommunityIcons name="check" size={18} color={colors.accent} />
            <Text style={[type.small, { color: colors.textMuted, flex: 1 }]}>{tip}</Text>
          </View>
        ))}
      </View>

      {step.message ? (
        <View style={[styles.message, { borderColor: colors.warning }]}>
          <Text style={[type.body, { color: colors.text }]}>{step.message}</Text>
          {step.message.includes('phone settings') ? (
            <Button title="Open settings" variant="secondary" onPress={() => Linking.openSettings().catch(() => {})} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.spacer} />
      <Text style={[type.small, styles.note, { color: colors.textFaint }]}>
        Times more than {BOARD_WINDOW} minutes from today&apos;s calculated times are ignored. Nothing leaves your phone.
      </Text>
      <Button title="Take a photo" onPress={() => pick('camera')} style={styles.main} />
      <Button title="Choose a photo" variant="secondary" onPress={() => pick('library')} style={styles.second} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  illustration: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  intro: { marginTop: spacing.sm },
  tips: { marginTop: spacing.lg, gap: spacing.sm },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  message: { marginTop: spacing.lg, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  photo: { width: '100%', height: 180, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  reading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  list: { marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  time: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  note: { marginTop: spacing.sm },
  spacer: { flex: 1, minHeight: spacing.xl },
  main: { marginTop: spacing.md },
  second: { marginTop: spacing.sm },
});
