import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuickLogButton from '../../../src/components/QuickLogButton';
import DailySummary from '../../../src/components/DailySummary';
import BabySelector from '../../../src/components/BabySelector';
import LogModal from '../../../src/components/LogModal';
import ActiveTimer from '../../../src/components/ActiveTimer';
import { useAppStore } from '../../../src/stores/appStore';
import { eventColors } from '../../../src/theme/eventColors';
import { BabyEvent } from '../../../src/services/firebase/events';

export default function HomeScreen() {
  const theme = useTheme();
  const { activeTimers, startTimer, stopTimer } = useAppStore();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleQuickLog = (action: string) => {
    if (action === 'sleep' || action === 'tummytime') {
      if (activeTimers[action]) {
        stopTimer(action);
        // Here we would save the completed event to Firebase
      } else {
        startTimer(action);
      }
    } else {
      setSelectedAction(action);
      setLogModalVisible(true);
    }
  };

  const handleSaveLog = (data: Partial<BabyEvent>) => {
    // Here we would save to Firebase
    console.log('Saving event:', data);
    setLogModalVisible(false);
    setSelectedAction(null);
  };

  const actions = [
    { type: 'feed', title: 'Feed' },
    { type: 'sleep', title: 'Sleep' },
    { type: 'diaper', title: 'Diaper' },
    { type: 'tummytime', title: 'Tummy Time' },
    { type: 'medication', title: 'Medication' },
    { type: 'bath', title: 'Bath' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <BabySelector currentBabyName="Leo" onPress={() => {}} />
        </View>

        <DailySummary />

        <View style={styles.timersContainer}>
          {Object.entries(activeTimers).map(([type, startTime]) => (
            <ActiveTimer 
              key={type}
              activityType={type}
              startTime={startTime}
              onStop={() => handleQuickLog(type)}
            />
          ))}
        </View>

        <View style={styles.quickLogGrid}>
          {actions.map(({ type, title }) => (
            <QuickLogButton
              key={type}
              title={title}
              color={eventColors[type as keyof typeof eventColors] || theme.colors.primary}
              onPress={() => handleQuickLog(type)}
            />
          ))}
        </View>
      </ScrollView>

      <LogModal
        visible={logModalVisible}
        type={selectedAction}
        onClose={() => setLogModalVisible(false)}
        onSave={handleSaveLog}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  timersContainer: {
    paddingBottom: 8,
  },
  quickLogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
    justifyContent: 'center',
  },
});
