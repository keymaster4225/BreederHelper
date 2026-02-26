import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import { HomeScreen } from '@/screens/HomeScreen';
import { MareDetailScreen } from '@/screens/MareDetailScreen';
import { EditMareScreen } from '@/screens/EditMareScreen';
import { DailyLogFormScreen } from '@/screens/DailyLogFormScreen';
import { StallionManagementScreen } from '@/screens/StallionManagementScreen';
import { BreedingRecordFormScreen } from '@/screens/BreedingRecordFormScreen';
import { PregnancyCheckFormScreen } from '@/screens/PregnancyCheckFormScreen';
import { FoalingRecordFormScreen } from '@/screens/FoalingRecordFormScreen';

export type RootStackParamList = {
  Home: undefined;
  MareDetail: { mareId: string };
  EditMare: { mareId?: string } | undefined;
  DailyLogForm: { mareId: string; logId?: string };
  Stallions: undefined;
  BreedingRecordForm: { mareId: string; breedingRecordId?: string };
  PregnancyCheckForm: { mareId: string; pregnancyCheckId?: string };
  FoalingRecordForm: { mareId: string; foalingRecordId?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Mares' }} />
        <Stack.Screen name="MareDetail" component={MareDetailScreen} options={{ title: 'Mare Detail' }} />
        <Stack.Screen name="EditMare" component={EditMareScreen} options={{ title: 'Add / Edit Mare' }} />
        <Stack.Screen name="DailyLogForm" component={DailyLogFormScreen} options={{ title: 'Daily Log' }} />
        <Stack.Screen name="Stallions" component={StallionManagementScreen} options={{ title: 'Stallions' }} />
        <Stack.Screen name="BreedingRecordForm" component={BreedingRecordFormScreen} options={{ title: 'Breeding Record' }} />
        <Stack.Screen name="PregnancyCheckForm" component={PregnancyCheckFormScreen} options={{ title: 'Pregnancy Check' }} />
        <Stack.Screen name="FoalingRecordForm" component={FoalingRecordFormScreen} options={{ title: 'Foaling Record' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

