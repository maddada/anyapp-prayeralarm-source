// Which of the three main pages is showing (prayer times, qibla, settings), shared so a page can
// send the user to another one (for example the alarm summary on the home page opens Settings).
import { createContext, useContext } from 'react';

export type TabKey = 'prayers' | 'qibla' | 'settings';

export const TabContext = createContext<{ tab: TabKey; setTab: (tab: TabKey) => void }>({
  tab: 'prayers',
  setTab: () => {},
});

export function useTabs() {
  return useContext(TabContext);
}

// The part of Settings that shows (Alarms, Times, Display, About). Kept here, outside the screen, so it is
// remembered while the app is open, also when the user goes to another page and comes back.
export type SettingsTab = 'alarms' | 'times' | 'display' | 'about';

let settingsTab: SettingsTab = 'alarms';

export function getSettingsTab(): SettingsTab {
  return settingsTab;
}

export function setSettingsTab(tab: SettingsTab) {
  settingsTab = tab;
}
