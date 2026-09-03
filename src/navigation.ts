import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ExpenseKind } from './lib/receipts';
import type { ReceiptResult } from './lib/ai';
import type { EmailAttachment } from './lib/email';

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
  SendEmail: {
    subject: string;
    body: string;
    attachments: EmailAttachment[];
    suggestedRecipient?: string;
  };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
