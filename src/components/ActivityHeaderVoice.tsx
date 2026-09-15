import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type VoiceContent = { button: ReactNode; message: ReactNode };
const ContentContext = createContext<VoiceContent | null>(null);
const RegistrationContext = createContext<{
  setContent: (content: VoiceContent | null) => void;
  color: string;
} | null>(null);

/** Embedded forms retain their handlers while displaying voice input in the header. */
export function ActivityHeaderVoiceProvider({ color, children }: { color: string; children: ReactNode }) {
  const [content, setContent] = useState<VoiceContent | null>(null);
  const registration = useMemo(() => ({ setContent, color }), [color]);
  return (
    <RegistrationContext.Provider value={registration}>
      <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
    </RegistrationContext.Provider>
  );
}

export const useActivityHeaderVoice = () => useContext(RegistrationContext);
export function ActivityHeaderVoice({ part, fallback = null }: { part: keyof VoiceContent; fallback?: ReactNode }) {
  return useContext(ContentContext)?.[part] ?? fallback;
}
