import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabContext, type TabKey } from '@/lib/tabs';
import { HomeScreen } from '@/screens/HomeScreen';
import { QiblaScreen } from '@/screens/QiblaScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { spacing, useColors } from '@/theme';

const TABS: { key: TabKey; label: string; icon: 'mosque' | 'compass-outline' | 'cog-outline' }[] = [
  { key: 'prayers', label: 'Prayer times', icon: 'mosque' },
  { key: 'qibla', label: 'Qibla', icon: 'compass-outline' },
  { key: 'settings', label: 'Settings', icon: 'cog-outline' },
];

/** The three main pages with a bar of icons at the bottom. */
export function MainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('prayers');
  const context = useMemo(() => ({ tab, setTab }), [tab]);

  // The back button returns to the prayer times before it leaves the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'prayers') return false;
      setTab('prayers');
      return true;
    });
    return () => sub.remove();
  }, [tab]);

  return (
    <TabContext.Provider value={context}>
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <View style={styles.fill}>
          {tab === 'prayers' ? <HomeScreen /> : tab === 'qibla' ? <QiblaScreen /> : <SettingsScreen />}
        </View>
        <View
          accessibilityRole="tablist"
          style={[
            styles.bar,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (active) return;
                  Haptics.selectionAsync().catch(() => {});
                  setTab(item.key);
                }}
                style={styles.item}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.pill,
                      active && { backgroundColor: colors.accentSoft },
                      pressed && !active && { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <MaterialCommunityIcons name={item.icon} size={26} color={active ? colors.accent : colors.textMuted} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </TabContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  // A fixed radius of half the height: a very large radius can draw square corners on Android.
  pill: { width: 64, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
