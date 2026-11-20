import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { diary } from '@/lib/diary';
import {
  cityPlaceName,
  coordinatesText,
  isLatitude,
  isLongitude,
  searchCities,
  type City,
  type Place,
} from '@/lib/places';
import { updateSettings, useSettings } from '@/lib/settings';
import { radius, spacing, type, useColors } from '@/theme';

type Props = {
  /** Drawn above the three ways to choose: the page title and a short line. */
  header: ReactNode;
  /** Called after a place was chosen and saved. */
  onChosen?: () => void;
  /** false inside the tabs: the bottom bar already keeps clear of the gesture bar. */
  insetBottom?: boolean;
};

/** Gives up on a slow answer (a position fix, a place name) after `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** "25.4", "-3,7" (a comma works too): the number, or null when it is not one. */
function parseDegrees(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

/**
 * The three ways to choose where the prayer times are for: the phone's position (once, no
 * tracking), a capital city from the list, or a latitude and longitude typed in.
 */
export function PlaceChooser({ header, onChosen, insetBottom = true }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [settings] = useSettings();
  const current = settings.place;

  const [locating, setLocating] = useState(false);
  const [locationProblem, setLocationProblem] = useState<{ text: string; openSettings: boolean } | null>(null);

  const [typing, setTyping] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [name, setName] = useState('');
  const [typedProblem, setTypedProblem] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const cities = useMemo(() => searchCities(query), [query]);

  const choose = (place: Place, note: string) => {
    updateSettings((prev) => ({ ...prev, place }));
    diary(note);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onChosen?.();
  };

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setLocationProblem(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        diary('Location not allowed for the place');
        setLocationProblem(
          permission.canAskAgain
            ? { text: 'Location was not allowed. Choose a city below, or enter coordinates.', openSettings: false }
            : {
                text: 'Location is turned off for this app. Turn it on in the phone settings, or choose a city below.',
                openSettings: true,
              },
        );
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocationProblem({
          text: 'Location is off on your phone. Turn it on and try again, or choose a city below.',
          openSettings: false,
        });
        return;
      }
      const position =
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          20_000,
        ).catch(() => null)) ?? (await Location.getLastKnownPositionAsync().catch(() => null));
      if (!position) {
        diary('Could not find the phone position for the place');
        setLocationProblem({
          text: 'Your position could not be found. Try again near a window, or choose a city below.',
          openSettings: false,
        });
        return;
      }
      const { latitude: lat, longitude: lon } = position.coords;
      let placeName = 'My location';
      try {
        const [address] = await withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lon }), 8_000);
        placeName = address?.city || address?.subregion || address?.region || placeName;
      } catch {
        // No name (offline, or the phone has no address service): "My location" is fine.
      }
      choose({ name: placeName, latitude: lat, longitude: lon, source: 'location' }, 'Place set from location');
    } catch {
      diary('Could not find the phone position for the place');
      setLocationProblem({
        text: 'Your position could not be found. Try again, or choose a city below.',
        openSettings: false,
      });
    } finally {
      setLocating(false);
    }
  };

  const applyTyped = () => {
    const lat = parseDegrees(latitude);
    const lon = parseDegrees(longitude);
    if (lat === null || !isLatitude(lat)) {
      setTypedProblem('Latitude must be a number from -90 to 90 (south is negative).');
      return;
    }
    if (lon === null || !isLongitude(lon)) {
      setTypedProblem('Longitude must be a number from -180 to 180 (west is negative).');
      return;
    }
    setTypedProblem(null);
    choose(
      { name: name.trim() || 'My place', latitude: lat, longitude: lon, source: 'coordinates' },
      'Place set from coordinates',
    );
  };

  const chooseCity = (city: City) =>
    choose(
      { name: cityPlaceName(city), latitude: city.latitude, longitude: city.longitude, source: 'city' },
      'Place set from the city list',
    );

  const inputStyle = [
    type.body,
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
  ];

  const top = (
    <View>
      {header}

      {current ? (
        <View style={[styles.current, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="map-marker-outline" size={22} color={colors.accent} />
          <View style={styles.grow}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{current.name}</Text>
            <Text style={[type.small, type.numeric, { color: colors.textMuted }]}>
              {coordinatesText(current.latitude, current.longitude)}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={[type.label, styles.sectionTitle, { color: colors.textFaint }]}>WHERE YOU ARE</Text>
      <Button
        title={locating ? 'Finding your position...' : current?.source === 'location' ? 'Update my location' : 'Use my location'}
        onPress={locate}
        disabled={locating}
      />
      {locating ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : null}
      {locationProblem ? (
        <View style={styles.problem}>
          <Text style={[type.small, { color: colors.warning }]}>{locationProblem.text}</Text>
          {locationProblem.openSettings ? (
            <Button title="Open phone settings" variant="secondary" onPress={() => Linking.openSettings().catch(() => {})} />
          ) : null}
        </View>
      ) : (
        <Text style={[type.small, styles.hint, { color: colors.textMuted }]}>
          Uses the phone&apos;s position once. Nothing is tracked.
        </Text>
      )}

      <Text style={[type.label, styles.sectionTitle, { color: colors.textFaint }]}>COORDINATES</Text>
      <View style={[styles.group, { borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: typing }}
          onPress={() => setTyping((open) => !open)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.textMuted} />
          <View style={styles.grow}>
            <Text style={[type.bodyStrong, { color: colors.text }]}>Enter coordinates</Text>
            <Text style={[type.small, { color: colors.textMuted }]}>Latitude and longitude in degrees</Text>
          </View>
          <MaterialCommunityIcons name={typing ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textMuted} />
        </Pressable>
        {typing ? (
          <View style={styles.form}>
            <View style={styles.fields}>
              <View style={styles.grow}>
                <Text style={[type.small, { color: colors.textMuted }]}>Latitude</Text>
                <TextInput
                  value={latitude}
                  onChangeText={setLatitude}
                  placeholder="21.42"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
              <View style={styles.grow}>
                <Text style={[type.small, { color: colors.textMuted }]}>Longitude</Text>
                <TextInput
                  value={longitude}
                  onChangeText={setLongitude}
                  placeholder="39.83"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
            </View>
            <Text style={[type.small, { color: colors.textMuted }]}>Name (optional)</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="My place"
              placeholderTextColor={colors.textFaint}
              maxLength={40}
              style={inputStyle}
            />
            {typedProblem ? <Text style={[type.small, { color: colors.warning }]}>{typedProblem}</Text> : null}
            <Button title="Use these coordinates" variant="secondary" onPress={applyTyped} />
          </View>
        ) : null}
      </View>

      <Text style={[type.label, styles.sectionTitle, { color: colors.textFaint }]}>CAPITAL CITIES</Text>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a city or country"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          style={[type.body, styles.searchInput, { color: colors.text }]}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear the search" hitSlop={8} onPress={() => setQuery('')}>
            <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: (insetBottom ? insets.bottom : 0) + spacing.lg,
        paddingHorizontal: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
      data={cities}
      keyExtractor={(city) => `${city.name}|${city.country}`}
      ListHeaderComponent={top}
      ListEmptyComponent={
        <Text style={[type.small, styles.empty, { color: colors.textMuted }]}>
          No capital city matches. Try the country&apos;s name, use your location, or enter coordinates.
        </Text>
      }
      initialNumToRender={20}
      renderItem={({ item, index }) => {
        const selected =
          current?.source === 'city' && current.latitude === item.latitude && current.longitude === item.longitude;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => chooseCity(item)}
            style={({ pressed }) => [
              styles.city,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              selected && { backgroundColor: colors.accentSoft },
              pressed && !selected && { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <View style={styles.grow}>
              <Text style={[type.bodyStrong, { color: selected ? colors.accent : colors.text }]}>{item.name}</Text>
              {item.country ? <Text style={[type.small, { color: colors.textMuted }]}>{item.country}</Text> : null}
            </View>
            {selected ? <MaterialCommunityIcons name="check" size={22} color={colors.accent} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: 2 },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  spinner: { marginTop: spacing.sm },
  problem: { marginTop: spacing.sm, gap: spacing.sm },
  hint: { marginTop: spacing.sm },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  form: { gap: spacing.sm, paddingBottom: spacing.md },
  fields: { flexDirection: 'row', gap: spacing.md },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, minHeight: 48 },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.sm,
  },
  empty: { marginTop: spacing.md },
});
