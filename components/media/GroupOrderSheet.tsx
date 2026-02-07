import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import { ThemedText } from '@/components/ThemedText';
import { useSettingsColors } from '@/hooks/useSettingsColors';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { useGroupOrder } from '@/hooks/useGroupOrder';

// 类型名称映射
const TITLE_MAP: Record<string, string> = {
  Movie: '电影',
  Series: '剧集',
  BoxSet: '合集',
  Season: '季度',
  Episode: '单集',
  MusicVideo: '音乐视频',
  Other: '其他',
};

export interface GroupOrderSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const GroupOrderSheet = React.forwardRef<GroupOrderSheetRef, {}>((props, ref) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { order, updateOrder, resetOrder } = useGroupOrder();
  const { textColor, secondarySystemGroupedBackground, accentColor, separatorColor } =
    useSettingsColors();

  useImperativeHandle(ref, () => ({
    present: () => bottomSheetRef.current?.present(),
    dismiss: () => bottomSheetRef.current?.dismiss(),
  }));

  const moveItem = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const newOrder = [...order];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= newOrder.length) return;

      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;

      updateOrder(newOrder);
    },
    [order, updateOrder],
  );

  return (
    <BottomSheetBackdropModal ref={bottomSheetRef} snapPoints={['60%']}>
      <BottomSheetView style={styles.contentContainer}>
        <View style={styles.header}>
          <ThemedText type="subtitle">调整分类顺序</ThemedText>
          <TouchableOpacity onPress={resetOrder}>
            <ThemedText style={{ color: accentColor, fontSize: 14 }}>重置默认</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={[styles.listContainer, { backgroundColor: secondarySystemGroupedBackground }]}>
          {order.map((key, index) => (
            <React.Fragment key={key}>
              <View style={styles.row}>
                <ThemedText style={styles.rowLabel}>{TITLE_MAP[key] || key}</ThemedText>
                <View style={styles.controls}>
                  <TouchableOpacity
                    onPress={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    style={[styles.controlButton, index === 0 && styles.disabledControl]}
                  >
                    <Ionicons name="arrow-up" size={20} color={textColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveItem(index, 'down')}
                    disabled={index === order.length - 1}
                    style={[
                      styles.controlButton,
                      index === order.length - 1 && styles.disabledControl,
                    ]}
                  >
                    <Ionicons name="arrow-down" size={20} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>
              {index < order.length - 1 && (
                <View style={[styles.separator, { backgroundColor: separatorColor }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </BottomSheetView>
    </BottomSheetBackdropModal>
  );
});

const styles = StyleSheet.create({
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    gap: 16,
  },
  controlButton: {
    padding: 4,
  },
  disabledControl: {
    opacity: 0.2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
});