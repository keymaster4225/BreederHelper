import { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import { TabNavigator } from '@/navigation/TabNavigator';
import { MareDetailScreen } from '@/screens/MareDetailScreen';
import { EditMareScreen } from '@/screens/EditMareScreen';
import { DailyLogFormScreen } from '@/screens/DailyLogFormScreen';
import { BreedingRecordFormScreen } from '@/screens/BreedingRecordFormScreen';
import { PregnancyCheckFormScreen } from '@/screens/PregnancyCheckFormScreen';
import { FoalingRecordFormScreen } from '@/screens/FoalingRecordFormScreen';
import { FoalFormScreen } from '@/screens/FoalFormScreen';
import { MareCalendarScreen } from '@/screens/MareCalendarScreen';
import { MedicationFormScreen } from '@/screens/MedicationFormScreen';
import { StallionDetailScreen } from '@/screens/StallionDetailScreen';
import { StallionFormScreen } from '@/screens/StallionFormScreen';
import { CollectionFormScreen } from '@/screens/CollectionFormScreen';
import { AVPreferencesFormScreen } from '@/screens/AVPreferencesFormScreen';
import { DataBackupScreen } from '@/screens/DataBackupScreen';

import { FoalSex } from '@/models/types';
import { colors } from '@/theme';

export type TabParamList = {
  Home: undefined;
  Mares: { initialFilter?: 'all' | 'pregnant' | 'open'; requestKey?: string } | undefined;
  Stallions: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  MareDetail: { mareId: string; initialTab?: 'dailyLogs' | 'breeding' | 'pregnancy' | 'foaling' | 'meds' };
  EditMare: { mareId?: string } | undefined;
  DailyLogForm: { mareId: string; logId?: string };
  StallionDetail: { stallionId: string; initialTab?: 'collections' | 'breeding' };
  StallionForm: { stallionId?: string };
  CollectionForm: { stallionId: string; collectionId?: string };
  AVPreferencesForm: { stallionId: string };
  BreedingRecordForm: { mareId: string; breedingRecordId?: string };
  PregnancyCheckForm: { mareId: string; pregnancyCheckId?: string };
  FoalingRecordForm: { mareId: string; foalingRecordId?: string };
  FoalForm: { mareId: string; foalingRecordId: string; foalId?: string; defaultSex?: FoalSex | null };
  MedicationForm: { mareId: string; medicationLogId?: string };
  MareCalendar: { mareId: string };
  DataBackup: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.onSurface,
          headerTitleStyle: { fontFamily: 'Lora_700Bold' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="MainTabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="MareDetail" component={MareDetailScreen} options={{ title: 'Mare Detail' }} />
        <Stack.Screen name="EditMare" component={EditMareScreen} options={{ title: 'Add / Edit Mare' }} />
        <Stack.Screen name="DailyLogForm" component={DailyLogFormScreen} options={{ title: 'Daily Log' }} />
        <Stack.Screen name="BreedingRecordForm" component={BreedingRecordFormScreen} options={{ title: 'Breeding Record' }} />
        <Stack.Screen name="PregnancyCheckForm" component={PregnancyCheckFormScreen} options={{ title: 'Pregnancy Check' }} />
        <Stack.Screen name="FoalingRecordForm" component={FoalingRecordFormScreen} options={{ title: 'Foaling Record' }} />
        <Stack.Screen name="FoalForm" component={FoalFormScreen} options={{ title: 'Foal Record' }} />
        <Stack.Screen name="MedicationForm" component={MedicationFormScreen} options={{ title: 'Medication' }} />
        <Stack.Screen name="StallionDetail" component={StallionDetailScreen} options={{ title: 'Stallion Detail' }} />
        <Stack.Screen name="StallionForm" component={StallionFormScreen} options={{ title: 'Stallion' }} />
        <Stack.Screen name="CollectionForm" component={CollectionFormScreen} options={{ title: 'Collection' }} />
        <Stack.Screen name="AVPreferencesForm" component={AVPreferencesFormScreen} options={{ title: 'AV Preferences' }} />
        <Stack.Screen name="MareCalendar" component={MareCalendarScreen} options={{ title: 'Calendar' }} />
        <Stack.Screen name="DataBackup" component={DataBackupScreen} options={{ title: 'Data Backup & Restore' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
