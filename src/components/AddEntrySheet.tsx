import { homeCareActions, type HomeActionKey } from '../constants/careActions';
import { useBabies } from '../providers/BabyProvider';
import { useEvents } from '../providers/EventProvider';
import { useCreateQuickLog } from '../hooks/useCreateQuickLog';
import ExpandedQuickCareView from './ExpandedQuickCareView';
import LogModal from './LogModal';
import CareLogModal, { type AdditionalCareType } from './CareLogModal';

/**
 * Adds a new entry of one kind, from anywhere other than Home.
 *
 * The forms assume they are opened the way Home opens them: full screen, in
 * the activity's own styling. Mounted on their own they fall back to plain
 * defaults, or — for the sleep and nursing forms, which draw their own full
 * screen — land in the middle of whatever page is underneath. This opens them
 * the same way everywhere.
 *
 * It only ever adds. No running timer is handed to the form, so filling in
 * the rest of the day cannot adopt or stop a sleep or feed still going.
 */
export default function AddEntrySheet({
  entry,
  startTime,
  onClose,
  onSaved,
}: {
  entry: HomeActionKey | null;
  /** The time the entry starts at, such as the hour tapped on a timeline. */
  startTime?: Date;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const { customSleepLocations, addSleepLocation } = useBabies();
  const { logCareEvent } = useEvents();
  const createQuickLog = useCreateQuickLog();

  if (!entry) return null;
  const definition = homeCareActions.find(action => action.type === entry);
  if (!definition) return null;

  const logType =
    entry === 'nursing' || entry === 'bottle'
      ? 'feed'
      : entry === 'sleep'
        ? 'sleep'
        : entry === 'diaper'
          ? 'diaper'
          : null;

  if (!logType) {
    return (
      <CareLogModal
        visible
        type={entry as AdditionalCareType}
        event={null}
        initialStartTime={startTime}
        onClose={onClose}
        onSave={async input => {
          await logCareEvent(input);
          onSaved?.(`${definition.label} logged`);
          onClose();
        }}
      />
    );
  }

  return (
    <ExpandedQuickCareView
      visible
      title={definition.label}
      icon={definition.icon}
      color={definition.color}
      onClose={onClose}
      // The sleep and nursing forms draw their own header.
      hideHero={entry === 'sleep' || entry === 'nursing'}
    >
      <LogModal
        visible
        type={logType}
        onClose={onClose}
        onSave={async input => {
          onSaved?.(await createQuickLog(input));
          onClose();
        }}
        activeFeed={null}
        activeSleep={null}
        onStopActiveFeed={async () => undefined}
        onStopActiveSleep={async () => undefined}
        defaultFeedType={entry === 'bottle' ? 'bottle' : 'breast'}
        showCloseButton={false}
        initialStartTime={startTime}
        customSleepLocations={customSleepLocations}
        onAddSleepLocation={addSleepLocation}
      />
    </ExpandedQuickCareView>
  );
}
