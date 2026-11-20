import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlaceChooser } from '@/components/PlaceChooser';
import { spacing, type, useColors } from '@/theme';

/** Settings > Times > Place: choose where the prayer times are for. */
export function PlaceScreen() {
  const colors = useColors();
  const navigation = useNavigation();

  return (
    <PlaceChooser
      onChosen={() => navigation.goBack()}
      header={
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
          <Text style={[type.title, { color: colors.text }]}>Place</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
});
