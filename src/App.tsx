// App root: navigation, theme and one-time setup. Add screens to `RootStack` below.
import { DarkTheme, DefaultTheme, createNavigationContainerRef, createStaticNavigation, type StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashBoundary } from '@/components/CrashBoundary';
import { installCrashCatcher, setCurrentScreen } from '@/lib/crash';
import { setupNotifications } from '@/lib/notifications';
import { syncAlarms } from '@/lib/schedule';
import { initSettings, useSettings } from '@/lib/settings';
import { BoardScreen } from '@/screens/BoardScreen';
import { MainScreen } from '@/screens/MainScreen';
import { PlaceScreen } from '@/screens/PlaceScreen';
import { useColors, useIsDark } from '@/theme';

const RootStack = createNativeStackNavigator({
  screens: {
    // Main holds the bottom bar; its third tab is Settings, which ends with "This app" (see AGENTS.md).
    Main: { screen: MainScreen, options: { headerShown: false } },
    Board: { screen: BoardScreen, options: { headerShown: false } },
    Place: { screen: PlaceScreen, options: { headerShown: false } },
  },
});

export type RootStackParamList = StaticParamList<typeof RootStack>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(RootStack);
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Crashes reach Kiwimake, which offers the person a fix (src/lib/crash.ts). Keep this first.
installCrashCatcher();

export default function App() {
  const isDark = useIsDark();
  const colors = useColors();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  const [settings, settingsReady] = useSettings();

  useEffect(() => {
    setupNotifications();
    initSettings().catch(() => {});
  }, []);

  // Keep the alarms on the phone in step with the settings: shortly after any change, every
  // time the app comes to the front, and a few times a day while it stays open.
  useEffect(() => {
    if (!settingsReady) return;
    const sync = () => {
      syncAlarms(settings).catch(() => {});
    };
    const soon = setTimeout(sync, 700);
    const regular = setInterval(sync, 6 * 3600_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      clearTimeout(soon);
      clearInterval(regular);
      appState.remove();
    };
  }, [settings, settingsReady]);

  return (
    <SafeAreaProvider>
      <CrashBoundary>
        <Navigation
          ref={navigationRef}
          theme={theme}
          onStateChange={() => setCurrentScreen(navigationRef.getCurrentRoute()?.name)}
        />
      </CrashBoundary>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
