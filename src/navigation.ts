import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ExpenseKind } from './lib/receipts';
import type { ReceiptResult } from './lib/ai';

export type RootStackParamList = {
  Home: undefined;
  Review: { docId: string };
  Export: { docId: string };
  Settings: undefined;
  Downloads: undefined;
  ReceiptDetails: {
    docId: string;
    kind: ExpenseKind;
    ai: ReceiptResult | null;
  };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
