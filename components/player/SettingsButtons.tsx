import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { DandanComment } from '@/services/dandanplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView } from '@react-native-menu/menu';
import { useCallback, useRef } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

import { DanmakuSearchModal, DanmakuSearchModalRef } from './DanmakuSearchModal';
import { usePlayer } from './PlayerContext';

type SettingsButtonsProps = {
  style?: StyleProp<ViewStyle>;
};

export function SettingsButtons({ style }: SettingsButtonsProps) {
  const {
    onRateChange,
    rate,
    setMenuOpen,
    onCommentsLoaded,
    title,
    currentItem,
  } = usePlayer();

  const danmakuSearchModalRef = useRef<DanmakuSearchModalRef>(null);
  const { settings: danmakuSettings, setSettings: setDanmakuSettings } = useDanmakuSettings();

  const handleRateSelect = (newRate: number) => {
    onRateChange?.(newRate);
  };

  const handleDanmakuToggle = useCallback(() => {
    setDanmakuSettings({
      ...danmakuSettings,
      danmakuFilter: danmakuSettings.danmakuFilter === 15 ? 0 : 15,
    });
  }, [danmakuSettings, setDanmakuSettings]);

  const handleDanmakuSearch = useCallback(() => {
    let keyword = '';
    if (currentItem) {
      keyword = currentItem.seriesName || currentItem.name || '';
    } else if (title) {
      keyword = title.split(' S')[0];
    }
    danmakuSearchModalRef.current?.present(keyword);
  }, [currentItem, title]);

  const handleCommentsLoaded = useCallback(
    (comments: DandanComment[], episodeInfo?: { animeTitle: string; episodeTitle: string }) => {
      onCommentsLoaded?.(comments, episodeInfo);
    },
    [onCommentsLoaded],
  );

  const createMenuAction = <T,>(id: string, title: string, currentValue: T, targetValue: T) => ({
    id,
    title,
    state: currentValue === targetValue ? ('on' as const) : ('off' as const),
  });

  const createRateAction = (rateValue: number) =>
    createMenuAction(`rate_${rateValue}`, `${rateValue}x`, rate, rateValue);

  return (
    <View style={[styles.row, style]}>
      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key.startsWith('rate_')) {
            const newRate = parseFloat(key.replace('rate_', ''));
            handleRateSelect(newRate);
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="播放速度"
        actions={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(createRateAction)}
      >
        <TouchableOpacity style={styles.circleButton}>
          <Ionicons name="speedometer-outline" size={24} color="white" />
        </TouchableOpacity>
      </MenuView>

      <MenuView
        isAnchoredToRight
        onPressAction={({ nativeEvent }) => {
          const key = nativeEvent.event;
          if (key === 'danmaku_toggle') {
            handleDanmakuToggle();
          } else if (key === 'danmaku_search') {
            handleDanmakuSearch();
          }
          setMenuOpen(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        title="弹幕设置"
        actions={[
          {
            id: 'danmaku_toggle',
            title: danmakuSettings.danmakuFilter === 15 ? '开启弹幕' : '关闭弹幕',
          },
          { id: 'danmaku_search', title: '搜索弹幕' },
        ]}
      >
        <TouchableOpacity style={styles.circleButton}>
          <Ionicons name="chatbubble-ellipses" size={24} color="white" />
        </TouchableOpacity>
      </MenuView>

      <DanmakuSearchModal ref={danmakuSearchModalRef} onCommentsLoaded={handleCommentsLoaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});