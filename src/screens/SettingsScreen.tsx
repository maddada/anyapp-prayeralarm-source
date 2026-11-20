import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { ThisAppSection } from '@/components/ChangeThisApp';
import { Choice } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { ensureAlarmPermission, stopAlarmSound, testAlarm } from '@/lib/alarms';
import { clock, minutesWords, signedDays, signedMinutes } from '@/lib/format';
import { hijriText } from '@/lib/hijri';
import { coordinatesText } from '@/lib/places';
import { METHODS, PRAYERS, PRAYER_NAMES, localDay, methodById, type PrayerKey } from '@/lib/prayerTimes';
import { reminderSpeech, timesFor } from '@/lib/schedule';
import { ADHAN_SOUNDS, adhanEndMs, adhanSoundById, type AdhanLength } from '@/lib/sounds';
import {
  ADJUST_LIMIT,
  HIJRI_CORRECTION_LIMIT,
  REMINDER_MAX,
  REMINDER_MIN,
  updateSettings,
  useSettings,
} from '@/lib/settings';
import { getSettingsTab, setSettingsTab, type SettingsTab } from '@/lib/tabs';
import { useSoundPlaying } from '@/lib/useSoundPlaying';
import { radius, spacing, type, useColors } from '@/theme';

function Section({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      {title ? <Text style={[type.label, styles.sectionTitle, { color: colors.textFaint }]}>{title}</Text> : null}
      <View style={[styles.group, { borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

function Row({ title, detail, first, children }: { title: string; detail?: string; first?: boolean; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
      <View style={styles.rowText}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[type.small, type.numeric, { color: colors.textMuted }]}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'alarms', label: 'Alarms' },
  { key: 'times', label: 'Times' },
  { key: 'display', label: 'Display' },
  { key: 'about', label: 'About' },
];

/** Three tabs in a muted track; the chosen one sits raised on the surface colour. */
function Segmented({ value, onChange }: { value: SettingsTab; onChange: (tab: SettingsTab) => void }) {
  const colors = useColors();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      {TABS.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={[
              styles.segment,
              active && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                type.body,
                styles.segmentText,
                { color: active ? colors.accent : colors.textMuted, fontWeight: active ? '700' : '500' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Reminders, the adhan, the user's own minutes for each prayer, and the clock style. */
export function SettingsScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const [settings] = useSettings();
  const playing = useSoundPlaying();
  const shortAdhan = settings.adhanLength === 'short';
  const chosenSound = adhanSoundById(settings.adhanSound);

  const [tab, setTab] = useState<SettingsTab>(getSettingsTab);
  const chooseTab = (next: SettingsTab) => {
    if (next === tab) return;
    Haptics.selectionAsync().catch(() => {});
    setSettingsTab(next);
    setTab(next);
  };

  const [opened] = useState(() => Date.now());
  const place = settings.place;
  const times = place ? timesFor(localDay(opened), place, settings) : null;
  const adjusted = PRAYERS.some((prayer) => settings.adjust[prayer] !== 0);
  const switchColors = { false: colors.border, true: colors.accent };

  const setAdjust = (prayer: PrayerKey, minutes: number) =>
    updateSettings((prev) => ({ ...prev, adjust: { ...prev.adjust, [prayer]: minutes } }));

  const play = async (kind: 'adhan' | 'reminder') => {
    try {
      await ensureAlarmPermission();
      if (kind === 'adhan') {
        const sound = adhanSoundById(settings.adhanSound);
        await testAlarm({
          id: 'test-adhan',
          title: `Adhan: ${sound.name}`,
          body: 'This is how the adhan sounds.',
          sound: sound.id,
          soundEndMs: adhanEndMs(sound.id, settings.adhanLength),
          fullScreen: false,
        });
      } else {
        await testAlarm({
          id: 'test-reminder',
          title: `Asr in ${minutesWords(settings.firstMinutes)}`,
          body: 'This is how a reminder sounds.',
          speak: reminderSpeech('Asr', settings.firstMinutes),
          language: 'en-US',
          fullScreen: false,
        });
      }
    } catch (error) {
      console.warn('Could not play the test sound', error);
    }
  };

  return (
    <Screen insetBottom={false}>
      <View style={styles.header}>
        <Text style={[type.title, { color: colors.text }]}>Settings</Text>
      </View>

      <Segmented value={tab} onChange={chooseTab} />

      {tab === 'alarms' ? (
        <>
          <Section>
            <Row first title="Reminders and adhan" detail={settings.enabled ? 'On' : 'Off: nothing will sound'}>
              <Switch
                value={settings.enabled}
                onValueChange={(enabled) => updateSettings((prev) => ({ ...prev, enabled }))}
                trackColor={switchColors}
                thumbColor={colors.surface}
              />
            </Row>
          </Section>

          <Section title="REMINDERS">
            <Row first title="First reminder" detail="Minutes before">
              <Stepper
                label="First reminder"
                value={settings.firstMinutes}
                min={REMINDER_MIN}
                max={REMINDER_MAX}
                onChange={(firstMinutes) => updateSettings((prev) => ({ ...prev, firstMinutes }))}
              />
            </Row>
            <Row title="Second reminder" detail="Minutes before">
              <Stepper
                label="Second reminder"
                value={settings.secondMinutes}
                min={REMINDER_MIN}
                max={REMINDER_MAX}
                onChange={(secondMinutes) => updateSettings((prev) => ({ ...prev, secondMinutes }))}
              />
            </Row>
          </Section>
          <Text style={[type.small, styles.note, { color: colors.textMuted }]}>
            Spoken out loud, also when the app is closed. Hold + or - to change faster.
          </Text>

          <Section title="ADHAN">
            <Choice
              first
              title="Adhan"
              value={settings.adhanSound}
              options={ADHAN_SOUNDS.map((sound) => ({
                value: sound.id,
                label: sound.name,
                detail: `${sound.detail}. ${shortAdhan ? sound.short : sound.full}`,
              }))}
              onChange={(adhanSound) => updateSettings((prev) => ({ ...prev, adhanSound }))}
            />
            <Choice<AdhanLength>
              title="Adhan length"
              value={settings.adhanLength}
              options={[
                { value: 'short', label: 'Short (first Allahu akbar)', detail: `${chosenSound.name}: ${chosenSound.short}` },
                { value: 'full', label: 'Full adhan', detail: `${chosenSound.name}: ${chosenSound.full}` },
              ]}
              onChange={(adhanLength) => updateSettings((prev) => ({ ...prev, adhanLength }))}
            />
            <View style={[styles.buttons, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
              {playing ? (
                <Button title="Stop the sound" style={styles.half} onPress={() => stopAlarmSound().catch(() => {})} />
              ) : (
                <>
                  <Button title="Play adhan" variant="secondary" style={styles.half} onPress={() => play('adhan')} />
                  <Button title="Hear reminder" variant="secondary" style={styles.half} onPress={() => play('reminder')} />
                </>
              )}
            </View>
          </Section>
          <Text style={[type.small, styles.note, { color: colors.textMuted }]}>
            Uses your alarm volume. Turn the phone face down to stop.
          </Text>
        </>
      ) : null}

      {tab === 'times' ? (
        <>
          <Section title="PLACE">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={place ? `Place: ${place.name}. Change it` : 'Choose your place'}
              onPress={() => navigation.navigate('Place')}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={24} color={colors.accent} />
              <View style={styles.rowText}>
                <Text style={[type.bodyStrong, { color: colors.text }]}>{place ? place.name : 'Choose your place'}</Text>
                <Text style={[type.small, type.numeric, { color: colors.textMuted }]}>
                  {place
                    ? coordinatesText(place.latitude, place.longitude)
                    : 'Your location, a capital city, or coordinates'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textFaint} />
            </Pressable>
          </Section>

          <Section title="CALCULATION">
            <Choice
              first
              title="Calculation method"
              value={settings.method}
              options={METHODS.map((method) => ({ value: method.id, label: method.name, detail: method.detail }))}
              onChange={(method) => updateSettings((prev) => ({ ...prev, method }))}
            />
            <Choice
              title="Asr time"
              value={settings.asrSchool}
              options={[
                { value: 'standard', label: 'Standard', detail: 'Shafi, Maliki and Hanbali' },
                { value: 'hanafi', label: 'Hanafi', detail: 'Later Asr, when the shadow is twice as long' },
              ]}
              onChange={(asrSchool) => updateSettings((prev) => ({ ...prev, asrSchool }))}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Board')}
              style={({ pressed }) => [
                styles.row,
                { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <MaterialCommunityIcons name="camera-outline" size={24} color={colors.accent} />
              <View style={styles.rowText}>
                <Text style={[type.bodyStrong, { color: colors.text }]}>Match my mosque</Text>
                <Text style={[type.small, { color: colors.textMuted }]}>Take a photo of the prayer board</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textFaint} />
            </Pressable>
          </Section>

          <Section title="YOUR ADJUSTMENTS">
            {PRAYERS.map((prayer, index) => (
              <Row
                key={prayer}
                first={index === 0}
                title={PRAYER_NAMES[prayer]}
                detail={times ? clock(times[prayer], settings.hour24) : undefined}
              >
                <Stepper
                  label={`${PRAYER_NAMES[prayer]} adjustment`}
                  value={settings.adjust[prayer]}
                  min={-ADJUST_LIMIT}
                  max={ADJUST_LIMIT}
                  format={signedMinutes}
                  onChange={(minutes) => setAdjust(prayer, minutes)}
                />
              </Row>
            ))}
          </Section>
          <Text style={[type.small, styles.note, { color: colors.textMuted }]}>
            Minutes added or taken away, on top of {methodById(settings.method).name}. Times shown are today&apos;s.
          </Text>
          {adjusted ? (
            <Button
              title="Back to the official times"
              variant="secondary"
              style={styles.reset}
              onPress={() =>
                updateSettings((prev) => ({ ...prev, adjust: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } }))
              }
            />
          ) : null}
        </>
      ) : null}

      {tab === 'display' ? (
        <>
          <Section title="NOTIFICATION">
            <Row
              first
              title="Next prayer in the status bar"
              detail="Today's times in your notifications, and the next prayer's time at the top of the screen"
            >
              <Switch
                value={settings.statusBar}
                onValueChange={(statusBar) => updateSettings((prev) => ({ ...prev, statusBar }))}
                trackColor={switchColors}
                thumbColor={colors.surface}
              />
            </Row>
          </Section>

          <Section title="ISLAMIC DATE">
            <Row first title="Correct the date" detail={hijriText(opened, settings.hijriCorrection) || 'Not available'}>
              <Stepper
                label="Islamic date correction"
                value={settings.hijriCorrection}
                min={-HIJRI_CORRECTION_LIMIT}
                max={HIJRI_CORRECTION_LIMIT}
                format={signedDays}
                onChange={(hijriCorrection) => updateSettings((prev) => ({ ...prev, hijriCorrection }))}
              />
            </Row>
          </Section>
          <Text style={[type.small, styles.note, { color: colors.textMuted }]}>
            A month begins when the new moon is seen, so the date can be a day off. Move it here if it is.
          </Text>

          <Section title="CLOCK">
            <Row first title="24-hour clock" detail={settings.hour24 ? '17:35' : '5:35 PM'}>
              <Switch
                value={settings.hour24}
                onValueChange={(hour24) => updateSettings((prev) => ({ ...prev, hour24 }))}
                trackColor={switchColors}
                thumbColor={colors.surface}
              />
            </Row>
          </Section>
        </>
      ) : null}

      {tab === 'about' ? (
        <>
          <Text style={[type.body, styles.about, { color: colors.textMuted }]}>
            {place ? `Times are for ${place.name}. ` : 'Choose your place in Times to see the prayer times. '}
            The reminders and the adhan keep going by themselves every day, also when the app stays closed.
          </Text>

          <View style={styles.section}>
            <Text style={[type.label, styles.sectionTitle, { color: colors.textFaint }]}>ADHAN RECORDINGS</Text>
            <View style={styles.credits}>
              {ADHAN_SOUNDS.map((sound) => (
                <Text key={sound.id} style={[type.small, { color: colors.textFaint }]}>
                  {sound.credit}
                </Text>
              ))}
            </View>
          </View>

          {/* Built in: "This app" with Change this app stays last in Settings (see AGENTS.md). */}
          <ThisAppSection />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: spacing.sm },
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.md, marginTop: spacing.md, gap: 4 },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: spacing.xs,
  },
  segmentText: { fontSize: 15 },
  section: { marginTop: spacing.xl },
  sectionTitle: { marginBottom: spacing.sm },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, paddingVertical: spacing.sm + 2 },
  rowText: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  half: { flex: 1, paddingHorizontal: spacing.sm },
  note: { marginTop: spacing.sm },
  reset: { marginTop: spacing.md },
  about: { marginTop: spacing.xl },
  credits: { gap: spacing.sm },
});
