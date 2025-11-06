import PageScrollView from '@/components/PageScrollView';
import { Section } from '@/components/ui/Section';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import Constants from 'expo-constants';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { servers } = useMediaServers();

  const router = useRouter();

  const SettingItem = (props: React.ComponentProps<typeof SettingsRow>) => (
    <SettingsRow {...props} />
  );

  useEffect(() => {
    navigation.setOptions({
      headerLargeTitle: true,
    });
  }, [navigation]);

  return (
    <PageScrollView showsVerticalScrollIndicator={false}>
      <Section title="服务器">
        <SettingItem
          title="服务器列表"
          subtitle={`${servers.length} 个服务器`}
          icon="list"
          onPress={() => router.push('/media')}
        />
      </Section>

      <Section title="播放">
        <SettingItem title="转码设置" icon="settings" onPress={() => router.push('/transcoding')} />
        <SettingItem
          title="弹幕设置"
          icon="chatbubble-ellipses"
          onPress={() => router.push('/danmaku')}
        />
      </Section>

      <Section title="关于">
        <SettingItem
          title="版本信息"
          subtitle={`nekofin v${Constants.expoConfig?.version || '1.0.0'}`}
          icon="information-circle"
          showArrow={false}
        />
        <SettingItem title="开源协议" subtitle="MPL-2.0 License" icon="code" showArrow={false} />
      </Section>
    </PageScrollView>
  );
}
