import { create } from 'zustand';

interface AppState {
  selectedBabyId: string | null;
  activeTimers: Record<string, number>; // activityType -> startTime
  theme: 'system' | 'light' | 'dark';
  setSelectedBabyId: (id: string) => void;
  startTimer: (activityType: string) => void;
  stopTimer: (activityType: string) => void;
  setTheme: (theme: 'system' | 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedBabyId: null,
  activeTimers: {},
  theme: 'system',
  
  setSelectedBabyId: (id) => set({ selectedBabyId: id }),
  
  startTimer: (activityType) => set((state) => ({
    activeTimers: {
      ...state.activeTimers,
      [activityType]: Date.now()
    }
  })),
  
  stopTimer: (activityType) => set((state) => {
    const newTimers = { ...state.activeTimers };
    delete newTimers[activityType];
    return { activeTimers: newTimers };
  }),
  
  setTheme: (theme) => set({ theme })
}));
