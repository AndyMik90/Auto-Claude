/**
 * Tab Layout
 * Bottom tab navigation with 5 tabs:
 * - Home (Dashboard with Kanban board)
 * - Projects (Project list and management)
 * - Chat (AI chat interface)
 * - GitHub (Issues and PRs)
 * - Settings (App configuration)
 */

import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, shadows } from '../../theme';

/**
 * Icon component for tab bar items
 * Uses Material Community Icons for consistent design
 */
interface TabIconProps {
  name: string;
  color: string;
  focused: boolean;
}

function TabIcon({ name, color, focused }: TabIconProps) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={focused ? 26 : 24}
      color={color}
      accessibilityLabel={`${name} tab icon`}
    />
  );
}

/**
 * Tab bar styling configuration
 * Dark theme matching AutoClaude desktop application
 */
const tabBarOptions = {
  tabBarActiveTintColor: colors.navigation.active,
  tabBarInactiveTintColor: colors.navigation.inactive,
  tabBarStyle: {
    backgroundColor: colors.navigation.background,
    borderTopColor: colors.surface.border,
    borderTopWidth: 1,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    height: Platform.OS === 'ios' ? 88 : 64,
    ...shadows.small,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  headerStyle: {
    backgroundColor: colors.background.secondary,
    shadowColor: 'transparent',
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerTintColor: colors.text.primary,
  headerTitleStyle: {
    fontWeight: 'bold' as const,
    fontSize: 18,
  },
  headerShadowVisible: false,
};

/**
 * Tab Navigator Layout
 * Defines the 5 main tabs with icons and labels
 */
export default function TabLayout() {
  return (
    <Tabs screenOptions={tabBarOptions}>
      {/* Home Tab - Dashboard with Kanban board */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="view-dashboard" color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: 'Home tab - Dashboard with task Kanban board',
        }}
      />

      {/* Projects Tab - Project list and management */}
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          headerTitle: 'Projects',
          tabBarLabel: 'Projects',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="folder-multiple" color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: 'Projects tab - Project list and management',
        }}
      />

      {/* Chat Tab - AI chat interface */}
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          headerTitle: 'Insights',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chat-processing" color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: 'Chat tab - AI chat interface',
        }}
      />

      {/* GitHub Tab - Issues and PRs */}
      <Tabs.Screen
        name="github"
        options={{
          title: 'GitHub',
          headerTitle: 'GitHub',
          tabBarLabel: 'GitHub',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="github" color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: 'GitHub tab - Issues and pull requests',
        }}
      />

      {/* Settings Tab - App configuration */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="cog" color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: 'Settings tab - App configuration',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Reserved for future enhancements
});
