import { StyleSheet, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';
import { useTheme } from 'react-native-paper';
import { useMonetization } from '../providers/MonetizationProvider';
import { ADMOB_BANNER_AD_UNIT_ID } from '../config/monetization';

export default function AdBanner() {
  const theme = useTheme();
  const { adsReady, isAdFree } = useMonetization();

  if (isAdFree || !adsReady) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.elevation.level1,
          borderTopColor: theme.colors.outlineVariant,
        },
      ]}
      accessibilityLabel="Advertisement"
    >
      <BannerAd
        unitId={ADMOB_BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
