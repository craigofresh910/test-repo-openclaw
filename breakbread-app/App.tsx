import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import RestaurantMenuScreen from './src/screens/RestaurantMenuScreen';
import TableOrderScreen from './src/screens/TableOrderScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
    </View>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { height: 80, paddingBottom: 20, paddingTop: 10 } }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} />, tabBarLabel: () => null }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" label="Orders" focused={focused} />, tabBarLabel: () => null }} />
      <Tab.Screen name="Table" component={TableOrderScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👥" label="Table" focused={focused} />, tabBarLabel: () => null }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profile" focused={focused} />, tabBarLabel: () => null }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={HomeTabs} />
        <Stack.Screen name="RestaurantMenu" component={RestaurantMenuScreen} />
        <Stack.Screen name="TableOrder" component={TableOrderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
