import { Alert } from 'react-native';

type ConfirmDeleteArgs = {
  readonly title: string;
  readonly message: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly onConfirm: () => Promise<void> | void;
};

export function confirmDelete({
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
}: ConfirmDeleteArgs): void {
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: 'destructive',
      onPress: () => {
        void Promise.resolve(onConfirm());
      },
    },
  ]);
}
