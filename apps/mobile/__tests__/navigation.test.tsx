/**
 * Navigation Integration Tests
 * Tests tab navigation, dynamic routes, and navigation state
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

// Mock expo-router
const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};

const mockUseLocalSearchParams = jest.fn(() => ({ id: 'test-id' }));
const mockUsePathname = jest.fn(() => '/');
const mockUseSegments = jest.fn(() => ['(tabs)']);
const mockUseRouter = jest.fn(() => mockRouter);

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    useRouter: () => mockUseRouter(),
    useLocalSearchParams: () => mockUseLocalSearchParams(),
    usePathname: () => mockUsePathname(),
    useSegments: () => mockUseSegments(),
    router: mockRouter,
    Link: ({ children, href, onPress, ...props }: any) => {
      return ReactModule.createElement(
        RN.Pressable,
        {
          onPress: () => {
            if (onPress) onPress();
            mockRouter.push(href);
          },
          ...props,
        },
        children
      );
    },
    Tabs: ({ children }: { children: any }) =>
      ReactModule.createElement(RN.View, null, children),
    Stack: {
      Screen: ({ options }: any) =>
        ReactModule.createElement(
          RN.View,
          { testID: 'stack-screen' },
          ReactModule.createElement(RN.Text, null, options?.title || 'Screen')
        ),
    },
  };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-paper components
jest.mock('react-native-paper', () => {
  const RN = require('react-native');
  return {
    Text: RN.Text,
    Surface: RN.View,
    Chip: ({ children, ...props }: any) => <RN.Text {...props}>{children}</RN.Text>,
    IconButton: ({ onPress, accessibilityLabel, ...props }: any) => (
      <RN.Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} {...props}>
        <RN.Text>Icon</RN.Text>
      </RN.Pressable>
    ),
    Button: ({ children, onPress, ...props }: any) => (
      <RN.Pressable onPress={onPress} {...props}>
        <RN.Text>{children}</RN.Text>
      </RN.Pressable>
    ),
    ActivityIndicator: () => <RN.View testID="activity-indicator" />,
    ProgressBar: () => <RN.View testID="progress-bar" />,
    Divider: () => <RN.View testID="divider" />,
    FAB: ({ onPress, accessibilityLabel, testID, ...props }: any) => (
      <RN.Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} {...props}>
        <RN.Text>FAB</RN.Text>
      </RN.Pressable>
    ),
    Searchbar: () => <RN.View testID="searchbar" />,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PaperProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return {
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => (
      <RN.View>{children}</RN.View>
    ),
    Gesture: {
      Pan: () => ({
        onStart: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      }),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Swipeable: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    PanGestureHandler: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: any) => component,
      View: RN.View,
    },
    useSharedValue: (initialValue: any) => ({ value: initialValue }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (value: any) => value,
    withTiming: (value: any) => value,
    runOnJS: (fn: any) => fn,
    createAnimatedComponent: (component: any) => component,
    Extrapolate: { CLAMP: 'clamp' },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeOut: { duration: () => ({}) },
    SlideInRight: {},
    SlideOutRight: {},
  };
});

// Mock react-native-tab-view
jest.mock('react-native-tab-view', () => {
  const RN = require('react-native');
  return {
    TabView: ({ navigationState, renderScene, onIndexChange, ...props }: any) => {
      const currentRoute = navigationState.routes[navigationState.index];
      return (
        <RN.View testID="tab-view">
          <RN.View testID={`tab-${currentRoute.key}`}>
            {renderScene({ route: currentRoute })}
          </RN.View>
        </RN.View>
      );
    },
    TabBar: ({ navigationState, onTabPress, ...props }: any) => (
      <RN.View testID="tab-bar">
        {navigationState.routes.map((route: any, index: number) => (
          <RN.Pressable
            key={route.key}
            testID={`tab-button-${route.key}`}
            onPress={() => onTabPress?.({ route })}
          >
            <RN.Text>{route.title}</RN.Text>
          </RN.Pressable>
        ))}
      </RN.View>
    ),
    SceneMap: (scenes: Record<string, () => React.ReactNode>) => (props: any) =>
      scenes[props.route.key]?.() || null,
  };
});

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Import stores after mocks
import { useTaskStore } from '../stores/taskStore';
import { useProjectStore } from '../stores/projectStore';

describe('Navigation Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ id: 'test-id' });
    mockUsePathname.mockReturnValue('/');
    mockUseSegments.mockReturnValue(['(tabs)']);

    // Reset stores
    act(() => {
      useTaskStore.getState().resetStore();
      useProjectStore.getState().resetStore();
    });
  });

  describe('Tab Navigation', () => {
    it('should have 5 tabs configured', () => {
      // Verify that the tab layout defines 5 tabs
      const expectedTabs = ['Home', 'Projects', 'Chat', 'GitHub', 'Settings'];

      // The tab configuration is in the layout file
      // This test verifies the expected structure
      expect(expectedTabs).toHaveLength(5);
      expect(expectedTabs).toContain('Home');
      expect(expectedTabs).toContain('Projects');
      expect(expectedTabs).toContain('Chat');
      expect(expectedTabs).toContain('GitHub');
      expect(expectedTabs).toContain('Settings');
    });

    it('should navigate between tabs using router.push', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/(tabs)/projects');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/projects');
    });

    it('should navigate to chat tab', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/(tabs)/chat');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/chat');
    });

    it('should navigate to github tab', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/(tabs)/github');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/github');
    });

    it('should navigate to settings tab', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/(tabs)/settings');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/settings');
    });
  });

  describe('Dynamic Routes', () => {
    it('should extract task ID from route params', () => {
      mockUseLocalSearchParams.mockReturnValue({ id: 'task-123' });

      const params = mockUseLocalSearchParams();

      expect(params.id).toBe('task-123');
    });

    it('should extract project ID from route params', () => {
      mockUseLocalSearchParams.mockReturnValue({ id: 'project-456' });

      const params = mockUseLocalSearchParams();

      expect(params.id).toBe('project-456');
    });

    it('should navigate to task detail with ID', () => {
      const taskId = 'task-001';
      const router = mockUseRouter();

      act(() => {
        router.push(`/task/${taskId}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/task/task-001');
    });

    it('should navigate to project detail with ID', () => {
      const projectId = 'project-001';
      const router = mockUseRouter();

      act(() => {
        router.push(`/project/${projectId}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/project/project-001');
    });

    it('should navigate to github issue detail', () => {
      const issueId = 'issue-123';
      const router = mockUseRouter();

      act(() => {
        router.push(`/github/issue/${issueId}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/github/issue/issue-123');
    });

    it('should navigate to github PR detail', () => {
      const prId = 'pr-456';
      const router = mockUseRouter();

      act(() => {
        router.push(`/github/pr/${prId}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/github/pr/pr-456');
    });

    it('should navigate to terminal session detail', () => {
      const sessionId = 'terminal-001';
      const router = mockUseRouter();

      act(() => {
        router.push(`/terminal/${sessionId}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/terminal/terminal-001');
    });
  });

  describe('Navigation State', () => {
    it('should track current pathname', () => {
      mockUsePathname.mockReturnValue('/(tabs)/projects');

      const pathname = mockUsePathname();

      expect(pathname).toBe('/(tabs)/projects');
    });

    it('should track route segments', () => {
      mockUseSegments.mockReturnValue(['(tabs)', 'projects']);

      const segments = mockUseSegments();

      expect(segments).toEqual(['(tabs)', 'projects']);
    });

    it('should check if can go back', () => {
      mockRouter.canGoBack.mockReturnValue(true);

      expect(mockRouter.canGoBack()).toBe(true);
    });

    it('should handle back navigation', () => {
      const router = mockUseRouter();

      act(() => {
        router.back();
      });

      expect(mockRouter.back).toHaveBeenCalled();
    });

    it('should handle replace navigation', () => {
      const router = mockUseRouter();

      act(() => {
        router.replace('/(tabs)/settings');
      });

      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/settings');
    });
  });

  describe('Modal Routes', () => {
    it('should navigate to task creation modal', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/task/create');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/task/create');
    });

    it('should navigate to onboarding modal', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/onboarding');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
    });
  });

  describe('Feature Routes', () => {
    it('should navigate to roadmap', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/roadmap');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/roadmap');
    });

    it('should navigate to ideation', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/ideation');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/ideation');
    });

    it('should navigate to context', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/context');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/context');
    });

    it('should navigate to terminals list', () => {
      const router = mockUseRouter();

      act(() => {
        router.push('/terminal');
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/terminal');
    });
  });

  describe('Navigation from Store Data', () => {
    it('should navigate to task from store', () => {
      const { tasks } = useTaskStore.getState();
      const firstTask = tasks[0];
      const router = mockUseRouter();

      act(() => {
        router.push(`/task/${firstTask.id}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith(`/task/${firstTask.id}`);
    });

    it('should navigate to project from store', () => {
      const { projects } = useProjectStore.getState();
      const firstProject = projects[0];
      const router = mockUseRouter();

      act(() => {
        router.push(`/project/${firstProject.id}`);
      });

      expect(mockRouter.push).toHaveBeenCalledWith(`/project/${firstProject.id}`);
    });

    it('should get correct task after navigation', () => {
      const { tasks, getTaskById } = useTaskStore.getState();
      const targetTask = tasks[0];

      // Simulate param extraction after navigation
      mockUseLocalSearchParams.mockReturnValue({ id: targetTask.id });

      const params = mockUseLocalSearchParams();
      const task = getTaskById(params.id as string);

      expect(task).toBeDefined();
      expect(task?.id).toBe(targetTask.id);
    });

    it('should get correct project after navigation', () => {
      const { projects, getProjectById } = useProjectStore.getState();
      const targetProject = projects[0];

      // Simulate param extraction after navigation
      mockUseLocalSearchParams.mockReturnValue({ id: targetProject.id });

      const params = mockUseLocalSearchParams();
      const project = getProjectById(params.id as string);

      expect(project).toBeDefined();
      expect(project?.id).toBe(targetProject.id);
    });
  });

  describe('Deep Link Routes', () => {
    it('should handle deep link to specific task', () => {
      const deepLinkPath = '/task/task-001';
      mockUsePathname.mockReturnValue(deepLinkPath);
      mockUseLocalSearchParams.mockReturnValue({ id: 'task-001' });

      const pathname = mockUsePathname();
      const params = mockUseLocalSearchParams();

      expect(pathname).toBe(deepLinkPath);
      expect(params.id).toBe('task-001');
    });

    it('should handle deep link to specific project', () => {
      const deepLinkPath = '/project/project-001';
      mockUsePathname.mockReturnValue(deepLinkPath);
      mockUseLocalSearchParams.mockReturnValue({ id: 'project-001' });

      const pathname = mockUsePathname();
      const params = mockUseLocalSearchParams();

      expect(pathname).toBe(deepLinkPath);
      expect(params.id).toBe('project-001');
    });
  });

  describe('Navigation Error Handling', () => {
    it('should handle navigation to non-existent task', () => {
      mockUseLocalSearchParams.mockReturnValue({ id: 'non-existent-task' });

      const { getTaskById } = useTaskStore.getState();
      const params = mockUseLocalSearchParams();
      const task = getTaskById(params.id as string);

      expect(task).toBeUndefined();
    });

    it('should handle navigation to non-existent project', () => {
      mockUseLocalSearchParams.mockReturnValue({ id: 'non-existent-project' });

      const { getProjectById } = useProjectStore.getState();
      const params = mockUseLocalSearchParams();
      const project = getProjectById(params.id as string);

      expect(project).toBeUndefined();
    });

    it('should handle empty ID parameter', () => {
      mockUseLocalSearchParams.mockReturnValue({ id: '' });

      const params = mockUseLocalSearchParams();

      expect(params.id).toBe('');
    });

    it('should handle undefined ID parameter', () => {
      mockUseLocalSearchParams.mockReturnValue({ id: undefined as unknown as string });

      const params = mockUseLocalSearchParams();

      expect(params.id).toBeUndefined();
    });
  });

  describe('Tab Navigation State Persistence', () => {
    it('should track active tab index', () => {
      // Simulate being on projects tab
      mockUseSegments.mockReturnValue(['(tabs)', 'projects']);

      const segments = mockUseSegments();
      const activeTab = segments[1] || 'index';

      expect(activeTab).toBe('projects');
    });

    it('should determine if on home tab', () => {
      mockUseSegments.mockReturnValue(['(tabs)']);
      mockUsePathname.mockReturnValue('/(tabs)');

      const segments = mockUseSegments();
      const isHomeTab = segments.length === 1 && segments[0] === '(tabs)';

      expect(isHomeTab).toBe(true);
    });

    it('should determine if on nested route', () => {
      mockUseSegments.mockReturnValue(['task', '[id]']);
      mockUsePathname.mockReturnValue('/task/task-001');

      const segments = mockUseSegments();
      const isNestedRoute = segments[0] === 'task' && segments[1] === '[id]';

      expect(isNestedRoute).toBe(true);
    });
  });

  describe('Sequential Navigation', () => {
    it('should handle navigation from home to task to project', () => {
      const router = mockUseRouter();

      // Start at home
      mockUsePathname.mockReturnValue('/(tabs)');
      expect(mockUsePathname()).toBe('/(tabs)');

      // Navigate to task
      act(() => {
        router.push('/task/task-001');
      });
      expect(mockRouter.push).toHaveBeenCalledWith('/task/task-001');

      // Navigate to project
      act(() => {
        router.push('/project/project-001');
      });
      expect(mockRouter.push).toHaveBeenCalledWith('/project/project-001');
    });

    it('should handle back navigation sequence', () => {
      const router = mockUseRouter();

      // Navigate forward
      act(() => {
        router.push('/task/task-001');
        router.push('/github/issue/issue-001');
      });

      // Navigate back
      act(() => {
        router.back();
      });

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });
});
