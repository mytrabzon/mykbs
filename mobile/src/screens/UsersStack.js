/**
 * Kullanıcılar Drawer ekranı: liste + detay (Stack).
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import UsersScreen from './UsersScreen';
import UserDetailScreen from './UserDetailScreen';

const Stack = createNativeStackNavigator();

export default function UsersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UsersList" component={UsersScreen} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} />
    </Stack.Navigator>
  );
}
