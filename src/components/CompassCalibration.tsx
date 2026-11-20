import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { diary } from '@/lib/diary';
import { radius, spacing, type, useColors, type Colors } from '@/theme';

export type AccuracyLevel = 'good' | 'fair' | 'low';

/** Android reports the compass accuracy as 3 high, 2 medium, 1 low, 0 (or less) unreliable. */
export function accuracyLevel(accuracy: number): AccuracyLevel {
  if (accuracy >= 3) return 'good';
  if (accuracy === 2) return 'fair';
  return 'low';
}

const WORDS: Record<AccuracyLevel, string> = { good: 'Good', fair: 'Fair', low: 'Low' };

function levelColor(level: AccuracyLevel, colors: Colors): string {
  return level === 'good' ? colors.success : level === 'fair' ? colors.warning : colors.danger;
}

/** The accuracy line under the compass, with a way to calibrate when it is not good. */
export function AccuracyLine({ accuracy, onImprove }: { accuracy: number; onImprove: () => void }) {
  const colors = useColors();
  const level = accuracyLevel(accuracy);

  if (level === 'low') {
    return (
      <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
          <Text style={[type.bodyStrong, { color: colors.text }]}>Compass accuracy is low</Text>
        </View>
        <Text style={[type.small, { color: colors.textMuted }]}>
          The direction may be off. A quick calibration fixes it.
        </Text>
        <Button title="Improve accuracy" onPress={onImprove} style={styles.noticeButton} />
      </View>
    );
  }

  return (
    <View style={styles.line}>
      <View style={styles.row} accessible accessibilityLabel={`Compass accuracy: ${WORDS[level]}`}>
        <View style={[styles.dot, { backgroundColor: levelColor(level, colors) }]} />
        <Text style={[type.small, { color: colors.textMuted }]}>
          Compass accuracy: <Text style={{ color: colors.text, fontWeight: '600' }}>{WORDS[level]}</Text>
        </Text>
      </View>
      {level === 'fair' ? (
        <Pressable accessibilityRole="button" onPress={onImprove} hitSlop={12} style={styles.link}>
          <Text style={[type.small, styles.linkText, { color: colors.accent }]}>Improve accuracy</Text>
        </Pressable>
      ) : (
        <Text style={[type.small, styles.center, { color: colors.textFaint }]}>
          Hold your phone flat, away from metal and magnets.
        </Text>
      )}
    </View>
  );
}

/** A sheet that shows how to calibrate the compass, with the live accuracy. */
export function CalibrationSheet({
  visible,
  accuracy,
  onClose,
}: {
  visible: boolean;
  accuracy: number;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {visible ? <CalibrationBody accuracy={accuracy} onClose={onClose} /> : null}
      </View>
    </Modal>
  );
}

/** Mounted only while the sheet is open, so each opening starts fresh. */
function CalibrationBody({ accuracy, onClose }: { accuracy: number; onClose: () => void }) {
  const colors = useColors();
  const level = accuracyLevel(accuracy);
  // Once the compass is good, stay "done" even if the reading dips again for a moment.
  const [done, setDone] = useState(false);
  if (level === 'good' && !done) setDone(true);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    diary('Compass calibration opened');
  }, []);

  useEffect(() => {
    if (!done) return;
    diary('Compass accuracy good after calibration');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const timer = setTimeout(() => close.current(), 2500);
    return () => clearTimeout(timer);
  }, [done]);

  return (
    <View style={styles.body}>
      <Text style={[type.heading, { color: colors.text }]}>Calibrate the compass</Text>

      <FigureEight />

      <Text style={[type.body, { color: colors.text }]}>
        Hold your phone and move it in a figure 8, turning your wrist, a few times.
      </Text>
      <Text style={[type.small, { color: colors.textMuted }]}>Keep away from metal, magnets and other phones.</Text>

      <View
        style={[styles.live, { backgroundColor: done ? colors.accentSoft : colors.surfaceMuted }]}
        accessibilityLiveRegion="polite"
      >
        {done ? (
          <Text style={[type.bodyStrong, { color: colors.success }]}>Done, the compass is accurate now</Text>
        ) : (
          <>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: levelColor(level, colors) }]} />
              <Text style={[type.bodyStrong, { color: colors.text }]}>Compass accuracy: {WORDS[level]}</Text>
            </View>
            <Meter level={level} />
          </>
        )}
      </View>

      <View style={styles.actions}>
        {done ? <Button title="Done" onPress={onClose} /> : <Button title="Close" variant="secondary" onPress={onClose} />}
      </View>
    </View>
  );
}

/** Three short bars: one for low, two for fair, three for good. */
function Meter({ level }: { level: AccuracyLevel }) {
  const colors = useColors();
  const filled = level === 'good' ? 3 : level === 'fair' ? 2 : 1;
  return (
    <View style={styles.meter}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.bar, { backgroundColor: i < filled ? levelColor(level, colors) : colors.border }]}
        />
      ))}
    </View>
  );
}

// The figure 8 (a lemniscate), sampled once. x in -1..1, y in about -0.35..0.35.
const PATH_STEPS = 96;
const MOTION_STEPS = 48;

function lemniscate(t: number) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const d = 1 + s * s;
  return { x: c / d, y: (s * c) / d };
}

const PATH = Array.from({ length: PATH_STEPS + 1 }, (_, i) => lemniscate((i / PATH_STEPS) * Math.PI * 2));

// Where the phone is at each step of the loop, and how much it leans (following the path, gently).
const MOTION = (() => {
  const points = Array.from({ length: MOTION_STEPS + 1 }, (_, i) => {
    const t = (i / MOTION_STEPS) * Math.PI * 2;
    const p = lemniscate(t);
    const q = lemniscate(t + 0.001);
    return { ...p, angle: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
  });
  // Unwrap the angles so the phone never spins from 179 to -179.
  for (let i = 1; i < points.length; i++) {
    let a = points[i].angle;
    while (a - points[i - 1].angle > 180) a -= 360;
    while (a - points[i - 1].angle < -180) a += 360;
    points[i].angle = a;
  }
  const mean = points.reduce((sum, p) => sum + p.angle, 0) / points.length;
  return points.map((p) => ({ x: p.x, y: p.y, lean: (p.angle - mean) * 0.3 }));
})();

const PHONE_W = 28;
const PHONE_H = 48;

/** A calm, looping drawing: a phone moving along a figure 8 and turning as it goes. */
function FigureEight() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const w = Math.min(width - spacing.lg * 4, 300);
  const half = w / 2 - PHONE_W / 2;
  const h = half * 0.72 + PHONE_H + spacing.md;
  const cx = w / 2;
  const cy = h / 2;

  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const input = MOTION.map((_, i) => i / MOTION_STEPS);
  const translateX = progress.interpolate({ inputRange: input, outputRange: MOTION.map((p) => p.x * half) });
  const translateY = progress.interpolate({ inputRange: input, outputRange: MOTION.map((p) => p.y * half) });
  const rotate = progress.interpolate({ inputRange: input, outputRange: MOTION.map((p) => `${p.lean}deg`) });
  // The wrist turning: the phone tips one way on the left loop and the other way on the right.
  const rotateY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['35deg', '0deg', '-35deg', '0deg', '35deg'],
  });

  return (
    <View style={[styles.figure, { width: w, height: h }]} accessible accessibilityLabel="A phone moving in a figure 8">
      {PATH.slice(0, -1).map((p, i) => {
        const q = PATH[i + 1];
        const x1 = cx + p.x * half;
        const y1 = cy + p.y * half;
        const x2 = cx + q.x * half;
        const y2 = cy + q.y * half;
        const length = Math.hypot(x2 - x1, y2 - y1) + 1;
        const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        return (
          <View
            key={i}
            style={[
              styles.segment,
              {
                width: length,
                left: (x1 + x2) / 2 - length / 2,
                top: (y1 + y2) / 2 - 1.5,
                backgroundColor: colors.accent,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
      <Animated.View
        style={[
          styles.phone,
          {
            left: cx - PHONE_W / 2,
            top: cy - PHONE_H / 2,
            backgroundColor: colors.surface,
            borderColor: colors.text,
            transform: [{ perspective: 500 }, { translateX }, { translateY }, { rotate }, { rotateY }],
          },
        ]}
      >
        <View style={[styles.speaker, { backgroundColor: colors.textFaint }]} />
        <View style={[styles.screen, { backgroundColor: colors.accentSoft }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  link: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkText: { fontWeight: '600' },
  notice: {
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  noticeButton: { alignSelf: 'flex-end', marginTop: spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  body: { gap: spacing.md },
  figure: { alignSelf: 'center', marginVertical: spacing.sm },
  segment: { position: 'absolute', height: 3, borderRadius: 1.5, opacity: 0.45 },
  phone: {
    position: 'absolute',
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    paddingTop: 4,
    gap: 3,
  },
  speaker: { width: 8, height: 2, borderRadius: 1 },
  screen: { width: PHONE_W - 10, flex: 1, marginBottom: 5, borderRadius: 2 },
  live: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, minHeight: 72, justifyContent: 'center' },
  meter: { flexDirection: 'row', gap: spacing.xs },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
