import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import SignOutButton from '@/components/SignOutButton';

export default function AdminLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerRight: () => <SignOutButton />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color }) => <FontAwesome name="users" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ color }) => <FontAwesome name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color }) => <FontAwesome name="list" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="comments"
        options={{
          title: 'Comments',
          tabBarIcon: ({ color }) => <FontAwesome name="comment" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
