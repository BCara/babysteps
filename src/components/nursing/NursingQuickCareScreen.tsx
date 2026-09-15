import { SafeAreaView } from 'react-native-safe-area-context';
import {
  NursingBottomRow,
  NursingFieldCard,
  NursingHeader,
  NursingHint,
  NursingPage,
  NursingPrimaryAction,
  NursingSideCard,
  NursingSideRow,
  NursingSpacer,
  useNursingChrome,
} from './NursingChrome';

interface NursingQuickCareScreenProps {
  title: string;
  detail: string;
  /** How the last finished feed went, when there is one. */
  previousSummary?: string;
  /** Hidden when a widget or notification already named the side. */
  sides?: {
    activeSide: 'left' | 'right' | null;
    /** The side the previous feed finished on. */
    lastSide?: 'left' | 'right' | null;
    label: (side: 'left' | 'right') => string;
    onPress: (side: 'left' | 'right') => void;
  };
  primaryLabel: string;
  onPrimary: () => void;
  /** Offered while a feed is running, so it can be closed from here. */
  onFinish?: () => void;
  onCancel: () => void;
  busy?: boolean;
}

const SIDES = ['left', 'right'] as const;

/**
 * Nursing reached from a widget, a notification or the voice shortcut.
 *
 * It answers one question — which side, or stop — in the same clothes as the
 * timer it is about to open, so arriving here from the lock screen does not
 * feel like a different app.
 */
export default function NursingQuickCareScreen({
  title,
  detail,
  previousSummary,
  sides,
  primaryLabel,
  onPrimary,
  onFinish,
  onCancel,
  busy = false,
}: NursingQuickCareScreenProps) {
  const chrome = useNursingChrome();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: chrome.flat.bgPage }}
      edges={['top', 'bottom']}
    >
      <NursingPage chrome={chrome} accessibilityLabel={title}>
        <NursingHeader
          chrome={chrome}
          title="Nursing"
          icon="mother-nurse"
          onBack={onCancel}
          backLabel="Home"
        />

        <NursingFieldCard
          chrome={chrome}
          pressKey="summary"
          icon="information-outline"
          label={title}
          value={detail}
          trailingIcon={null}
        />

        {previousSummary ? (
          <NursingHint chrome={chrome}>{previousSummary}</NursingHint>
        ) : null}

        <NursingSpacer />

        {sides ? (
          <NursingSideRow>
            {SIDES.map(side => (
              <NursingSideCard
                key={side}
                chrome={chrome}
                side={side}
                label={side === 'left' ? 'Left' : 'Right'}
                pillText={sides.label(side)}
                active={sides.activeSide === side}
                lastUsed={sides.lastSide === side}
                disabled={busy}
                onPress={() => sides.onPress(side)}
                accessibilityLabel={sides.label(side)}
              />
            ))}
          </NursingSideRow>
        ) : null}

        <NursingSpacer />

        <NursingPrimaryAction
          chrome={chrome}
          label={primaryLabel}
          onPress={onPrimary}
          disabled={busy}
        />

        <NursingBottomRow
          chrome={chrome}
          actions={[
            ...(onFinish
              ? [
                  {
                    key: 'finish',
                    icon: 'check',
                    label: 'Finish nursing',
                    onPress: onFinish,
                    disabled: busy,
                  },
                ]
              : []),
            {
              key: 'cancel',
              icon: 'close',
              label: 'Cancel',
              onPress: onCancel,
              muted: true,
              disabled: busy,
            },
          ]}
        />
      </NursingPage>
    </SafeAreaView>
  );
}
