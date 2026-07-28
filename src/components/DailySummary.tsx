import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface } from 'react-native-paper';

export default function DailySummary() {
  return (
    <Surface style={styles.container} elevation={1}>
      <Text variant="titleMedium" style={styles.title}>Today's Summary</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text variant="headlineMedium">6</Text>
          <Text variant="bodySmall">Feeds</Text>
        </View>
        <View style={styles.statBox}>
          <Text variant="headlineMedium">4</Text>
          <Text variant="bodySmall">Diapers</Text>
        </View>
        <View style={styles.statBox}>
          <Text variant="headlineMedium">14h</Text>
          <Text variant="bodySmall">Sleep</Text>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 4,
  }
});
