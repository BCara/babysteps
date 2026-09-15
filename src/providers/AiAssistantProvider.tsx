import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AiGenerationRequest,
  AiResult,
  AiStatus,
  friendlyAiError,
  generateAiResponse,
  getAiStatus,
  updateAiConsent,
} from '../services/aiAssistant';
import { useAuth } from './AuthProvider';

interface AiAssistantContextValue {
  status: AiStatus | null;
  loading: boolean;
  busy: boolean;
  notice: string;
  refreshStatus: () => Promise<void>;
  setConsent: (accepted: boolean) => Promise<void>;
  generate: (request: AiGenerationRequest) => Promise<AiResult>;
  clearNotice: () => void;
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export function AiAssistantProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      setStatus(await getAiStatus());
    } catch (error) {
      setNotice(friendlyAiError(error));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setStatus(null);
    setNotice('');
    void refreshStatus();
  }, [refreshStatus]);

  const setConsent = useCallback(async (accepted: boolean) => {
    setBusy(true);
    setNotice('');
    try {
      setStatus(await updateAiConsent(accepted));
    } catch (error) {
      const message = friendlyAiError(error);
      setNotice(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const generate = useCallback(async (request: AiGenerationRequest) => {
    setBusy(true);
    setNotice('');
    try {
      const result = await generateAiResponse(request);
      setStatus(current =>
        current ? { ...current, usage: result.usage } : current,
      );
      return result;
    } catch (error) {
      const message = friendlyAiError(error);
      setNotice(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<AiAssistantContextValue>(
    () => ({
      status,
      loading,
      busy,
      notice,
      refreshStatus,
      setConsent,
      generate,
      clearNotice: () => setNotice(''),
    }),
    [busy, generate, loading, notice, refreshStatus, setConsent, status],
  );

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
    </AiAssistantContext.Provider>
  );
}

export const useAiAssistant = () => {
  const context = useContext(AiAssistantContext);
  if (!context) {
    throw new Error('useAiAssistant must be used inside AiAssistantProvider.');
  }
  return context;
};

