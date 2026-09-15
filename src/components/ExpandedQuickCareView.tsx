import { ActivityStyle, useCareScreenStyle } from './ActivityStyle';
import { NursingHeader } from './nursing/NursingChrome';
import { ActivityHeaderVoiceProvider } from './ActivityHeaderVoice';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import {
  Portal,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ExpandedQuickCareViewProps {
  visible: boolean;
  title: string;
  icon: string;
  color: string;
  onClose: () => void;
  /**
   * Hides the hero banner for a child that draws its own full-screen chrome,
   * so the two headers do not stack.
   */
  hideHero?: boolean;
  /** Forms with their own ScrollView use the available height directly. */
  scrollable?: boolean;
  eyebrow?: string;
  backLabel?: string;
  children: ReactNode;
}

function ExpandedQuickCareContent({
  visible,
  title,
  icon,
  color,
  onClose,
  hideHero = false,
  scrollable = true,
  eyebrow = 'QUICK CARE',
  backLabel = 'Home',
  children,
}: ExpandedQuickCareViewProps) {
  const theme = useTheme();
  const chrome = useCareScreenStyle();
  const progress = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardLiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const liftInputAboveKeyboard = () => {
    if (keyboardLiftTimeoutRef.current) {
      clearTimeout(keyboardLiftTimeoutRef.current);
    }

    keyboardLiftTimeoutRef.current = setTimeout(
      () => {
        const focusedInput = NativeTextInput.State.currentlyFocusedInput();
        if (focusedInput) {
          scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
            focusedInput,
            144,
            true,
          );
        }
        keyboardLiftTimeoutRef.current = null;
      },
      Platform.OS === 'android' ? 180 : 100,
    );
  };

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    Animated.spring(progress, {
      toValue: 1,
      damping: 18,
      stiffness: 190,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardVisible(false);
      return;
    }

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        liftInputAboveKeyboard();
      },
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );

    return () => {
      if (keyboardLiftTimeoutRef.current) {
        clearTimeout(keyboardLiftTimeoutRef.current);
        keyboardLiftTimeoutRef.current = null;
      }
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
        edges={['top', 'bottom']}
      >
        {/* The app-root portal host sits behind this native Modal, so a Paper
            Menu or Dialog opened in here would render out of sight. This host
            keeps those overlays inside the modal. */}
        <Portal.Host>
          <ActivityHeaderVoiceProvider color={chrome?.flat.textOnHeader ?? theme.colors.onSurface}>
          <Animated.View
            testID="expanded-quick-care-view"
            style={[
              styles.page,
              {
                backgroundColor: theme.colors.background,
                opacity: progress,
                transform: [
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.965, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {!hideHero && chrome ? (
              <NursingHeader chrome={chrome} title={title} icon={icon} onBack={onClose}
                backLabel={backLabel} eyebrow={eyebrow} bleedPagePadding={false} />
            ) : null}

            <KeyboardAvoidingView
              style={styles.body}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 8}
            >
              {hideHero || !scrollable ? (
                // A child with its own full-screen chrome lays itself out against
                // the viewport; scrolling it would collapse its flexible spacing
                // and leave the controls bunched at the top.
                <View style={styles.bareBody}>{children}</View>
              ) : (
                <ScrollView
                  ref={scrollViewRef}
                  contentContainerStyle={[
                    styles.content,
                    keyboardVisible && styles.contentWithKeyboard,
                  ]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={
                    Platform.OS === 'ios' ? 'interactive' : 'on-drag'
                  }
                  automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                  onTouchEnd={() => {
                    if (keyboardVisible) liftInputAboveKeyboard();
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          </Animated.View>
          </ActivityHeaderVoiceProvider>
        </Portal.Host>
      </SafeAreaView>
    </Modal>
  );
}

export default function ExpandedQuickCareView(props: ExpandedQuickCareViewProps) {
  if (props.hideHero) return <ExpandedQuickCareContent {...props} />;
  return <ActivityStyle color={props.color}><ExpandedQuickCareContent {...props} /></ActivityStyle>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  content: {
    // Lets a screen-sized child fill the viewport instead of leaving a gap
    // below the fold.
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 28,
  },
  bareBody: {
    flex: 1,
  },
  contentWithKeyboard: {
    paddingBottom: 240,
  },
});
