import { AddServerForm } from '@/components/AddServerForm';
import { AvatarImage } from '@/components/AvatarImage';
import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import PageScrollView from '@/components/PageScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Section } from '@/components/ui/Section';
import { SelectSetting } from '@/components/ui/SelectSetting';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { MediaServerInfo } from '@/services/media/types';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export default function MediaScreen() {
  const { servers, removeServer, setCurrentServer, currentServer } = useMediaServers();
  const router = useRouter();

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [isAddServerVisible, setIsAddServerVisible] = useState(false);

  const handleAddServer = () => {
    setIsAddServerVisible(true);
    bottomSheetRef.current?.present();
  };

  const handleCloseAddServer = () => {
    setIsAddServerVisible(false);
    bottomSheetRef.current?.dismiss();
  };

  const handleRemoveServer = async (id: string) => {
    await removeServer(id);
  };

  const handleSetCurrentServer = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      setCurrentServer(server);
    }
  };

  const serverOptions = servers.map((server) => ({
    id: server.id,
    title: server.name,
    subtitle: `${server.type} • ${server.address}`,
    value: server.id,
  }));

  const renderServerItem = (server: MediaServerInfo) => {
    return (
      <SelectSetting
        key={server.id}
        title={server.name}
        subtitle={`${server.type} • ${server.address}`}
        value={server.id}
        options={[
          { title: server.name, subtitle: `${server.type} • ${server.address}`, value: server.id },
        ]}
        icon={server.userAvatar ? undefined : 'link'}
        showSelectionMenu={false}
        leftComponent={
          server.userAvatar ? (
            <AvatarImage
              avatarUri={server.userAvatar}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                marginRight: 12,
              }}
            />
          ) : undefined
        }
        customActions={[
          {
            id: 'config',
            title: '配置',
            onPress: () =>
              router.push({
                pathname: '/server-config/[serverId]',
                params: { serverId: server.id },
              }),
          },
          {
            id: 'remove',
            title: '删除服务器',
            onPress: () => handleRemoveServer(server.id),
          },
        ]}
      />
    );
  };

  return (
    <PageScrollView style={styles.container}>
      <Section title="服务器管理">
        <SettingsRow title="添加服务器" icon="add" onPress={handleAddServer} />
        {servers.length > 0 && (
          <SelectSetting
            title="当前服务器"
            subtitle="选择要使用的媒体服务器"
            value={currentServer?.id || ''}
            options={serverOptions}
            onValueChange={handleSetCurrentServer}
            placeholder="请选择服务器"
            menuTitle="选择服务器"
          />
        )}
      </Section>

      {servers.length > 0 && (
        <Section title="服务器列表">{servers.map((server) => renderServerItem(server))}</Section>
      )}

      {servers.length === 0 && (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>暂无保存的服务器</ThemedText>
          <ThemedText style={styles.emptySubtext}>点击上方按钮添加你的第一个服务器</ThemedText>
        </View>
      )}

      <BottomSheetBackdropModal ref={bottomSheetRef} onDismiss={() => setIsAddServerVisible(false)}>
        {isAddServerVisible && <AddServerForm onClose={handleCloseAddServer} />}
      </BottomSheetBackdropModal>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
