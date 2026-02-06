import { useSettingsColors } from '@/hooks/useSettingsColors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { Image } from 'expo-image';
import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

export interface SettingsRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  imageUri?: string;
  onPress?: () => void;
  // 新增：支持长按回调
  onLongPress?: () => void;
  showArrow?: boolean;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  menuTitle?: string;
  menuActions?: { id: string; title: string }[];
  onMenuAction?: (actionId: string) => void;
  shouldOpenOnLongPress?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  subtitle,
  icon,
  imageUri,
  onPress,
  onLongPress, // 解构出 onLongPress
  showArrow = true,
  leftComponent,
  rightComponent,
  containerStyle,
  menuTitle,
  menuActions,
  onMenuAction,
  shouldOpenOnLongPress = false,
}) => {
  const { textColor, secondaryTextColor, secondarySystemGroupedBackground, accentColor } =
    useSettingsColors();

  const RowContent = (
    <TouchableOpacity
      style={[
        styles.settingItem,
        { backgroundColor: secondarySystemGroupedBackground },
        containerStyle,
      ]}
      onPress={onPress}
      onLongPress={onLongPress} // 绑定长按事件
      delayLongPress={200} // 设置稍微短一点的延迟，提升手感
      activeOpacity={0.7}
      disabled={!onPress && !onLongPress}
    >
      <View style={styles.settingItemLeft}>
        {leftComponent}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.settingImage} contentFit="cover" />
        ) : icon ? (
          <Ionicons name={icon} size={24} color={accentColor} style={styles.settingIcon} />
        ) : null}
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.settingSubtitle, { color: secondaryTextColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.settingItemRight}>
        {rightComponent}
        {showArrow && onPress ? (
          <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (menuActions && menuActions.length > 0) {
    return (
      <MenuView
        title={menuTitle ?? ''}
        actions={menuActions}
        shouldOpenOnLongPress={shouldOpenOnLongPress}
        onPressAction={({ nativeEvent }) => onMenuAction?.(nativeEvent.event)}
      >
        {RowContent}
      </MenuView>
    );
  }

  return RowContent;
};

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10, // 防止右侧挤压
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default SettingsRow;