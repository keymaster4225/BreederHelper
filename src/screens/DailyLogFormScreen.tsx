import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/AppNavigator';
import { DailyLogWizardScreen } from './DailyLogWizardScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyLogForm'>;

export function DailyLogFormScreen(props: Props): JSX.Element {
  return <DailyLogWizardScreen {...props} />;
}
