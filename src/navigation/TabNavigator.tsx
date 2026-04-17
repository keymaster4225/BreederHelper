import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { DashboardScreen } from '@/screens/DashboardScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { StallionManagementScreen } from '@/screens/StallionManagementScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TabParamList } from '@/navigation/AppNavigator';
import { colors } from '@/theme';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator(): JSX.Element {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { fontFamily: 'Lora_700Bold' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: 'BreedWise',
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <MaterialCommunityIcons
              name={focused ? 'view-dashboard' : 'view-dashboard-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Mares"
        component={HomeScreen}
        options={{
          title: 'Mares',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="horse" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Stallions"
        component={StallionManagementScreen}
        options={{
          title: 'Stallions',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="horse-variant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color, size }) => (
            <MaterialCommunityIcons
              name={focused ? 'cog' : 'cog-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
