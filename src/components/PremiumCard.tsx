import { StyleSheet, View } from 'react-native';
import { Button, Surface, Text, useTheme } from 'react-native-paper';
import { useMonetization } from '../providers/MonetizationProvider';

export default function PremiumCard() {
  const theme = useTheme();
  const {
    entitlement,
    entitlementLoading,
    storeConnected,
    plans,
    purchaseBusy,
    purchasePlan,
    restorePurchases,
    manageSubscription,
  } = useMonetization();

  if (entitlementLoading) {
    return (
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleMedium">Checking your plan…</Text>
      </Surface>
    );
  }

  if (entitlement.accessLevel === 'legacy') {
    return (
      <Surface
        style={[styles.card, { borderColor: theme.colors.primary }]}
        elevation={1}
      >
        <Text variant="titleLarge" style={styles.title}>
          Founding Premium
        </Text>
        <Text variant="bodyMedium" style={styles.copy}>
          Your early account has permanent access to current PitterPatter
          features with no ads and the monthly Assistant allowance, even if
          pricing changes later.
        </Text>
      </Surface>
    );
  }

  if (entitlement.adFree) {
    return (
      <Surface
        style={[styles.card, { borderColor: theme.colors.primary }]}
        elevation={1}
      >
        <Text variant="titleLarge" style={styles.title}>
          PitterPatter Premium
        </Text>
        <Text variant="bodyMedium" style={styles.copy}>
          Premium is active. PitterPatter is ad-free and includes up to 100
          successful Assistant generations per UTC calendar month.
        </Text>
        {entitlement.expiresAt ? (
          <Text variant="bodySmall" style={styles.detail}>
            Current paid access runs until{' '}
            {entitlement.expiresAt.toLocaleDateString()}.
          </Text>
        ) : null}
        <Button mode="outlined" onPress={manageSubscription}>
          Manage in Google Play
        </Button>
      </Surface>
    );
  }

  return (
    <Surface style={styles.card} elevation={1}>
      <Text variant="titleLarge" style={styles.title}>
        Go ad-free
      </Text>
      <Text variant="bodyMedium" style={styles.copy}>
        The free tier keeps all core tracking features and displays restrained,
        non-personalised banner ads. Premium removes those ads and includes a
        monthly Assistant allowance after the five-response preview.
      </Text>

      {plans.length ? (
        <View style={styles.planList}>
          {plans.map(plan => (
            <Button
              key={plan.basePlanId}
              mode={plan.period === 'year' ? 'contained' : 'outlined'}
              loading={purchaseBusy}
              disabled={purchaseBusy}
              onPress={() => purchasePlan(plan.basePlanId)}
            >
              {plan.label}: {plan.price}/{plan.period}
            </Button>
          ))}
        </View>
      ) : (
        <Text variant="bodySmall" style={styles.detail}>
          {storeConnected
            ? 'Premium prices will appear after the Play Console subscription is activated for this test track.'
            : 'Premium purchases are available when PitterPatter is installed through a Google Play test or production track.'}
        </Text>
      )}

      <Button
        mode="text"
        disabled={purchaseBusy}
        onPress={restorePurchases}
      >
        Restore Google Play purchase
      </Button>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  title: {
    fontWeight: 'bold',
  },
  copy: {
    marginTop: 7,
    lineHeight: 20,
  },
  detail: {
    marginTop: 12,
    opacity: 0.7,
    lineHeight: 18,
  },
  planList: {
    marginTop: 16,
    gap: 10,
  },
});
