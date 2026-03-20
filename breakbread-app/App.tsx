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

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const TableStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function TabIcon({ icon }: { icon: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24 }}>{icon}</Text>
    </View>
  );
}

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="RestaurantMenu" component={RestaurantMenuScreen} />
      <HomeStack.Screen name="TableOrder" component={TableOrderScreen} />
    </HomeStack.Navigator>
  );
}

function OrdersStackScreen() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersMain" component={OrdersScreen} />
      <OrdersStack.Screen name="RestaurantMenu" component={RestaurantMenuScreen} />
      <OrdersStack.Screen name="TableOrder" component={TableOrderScreen} />
    </OrdersStack.Navigator>
  );
}

function TableStackScreen() {
  return (
    <TableStack.Navigator screenOptions={{ headerShown: false }}>
      <TableStack.Screen name="TableMain" component={TableOrderScreen} />
      <TableStack.Screen name="RestaurantMenu" component={RestaurantMenuScreen} />
    </TableStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
    </ProfileStack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { height: 80, paddingBottom: 20, paddingTop: 10 },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStackScreen}
          options={{ tabBarIcon: () => <TabIcon icon="🏠" />, tabBarLabel: () => null }}
        />
        <Tab.Screen
          name="Orders"
          component={OrdersStackScreen}
          options={{ tabBarIcon: () => <TabIcon icon="📋" />, tabBarLabel: () => null }}
        />
        <Tab.Screen
          name="Table"
          component={TableStackScreen}
          options={{ tabBarIcon: () => <TabIcon icon="👥" />, tabBarLabel: () => null }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStackScreen}
          options={{ tabBarIcon: () => <TabIcon icon="👤" />, tabBarLabel: () => null }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
