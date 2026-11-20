import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, type, useColors } from '@/theme';

export type ChoiceOption<T extends string> = { value: T; label: string; detail?: string };

type Props<T extends string> = {
  /** Shown on the row and as the title of the list. */
  title: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  first?: boolean;
};

/** A settings row that shows the current choice; tapping it opens the list to pick another. */
export function Choice<T extends string>({ title, value, options, onChange, first }: Props<T>) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current.label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.row,
          !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
          pressed && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        <View style={styles.rowText}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
          <Text style={[type.small, { color: colors.textMuted }]}>{current.label}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <Text style={[type.heading, styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <ScrollView>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setOpen(false);
                    if (!selected) onChange(option.value);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    selected && { backgroundColor: colors.accentSoft },
                    pressed && !selected && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={[type.bodyStrong, { color: selected ? colors.accent : colors.text }]}>{option.label}</Text>
                    {option.detail ? (
                      <Text style={[type.small, { color: colors.textMuted }]}>{option.detail}</Text>
                    ) : null}
                  </View>
                  {selected ? <MaterialCommunityIcons name="check" size={22} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, paddingVertical: spacing.sm + 2 },
  rowText: { flex: 1, gap: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sheetTitle: { paddingHorizontal: spacing.sm, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
});
