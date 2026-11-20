import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/Button';
import { AccuracyLine, CalibrationSheet } from '@/components/CompassCalibration';
import { Screen } from '@/components/Screen';
import { compassWord, distanceToKaaba, qiblaBearing, turnBetween } from '@/lib/qibla';
import { useSettings } from '@/lib/settings';
import { spacing, type, useColors } from '@/theme';

/** Within this many degrees the phone counts as facing the Qibla. */
const ALIGNED = 4;
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);
const CARDINALS = [
  { angle: 0, label: 'N' },
  { angle: 90, label: 'E' },
  { angle: 180, label: 'S' },
  { angle: 270, label: 'W' },
];

type Status = 'starting' | 'ready' | 'no-permission' | 'blocked' | 'no-compass';

/** A compass that turns with the phone and shows where the Kaaba is. */
export function QiblaScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const [settings] = useSettings();
  const { width } = useWindowDimensions();
  const size = Math.min(width - spacing.lg * 2, 320);

  const [status, setStatus] = useState<Status>('starting');
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState(3);
  // Where the phone is, when location is allowed: the most exact direction.
  const [phone, setPhone] = useState<{ latitude: number; longitude: number } | null>(null);
  const chosen = settings.place;
  const place = phone ?? chosen;
  const [attempt, setAttempt] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const closeCalibration = useCallback(() => setCalibrating(false), []);

  const [rotation] = useState(() => new Animated.Value(0));
  const shown = useRef(0); // the dial's angle so far, without jumping from 359 back to 0
  const smooth = useRef<{ x: number; y: number } | null>(null);
  const wasAligned = useRef(false);

  const qibla = place ? qiblaBearing(place.latitude, place.longitude) : null;
  const km = place ? distanceToKaaba(place.latitude, place.longitude) : null;

  useEffect(() => {
    let alive = true;
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (!permission.granted) {
          setStatus(permission.canAskAgain ? 'no-permission' : 'blocked');
          return;
        }
        // Where the phone is, for an exact direction. The chosen place is used until (or unless) it is known.
        Location.getLastKnownPositionAsync()
          .then((last) => last ?? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
          .then((pos) => {
            if (alive && pos) setPhone({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          })
          .catch(() => {});

        subscription = await Location.watchHeadingAsync(
          (reading) => {
            const raw = reading.trueHeading >= 0 ? reading.trueHeading : reading.magHeading;
            if (!Number.isFinite(raw)) return;
            // Smooth out the shaking of the compass sensor.
            const x = Math.cos((raw * Math.PI) / 180);
            const y = Math.sin((raw * Math.PI) / 180);
            const prev = smooth.current;
            const next = prev ? { x: prev.x * 0.75 + x * 0.25, y: prev.y * 0.75 + y * 0.25 } : { x, y };
            smooth.current = next;
            const value = ((Math.atan2(next.y, next.x) * 180) / Math.PI + 360) % 360;
            setHeading(value);
            if (typeof reading.accuracy === 'number') setAccuracy(reading.accuracy);
            setStatus('ready');
          },
          () => {
            if (alive) setStatus('no-compass');
          },
        );
        if (!alive) subscription.remove();
      } catch {
        if (alive) setStatus('no-compass');
      }
    })();

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [attempt]);

  // Turn the dial so that north on it points to real north.
  useEffect(() => {
    if (heading === null) return;
    // The dial turns the other way to the phone. Take the short way round (no spin from 359 to 0).
    const target = shown.current + turnBetween(shown.current, -heading);
    shown.current = target;
    Animated.timing(rotation, {
      toValue: target,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heading, rotation]);

  const turn = heading === null || qibla === null ? null : turnBetween(heading, qibla);
  const aligned = turn !== null && Math.abs(turn) <= ALIGNED;

  useEffect(() => {
    if (aligned && !wasAligned.current) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    wasAligned.current = aligned;
  }, [aligned]);

  const allow = async () => {
    if (status === 'blocked') {
      Linking.openSettings().catch(() => {});
      return;
    }
    setStatus('starting');
    setAttempt((n) => n + 1);
  };

  const spin = rotation.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
  const markColor = aligned ? colors.accent : colors.text;

  const message =
    status === 'no-permission' || status === 'blocked'
      ? 'The compass needs your location to point the right way.'
      : status === 'no-compass'
        ? 'This phone does not seem to have a compass.'
        : null;

  return (
    <Screen insetBottom={false} style={styles.page}>
      <Text style={[type.title, { color: colors.text }]}>Qibla</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>
        {phone ? 'From where you are' : chosen ? `From ${chosen.name}` : 'Choose your place to see the Qibla'}
      </Text>

      <View style={styles.center}>
        <MaterialCommunityIcons
          name="triangle"
          size={18}
          color={aligned ? colors.accent : colors.textFaint}
          style={styles.pointer}
        />
        <View style={{ width: size, height: size }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.dial,
              { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: size / 2 },
              { transform: [{ rotate: spin }] },
            ]}
          >
            {TICKS.map((angle) => (
              <View key={angle} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }] }]}>
                <View
                  style={[
                    styles.tick,
                    {
                      height: angle % 30 === 0 ? 14 : 7,
                      backgroundColor: angle % 90 === 0 ? colors.textMuted : colors.border,
                      left: size / 2 - 1,
                    },
                  ]}
                />
              </View>
            ))}
            {CARDINALS.map((c) => (
              <View key={c.label} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${c.angle}deg` }] }]}>
                <Text
                  style={[
                    type.bodyStrong,
                    styles.cardinal,
                    { color: c.label === 'N' ? colors.danger : colors.textMuted, width: size },
                  ]}
                >
                  {c.label}
                </Text>
              </View>
            ))}
            {/* The needle to the Kaaba. */}
            {qibla !== null ? (
              <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${qibla}deg` }] }]}>
                <View
                  style={[
                    styles.needle,
                    { left: size / 2 - 1.5, top: size * 0.2, height: size * 0.3, backgroundColor: markColor },
                  ]}
                />
                <View style={[styles.kaaba, { left: size / 2 - 13, top: size * 0.2 - 30, backgroundColor: markColor }]}>
                  <View style={[styles.kaabaBand, { backgroundColor: colors.warning }]} />
                </View>
              </View>
            ) : null}
          </Animated.View>

          <View style={[styles.hub, { left: size / 2 - 6, top: size / 2 - 6, backgroundColor: markColor }]} />
        </View>
      </View>

      {message ? (
        <View style={styles.status}>
          <Text style={[type.heading, styles.statusText, { color: colors.text }]}>{message}</Text>
          {status !== 'no-compass' ? (
            <Button
              title={status === 'blocked' ? 'Open settings' : 'Allow location'}
              onPress={allow}
              style={styles.button}
            />
          ) : null}
          {chosen && qibla !== null ? (
            <Text style={[type.small, styles.statusText, { color: colors.textMuted }]}>
              From {chosen.name} the Qibla is {Math.round(qibla)} degrees from north ({compassWord(qibla)}).
            </Text>
          ) : (
            <Button title="Choose your place" variant="secondary" onPress={() => navigation.navigate('Place')} />
          )}
        </View>
      ) : (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <Text style={[type.title, styles.statusText, { color: aligned ? colors.accent : colors.text }]}>
            {qibla === null
              ? 'No place chosen yet'
              : turn === null
                ? 'Finding north...'
                : aligned
                  ? 'Facing the Qibla'
                  : `Turn ${turn > 0 ? 'right' : 'left'} ${Math.round(Math.abs(turn))}°`}
          </Text>
          {qibla !== null && km !== null ? (
            <Text style={[type.small, type.numeric, styles.statusText, { color: colors.textMuted }]}>
              Qibla {Math.round(qibla)}° from north. Makkah is {Math.round(km).toLocaleString('en-US')} km away.
            </Text>
          ) : (
            <Button title="Choose your place" variant="secondary" onPress={() => navigation.navigate('Place')} />
          )}
          {status === 'ready' ? (
            <AccuracyLine accuracy={accuracy} onImprove={() => setCalibrating(true)} />
          ) : (
            <Text style={[type.small, styles.statusText, { color: colors.textFaint }]}>
              Hold your phone flat, away from metal and magnets.
            </Text>
          )}
        </View>
      )}

      <CalibrationSheet visible={calibrating && status === 'ready'} accuracy={accuracy} onClose={closeCalibration} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1 },
  center: { alignItems: 'center', marginTop: spacing.xl },
  pointer: { transform: [{ rotate: '180deg' }], marginBottom: spacing.xs },
  dial: { borderWidth: StyleSheet.hairlineWidth },
  tick: { position: 'absolute', top: 6, width: 2, borderRadius: 1 },
  cardinal: { position: 'absolute', top: 22, left: 0, textAlign: 'center' },
  needle: { position: 'absolute', width: 3, borderRadius: 1.5 },
  kaaba: { position: 'absolute', width: 26, height: 26, borderRadius: 3, overflow: 'hidden' },
  kaabaBand: { position: 'absolute', left: 0, right: 0, top: 6, height: 4 },
  hub: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  status: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.sm },
  statusText: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginVertical: spacing.sm },
});
