import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import PageScrollView from '@/components/PageScrollView';
import { Section } from '@/components/ui/Section';
import { SettingsRow } from '@/components/ui/SettingsRow';
import { SliderSetting } from '@/components/ui/SliderSetting';
import { SwitchSetting } from '@/components/ui/SwitchSetting';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import { defaultSettings, useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// 自定义 Section Header，用于在标题右侧放按钮
const CustomSectionHeader = ({
  title,
  onAddPress,
}: {
  title: string;
  onAddPress: () => void;
}) => {
  const { textColor, accentColor } = useSettingsColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
      <TouchableOpacity onPress={onAddPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="add" size={24} color={accentColor} />
      </TouchableOpacity>
    </View>
  );
};

export default function DanmakuSettingsScreen() {
  const {
    settings,
    setSettings,
    setActiveSource,
    addSource,
    updateSource,
    removeSource,
  } = useDanmakuSettings();
  
  const { accentColor, textColor, backgroundColor, secondarySystemGroupedBackground } = useSettingsColors();

  // 弹窗状态管理
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');

  // 基础设置逻辑
  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 36;
  const FONT_SIZE_RANGE = FONT_SIZE_MAX - FONT_SIZE_MIN;

  const mapFontSizeToSlider = (fontSize: number) => (fontSize - FONT_SIZE_MIN) / FONT_SIZE_RANGE;
  const mapSliderToFontSize = (sliderValue: number) =>
    Math.round(FONT_SIZE_MIN + sliderValue * FONT_SIZE_RANGE);

  const toggleFilter = (bit: number) => {
    const newFilter = settings.danmakuFilter ^ bit;
    updateSetting('danmakuFilter', newFilter);
  };

  const toggleModeFilter = (bit: number) => {
    const newFilter = settings.danmakuModeFilter ^ bit;
    updateSetting('danmakuModeFilter', newFilter);
  };

  const handleResetToDefault = () => {
    Alert.alert('确认重置', '这将清除所有设置，包括已保存的弹幕源。确定吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: () => {
          setSettings(defaultSettings);
          Alert.alert('已重置', '所有设置已恢复为默认值。');
        },
      },
    ]);
  };

  // --- 弹幕源管理逻辑 ---

  const openAddModal = () => {
    setEditingId(null);
    setNameInput('');
    setUrlInput('');
    bottomSheetRef.current?.present();
  };

  const openEditModal = (source: { id: string; name: string; url: string }) => {
    setEditingId(source.id);
    setNameInput(source.name);
    setUrlInput(source.url);
    bottomSheetRef.current?.present();
  };

  const handleSaveSource = () => {
    if (!nameInput.trim() || !urlInput.trim()) {
      Alert.alert('提示', '名称和地址不能为空');
      return;
    }
    if (editingId) {
      updateSource(editingId, nameInput, urlInput);
    } else {
      addSource(nameInput, urlInput);
    }
    bottomSheetRef.current?.dismiss();
  };

  const handleDeleteSource = (id: string) => {
    Alert.alert('删除弹幕源', '确定要删除这个源吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => removeSource(id),
      },
    ]);
  };

  const handleLongPress = (source: { id: string; name: string; url: string }) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['取消', '编辑', '删除'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
          title: source.name,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openEditModal(source);
          if (buttonIndex === 2) handleDeleteSource(source.id);
        },
      );
    } else {
      Alert.alert(source.name, '请选择操作', [
        { text: '取消', style: 'cancel' },
        { text: '编辑', onPress: () => openEditModal(source) },
        { text: '删除', style: 'destructive', onPress: () => handleDeleteSource(source.id) },
      ]);
    }
  };

  return (
    <PageScrollView showsVerticalScrollIndicator={false}>
      {/* 弹幕源部分 - 自定义Header带添加按钮 */}
      <View style={styles.sectionContainer}>
        <CustomSectionHeader title="弹幕源" onAddPress={openAddModal} />
        <View
          style={[
            styles.groupContainer,
            { backgroundColor: secondarySystemGroupedBackground },
          ]}
        >
          {settings.sources.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无弹幕源，点击右上角 + 添加</Text>
            </View>
          ) : (
            settings.sources.map((source, index) => (
              <React.Fragment key={source.id}>
                <SettingsRow
                  title={source.name}
                  subtitle={source.url}
                  onPress={() => setActiveSource(source.id)}
                  onLongPress={() => handleLongPress(source)} // 绑定长按
                  showArrow={false}
                  rightComponent={
                    settings.activeSourceId === source.id ? (
                      <Ionicons name="checkmark" size={20} color={accentColor} />
                    ) : undefined
                  }
                />
                {/* 分割线 */}
                {index < settings.sources.length - 1 && (
                  <View style={styles.separator} />
                )}
              </React.Fragment>
            ))
          )}
        </View>
      </View>

      {/* 基础设置 (保留原样) */}
      <Section title="基础设置">
        <SliderSetting
          title="透明度"
          subtitle="弹幕显示的透明度"
          value={settings.opacity}
          min={0.1}
          max={1.0}
          step={0.05}
          onSlidingComplete={(value) => updateSetting('opacity', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
        <SliderSetting
          title="字体大小"
          subtitle="弹幕文字的大小"
          value={mapFontSizeToSlider(settings.fontSize)}
          min={0}
          max={1}
          step={1 / FONT_SIZE_RANGE}
          onSlidingComplete={(value) => updateSetting('fontSize', mapSliderToFontSize(value))}
          formatValue={(value) => `${mapSliderToFontSize(value)}px`}
        />
        <SliderSetting
          title="显示区域"
          subtitle="弹幕在屏幕上的显示范围"
          value={settings.heightRatio}
          min={0.3}
          max={1.0}
          step={0.05}
          onSlidingComplete={(value) => updateSetting('heightRatio', value)}
          formatValue={(value) => `${Math.round(value * 100)}%`}
        />
      </Section>

      {/* 弹幕来源过滤 (保留原样) */}
      <Section title="弹幕来源过滤">
        <SwitchSetting
          title="B站弹幕"
          value={(settings.danmakuFilter & 1) !== 1}
          onValueChange={() => toggleFilter(1)}
        />
        <SwitchSetting
          title="巴哈弹幕"
          value={(settings.danmakuFilter & 2) !== 2}
          onValueChange={() => toggleFilter(2)}
        />
        <SwitchSetting
          title="弹弹Play弹幕"
          value={(settings.danmakuFilter & 4) !== 4}
          onValueChange={() => toggleFilter(4)}
        />
        <SwitchSetting
          title="其他来源弹幕"
          value={(settings.danmakuFilter & 8) !== 8}
          onValueChange={() => toggleFilter(8)}
        />
      </Section>

      {/* 弹幕类型过滤 (保留原样) */}
      <Section title="弹幕类型过滤">
        <SwitchSetting
          title="底部弹幕"
          value={(settings.danmakuModeFilter & 1) !== 1}
          onValueChange={() => toggleModeFilter(1)}
        />
        <SwitchSetting
          title="顶部弹幕"
          value={(settings.danmakuModeFilter & 2) !== 2}
          onValueChange={() => toggleModeFilter(2)}
        />
        <SwitchSetting
          title="滚动弹幕"
          value={(settings.danmakuModeFilter & 4) !== 4}
          onValueChange={() => toggleModeFilter(4)}
        />
      </Section>

      <View style={styles.bottomSpacing} />

      <View style={styles.resetSection}>
        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: '#FF6B6B' }]}
          onPress={handleResetToDefault}
        >
          <Text style={styles.resetButtonText}>恢复默认设置 (清除所有源)</Text>
        </TouchableOpacity>
      </View>

      {/* 添加/编辑 弹窗 */}
      <BottomSheetBackdropModal ref={bottomSheetRef} snapPoints={['50%']}>
        <BottomSheetView style={[styles.sheetContent, { backgroundColor }]}>
          <Text style={[styles.sheetTitle, { color: textColor }]}>
            {editingId ? '编辑弹幕源' : '添加弹幕源'}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>名称</Text>
            <BottomSheetTextInput
              style={[
                styles.input,
                { color: textColor, backgroundColor: secondarySystemGroupedBackground },
              ]}
              placeholder="例如: 官方源"
              placeholderTextColor="#999"
              value={nameInput}
              onChangeText={setNameInput}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textColor }]}>API 地址</Text>
            <BottomSheetTextInput
              style={[
                styles.input,
                { color: textColor, backgroundColor: secondarySystemGroupedBackground },
              ]}
              placeholder="https://api.dandanplay.net"
              placeholderTextColor="#999"
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: accentColor }]}
            onPress={handleSaveSource}
          >
            <Text style={styles.saveButtonText}>保存</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetBackdropModal>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  groupContainer: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ccc',
    opacity: 0.4,
    marginLeft: 50, // 类似 iOS 的缩进分割线
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
    fontSize: 14,
  },
  bottomSpacing: {
    height: 60,
  },
  resetSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetContent: {
    padding: 20,
    gap: 20,
    flex: 1,
  },
  sheetTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
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