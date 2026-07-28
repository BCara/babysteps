import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Baby, createBaby, subscribeToBabies } from '../services/firebase/babies';
import {
  subscribeToUserProfile,
  updateProfile,
  UserProfile,
} from '../services/firebase/users';
import { useAuth } from './AuthProvider';

interface BabyContextValue {
  babies: Baby[];
  selectedBaby: Baby | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  selectBaby: (babyId: string) => Promise<void>;
  addBaby: (baby: Omit<Baby, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
}

const BabyContext = createContext<BabyContextValue | null>(null);

export function BabyProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [babies, setBabies] = useState<Baby[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [babiesLoaded, setBabiesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    setBabies([]);
    setProfileLoaded(false);
    setBabiesLoaded(false);
    setError(null);

    if (!user) return;

    const unsubscribeProfile = subscribeToUserProfile(
      user.uid,
      nextProfile => {
        setProfile(nextProfile);
        setProfileLoaded(true);
      },
      nextError => {
        setError(nextError.message);
        setProfileLoaded(true);
      },
    );

    const unsubscribeBabies = subscribeToBabies(
      user.uid,
      nextBabies => {
        setBabies(nextBabies);
        setBabiesLoaded(true);
      },
      nextError => {
        setError(nextError.message);
        setBabiesLoaded(true);
      },
    );

    return () => {
      unsubscribeProfile();
      unsubscribeBabies();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profileLoaded || !babiesLoaded || babies.length === 0) return;

    const activeExists = babies.some(baby => baby.id === profile?.activeBabyId);
    if (!activeExists && babies[0].id) {
      updateProfile(user.uid, { activeBabyId: babies[0].id }).catch(nextError =>
        setError(nextError.message),
      );
    }
  }, [babies, babiesLoaded, profile?.activeBabyId, profileLoaded, user]);

  const selectedBaby =
    babies.find(baby => baby.id === profile?.activeBabyId) || babies[0] || null;

  const value = useMemo<BabyContextValue>(
    () => ({
      babies,
      selectedBaby,
      profile,
      loading: Boolean(user) && (!profileLoaded || !babiesLoaded),
      error,
      selectBaby: async babyId => {
        if (!user) throw new Error('You are not signed in.');
        if (!babies.some(baby => baby.id === babyId)) {
          throw new Error('That baby profile is not available.');
        }
        await updateProfile(user.uid, { activeBabyId: babyId });
      },
      addBaby: async baby => {
        if (!user) throw new Error('You are not signed in.');
        return createBaby(user.uid, baby);
      },
    }),
    [
      babies,
      babiesLoaded,
      error,
      profile,
      profileLoaded,
      selectedBaby,
      user,
    ],
  );

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
}

export const useBabies = () => {
  const context = useContext(BabyContext);
  if (!context) throw new Error('useBabies must be used inside BabyProvider.');
  return context;
};
