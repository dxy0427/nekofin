import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { isGreaterThanOrEqual26 } from '@/lib/utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useNavigation } from 'expo-router';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { accentColor } = useAccentColor();
  const navigation = useNavigation();

  // 处理 Tab 点击事件：如果已经在当前 Tab，则重置到根页面
  const handleTabPress = (e: any, routeName: string) => {
    const state = navigation.getState();
    const currentRoute = state.routes[state.index];
    
    // 如果点击的是当前激活的 Tab
    if (currentRoute.name === routeName) {
      // 这里的逻辑会尝试 pop 到栈顶，如果已经在栈顶则无操作
      // navigation.emit 触发默认行为，但对于深度嵌套的 Stack，我们需要显式 reset
      // 注意：expo-router 的 Tabs 默认行为在某些版本可能已经是 reset，
      // 如果不是，可以使用以下逻辑强制 reset：
      
      // 检查该 Tab 是否有嵌套历史
      const tabState = currentRoute.state;
      if (tabState && tabState.index > 0) {
        e.preventDefault(); // 阻止默认行为（虽然默认行为可能也是 reset，但显式控制更稳）
        // 导航到该 Tab 的初始路由
        navigation.navigate(routeName, {
          screen: 'index',
          params: { key: Math.random().toString() } // 强制刷新
        });
      }
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accentColor,
        tabBarStyle: Platform.OS === 'android' ? {
          elevation: 0,
          borderTopWidth: 0,
          backgroundColor: isGreaterThanOrEqual26 ? 'transparent' : undefined,
        } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(home)"
        listeners={{
          tabPress: (e) => handleTabPress(e, '(home)'),
        }}
        options={{
          title: '首页',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'film' : 'film-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(search)"
        listeners={{
          tabPress: (e) => handleTabPress(e, '(search)'),
        }}
        options={{
          title: '搜索',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(favorites)"
        listeners={{
          tabPress: (e) => handleTabPress(e, '(favorites)'),
        }}
        options={{
          title: '收藏',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(settings)"
        listeners={{
          tabPress: (e) => handleTabPress(e, '(settings)'),
        }}
        options={{
          title: '设置',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}