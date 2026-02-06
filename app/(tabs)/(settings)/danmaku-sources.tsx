import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import PageScrollView from '@/components/PageScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Section } from '@/components/ui/Section';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function DanmakuSourcesScreen() {
  const { settings, setActiveSource, removeSource, addSource, updateSource } = useDanmakuSettings();
  const navigation = useNavigation();
  const { accentColor, textColor, backgroundColor, secondarySystemGroupedBackground } = useSettingsColors();

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  
  // 表单状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  // 设置顶部导航栏右侧按钮
  useEffect(() => {
    navigation.setOptions({
      headerTitle: '弹幕源管理',
      headerRight: () => (
        <TouchableOpacity onPress={handleAddNew} style={{ paddingHorizontal: 16 }}>
          <Ionicons name="add" size={24} color={accentColor} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, accentColor]);

  // 打开添加模态框
  const handleAddNew = () => {
    setEditingId(null);
    setName('');
    setUrl('');
    bottomSheetRef.current?.present();
  };

  // 打开编辑模态框
  const handleEdit = (source: { id: string; name: string; url: string }) => {
    setEditingId(source.id);
    setName(source.name);
    setUrl(source.url);
    bottomSheetRef.current?.present();
  };

  // 保存（添加或更新）
  const handleSave = () => {
    if (!name.trim() || !url.trim()) {
      Alert.alert('提示', '名称和地址不能为空');
      return;
    }

    if (editingId) {
      updateSource(editingId, name, url);
    } else {
      addSource(name, url);
    }
    bottomSheetRef.current?.dismiss();
  };

  // 删除确认
  const handleDelete = (id: string) => {
    Alert.alert('删除源', '确定要删除这个弹幕源吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => removeSource(id),
      },
    ]);
  };

  return (
    <PageScrollView>
      <Section title="选择弹幕源">
        {settings.sources.map((source) => (
          <SettingsRow
            key={source.id}
            title={source.name}
            subtitle={source.url}
            onPress={() => setActiveSource(source.id)}
            rightComponent={
              settings.activeSourceId === source.id ? (
                <Ionicons name="checkmark" size={20} color={accentColor} />
              ) : undefined
            }
            // 长按或点击菜单进行编辑/删除
            customActions={[
              { id: 'edit', title: '编辑', onPress: () => handleEdit(source) },
              { id: 'delete', title: '删除', onPress: () => handleDelete(source.id) },
            ]}
            menuTitle={source.name}
            showArrow={false}
          />
        ))}
      </Section>

      {settings.sources.length === 0 && (
        <View style={styles.emptyContainer}>
          <ThemedText style={{ opacity: 0.6 }}>暂无弹幕源，请点击右上角 + 号添加</ThemedText>
        </View>
      )}

      {/* 添加/编辑 弹窗 */}
      <BottomSheetBackdropModal ref={bottomSheetRef} snapPoints={['50%']}>
        <BottomSheetView style={[styles.sheetContent, { backgroundColor }]}>
          <ThemedText type="subtitle" style={styles.sheetTitle}>
            {editingId ? '编辑源' : '添加源'}
          </ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>名称</ThemedText>
            <BottomSheetTextInput
              style={[styles.input, { color: textColor, backgroundColor: secondarySystemGroupedBackground }]}
              placeholder="例如: 官方源"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>API 地址</ThemedText>
            <BottomSheetTextInput
              style={[styles.input, { color: textColor, backgroundColor: secondarySystemGroupedBackground }]}
              placeholder="https://api.dandanplay.net"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: accentColor }]}
            onPress={handleSave}
          >
            <ThemedText style={styles.saveButtonText}>保存</ThemedText>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetBackdropModal>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  sheetContent: {
    padding: 20,
    gap: 20,
    flex: 1,
  },
  sheetTitle: {
    textAlign: 'center',
    marginBottom: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  saveButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});