import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '@/components/Screen';
import { RootStackParamList } from '@/navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'MareDetail'>;

export function MareDetailScreen({ route }: Props): JSX.Element {
  return (
    <Screen>
      <Text>Mare Detail scaffold for mareId: {route.params.mareId}</Text>
    </Screen>
  );
}

