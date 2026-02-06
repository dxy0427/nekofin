import { BottomSheetBackdropModal } from '@/components/BottomSheetBackdropModal';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import {
  DandanAnime,
  DandanComment,
  DandanEpisode,
  getCommentsByEpisodeId,
  searchAnimesByKeyword,
} from '@/services/dandanplay';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type DanmakuSearchModalProps = {
  onCommentsLoaded: (
    comments: DandanComment[],
    episodeInfo?: { animeTitle: string; episodeTitle: string },
  ) => void;
  ref?: React.RefObject<DanmakuSearchModalRef | null>;
};

type SearchStep = 'anime' | 'episode';

export interface DanmakuSearchModalRef {
  present: (initialKeyword?: string) => void;
  dismiss: () => void;
}

export const DanmakuSearchModal = ({ onCommentsLoaded, ref }: DanmakuSearchModalProps) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchStep, setSearchStep] = useState<SearchStep>('anime');
  const [animes, setAnimes] = useState<DandanAnime[]>([]);
  const [episodes, setEpisodes] = useState<DandanEpisode[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<DandanAnime | null>(null);
  const [loading, setLoading] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const { getActiveSource } = useDanmakuSettings();
  const activeSource = getActiveSource();
  const baseUrl = activeSource?.url || '';

  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const borderColor = useThemeColor({ light: '#e0e0e0', dark: '#333' }, 'text');

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const present = useCallback(
    (initialKeyword?: string) => {
      setSearchStep('anime');
      setAnimes([]);
      setEpisodes([]);
      setSelectedAnime(null);
      setLoading(false);

      if (initialKeyword) {
        setSearchKeyword(initialKeyword);
        // 如果有初始关键词且配置了源，自动触发搜索
        if (baseUrl) {
          setLoading(true);
          searchAnimesByKeyword(baseUrl, initialKeyword)
            .then((results) => {
              setAnimes(results);
            })
            .catch(() => {
              // 自动搜索失败暂不弹窗，让用户手动重试
            })
            .finally(() => {
              setLoading(false);
            });
        }
      } else {
        setSearchKeyword('');
      }

      bottomSheetModalRef.current?.present();
    },
    [baseUrl],
  );

  const dismiss = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      present,
      dismiss,
    }),
    [present, dismiss],
  );

  const handleSearch = useCallback(async () => {
    textInputRef.current?.blur();
    if (!searchKeyword.trim()) return;

    if (!baseUrl) {
      Alert.alert('错误', '请先在设置中配置弹幕源');
      return;
    }

    setLoading(true);
    try {
      if (searchStep === 'anime') {
        const results = await searchAnimesByKeyword(baseUrl, searchKeyword);
        setAnimes(results);
      } else if (searchStep === 'episode' && selectedAnime) {
        const results = selectedAnime.episodes;
        setEpisodes(results);
      }
    } catch (error) {
      Alert.alert('搜索失败', '请检查网络连接或弹幕源地址是否正确');
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, searchStep, selectedAnime, baseUrl]);

  const handleAnimeSelect = useCallback((anime: DandanAnime) => {
    setSelectedAnime(anime);
    setEpisodes(anime.episodes);
    setSearchStep('episode');
  }, []);

  const handleEpisodeSelect = useCallback(
    async (episode: DandanEpisode) => {
      if (!baseUrl) return;
      setLoading(true);
      try {
        const comments = await getCommentsByEpisodeId(baseUrl, episode.episodeId);
        onCommentsLoaded(comments, {
          animeTitle: selectedAnime?.animeTitle ?? '',
          episodeTitle: episode.episodeTitle,
        });
        bottomSheetModalRef.current?.dismiss();
        Alert.alert('成功', '弹幕已加载');
      } catch (error) {
        Alert.alert('加载失败', '无法加载弹幕，请重试');
      } finally {
        setLoading(false);
      }
    },
    [onCommentsLoaded, selectedAnime, baseUrl],
  );

  const handleClose = useCallback(() => {
    setSearchKeyword('');
    setSearchStep('anime');
    setAnimes([]);
    setEpisodes([]);
    setSelectedAnime(null);
  }, []);

  const renderAnimeItem = useCallback(
    ({ item }: { item: DandanAnime }) => (
      <TouchableOpacity
        style={[styles.item, { borderBottomColor: borderColor }]}
        onPress={() => handleAnimeSelect(item)}
      >
        <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
          {item.animeTitle}
        </Text>
        <Text style={[styles.itemSubtitle, { color: textColor, opacity: 0.6 }]}>
          {item.typeDescription} · {item.episodes.length} 集
        </Text>
      </TouchableOpacity>
    ),
    [borderColor, textColor, handleAnimeSelect],
  );

  const renderEpisodeItem = useCallback(
    ({ item }: { item: DandanEpisode }) => (
      <TouchableOpacity
        style={[styles.item, { borderBottomColor: borderColor }]}
        onPress={() => handleEpisodeSelect(item)}
      >
        <Text style={[styles.itemTitle, { color: textColor }]} numberOfLines={2}>
          {item.episodeTitle}
        </Text>
      </TouchableOpacity>
    ),
    [borderColor, textColor, handleEpisodeSelect],
  );

  const renderEmptyComponent = useCallback(
    () => (
      <Text style={[styles.emptyText, { color: textColor, opacity: 0.6 }]}>
        {searchStep === 'anime' ? (!loading ? '输入番剧名称进行搜索' : '') : '该番剧暂无剧集'}
      </Text>
    ),
    [searchStep, loading, textColor],
  );

  return (
    <BottomSheetBackdropModal
      ref={bottomSheetModalRef}
      onDismiss={handleClose}
      snapPoints={['90%']}
      enableDynamicSizing={false}
      enablePanDownToClose={true}
      enableContentPanningGesture={false}
      topInset={30}
      bottomInset={40}
      detached
      style={{ marginHorizontal: 120 }}
    >
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                color: textColor,
              },
            ]}
            placeholder={searchStep === 'anime' ? '输入番剧名称' : '剧集列表'}
            placeholderTextColor={`${String(textColor)}80`}
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            onSubmitEditing={handleSearch}
            editable={searchStep === 'anime'}
            autoCapitalize="none"
            autoCorrect={false}
            ref={textInputRef}
          />
          {searchKeyword.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchKeyword('')}
            >
              <Ionicons name="close-circle" size={16} color="#999" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.searchButton,
              !searchKeyword.trim() && styles.disabledButton,
              { backgroundColor: !searchKeyword.trim() ? borderColor : '#007AFF' },
            ]}
            onPress={handleSearch}
            disabled={!searchKeyword.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="search" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>

        <BottomSheetFlatList
          data={searchStep === 'anime' ? animes : episodes}
          renderItem={searchStep === 'anime' ? renderAnimeItem : renderEpisodeItem}
          keyExtractor={(item: DandanAnime | DandanEpisode) =>
            searchStep === 'anime'
              ? (item as DandanAnime).animeId.toString()
              : (item as DandanEpisode).episodeId.toString()
          }
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </BottomSheetBackdropModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    paddingRight: 30, // 留出清除按钮的空间
  },
  clearButton: {
    position: 'absolute',
    right: 80, // 根据searchButton的宽度调整
    padding: 8,
  },
  searchButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});