import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, type, useColors } from '@/theme';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** What the number is, for screen readers: "First reminder". */
  label: string;
  /** How the value is written between the buttons. Defaults to the plain number. */
  format?: (value: number) => string;
};

type Timers = { repeat?: ReturnType<typeof setInterval> };

/** A number with large minus and plus buttons. Hold a button to change it quickly. */
export function Stepper({ value, min, max, onChange, label, format }: Props) {
  const colors = useColors();
  const latest = useRef(value);
  const timers = useRef<Timers>({});

  useEffect(() => {
    latest.current = value;
  }, [value]);

  const stop = () => {
    clearInterval(timers.current.repeat);
    timers.current = {};
  };

  useEffect(() => {
    const held = timers;
    return () => {
      clearInterval(held.current.repeat);
    };
  }, []);

  const step = (by: number) => {
    const next = Math.min(max, Math.max(min, latest.current + by));
    if (next === latest.current) {
      stop();
      return;
    }
    latest.current = next;
    onChange(next);
  };

  const once = (by: number) => {
    Haptics.selectionAsync().catch(() => {});
    step(by);
  };

  // Holding a button keeps counting until it is let go.
  const hold = (by: number) => {
    stop();
    once(by);
    timers.current.repeat = setInterval(() => step(by), 90);
  };

  const button = (by: number, icon: 'minus' | 'plus', disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${by < 0 ? 'less' : 'more'}`}
      disabled={disabled}
      onPress={() => once(by)}
      onLongPress={() => hold(by)}
      delayLongPress={350}
      onPressOut={stop}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surfaceMuted, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {button(-1, 'minus', value <= min)}
      <Text style={[type.bodyStrong, type.numeric, styles.value, { color: colors.text }]}>
        {format ? format(value) : String(value)}
      </Text>
      {button(1, 'plus', value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  button: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 68, textAlign: 'center' },
});
