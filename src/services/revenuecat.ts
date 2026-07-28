import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const APIKeys = {
  apple: "appl_api_key_here",
  google: "goog_api_key_here"
};

export const setupRevenueCat = async () => {
  if (Platform.OS === 'ios') {
    Purchases.configure({ apiKey: APIKeys.apple });
  } else if (Platform.OS === 'android') {
    Purchases.configure({ apiKey: APIKeys.google });
  }
};

export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current.availablePackages;
    }
  } catch (e) {
    console.error("Error fetching offerings", e);
  }
  return [];
};

export const purchasePackage = async (pack: PurchasesPackage) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pack);
    return isPro(customerInfo);
  } catch (e) {
    console.error("Error purchasing", e);
    return false;
  }
};

export const isPro = (customerInfo: CustomerInfo) => {
  if (typeof customerInfo.entitlements.active['pro'] !== "undefined") {
    return true;
  }
  return false;
};
