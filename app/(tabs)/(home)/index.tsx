import { AvatarImage } from '@/components/AvatarImage';
import { ItemImage } from '@/components/ItemImage';
import { getSubtitle } from '@/components/media/Card';
import { Section } from '@/components/media/Section';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { UserViewSection } from '@/components/user-view/UserViewSection';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getHiddenUserViews } from '@/lib/utils/userViewConfig';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { MenuAction, MenuView } from '@react-native-menu/menu';
import { useIsFocused } from '@react-navigation/native';
import { useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useNavigation,
  useNavigationContainerRef,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Easing,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';
import { useSharedValue } from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';

type HomeSection = {
  key: string;
  title: string;
  items: MediaItem[];
  type?: 'latest' | 'nextup' | 'resume' | 'userview';
};

type HomeSectionWithStatus = HomeSection & { isLoading: boolean };

function useHomeSections(currentServer: MediaServerInfo | null) {
  const mediaAdapter = useMediaAdapter();
  const enabled = !!currentServer?.id && !!currentServer?.userId;

  const [hiddenUserViewIds, setHiddenUserViewIds] = useState<string[]>(() =>
    currentServer?.id ? getHiddenUserViews(currentServer.id) : [],
  );

  useFocusEffect(
    useCallback(() => {
      if (currentServer?.id) {
        setHiddenUserViewIds(getHiddenUserViews(currentServer.id));
        console.log('hiddenUserViewIds', getHiddenUserViews(currentServer.id));
      }
    }, [currentServer?.id]),
  );

  const resumeQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: true,
    queryKey: ['homeSections', currentServer?.id, 'resume'],
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await mediaAdapter.getResumeItems({
        userId: currentServer.userId,
        limit: 10,
      });
      return response.data.Items || [];
    },
    enabled,
  });

  const nextUpQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: true,
    queryKey: ['homeSections', currentServer?.id, 'nextup'],
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await mediaAdapter.getNextUpItems({
        userId: currentServer.userId,
        limit: 10,
      });
      return response.data.Items || [];
    },
    enabled,
  });

  const allUserViewQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: true,
    queryKey: ['homeSections', currentServer?.id, 'allUserView'],
    queryFn: async () => {
      if (!currentServer) return [];
      const userView = await mediaAdapter.getUserView({ userId: currentServer.userId });
      return (userView || []).filter((item) => item.collectionType !== 'playlists');
    },
    enabled,
  });

  const userViewQuery = useMemo(() => {
    if (!allUserViewQuery.data) return { ...allUserViewQuery, data: [] };
    return {
      ...allUserViewQuery,
      data: allUserViewQuery.data.filter((item) => item.id && !hiddenUserViewIds.includes(item.id)),
    };
  }, [allUserViewQuery, hiddenUserViewIds]);

  const latestFolders = useMemo(() => {
    if (!userViewQuery.data) return [];

    return userViewQuery.data
      .filter((item): item is MediaItem & { id: string } => !!item.id)
      .filter((item) => !hiddenUserViewIds.includes(item.id))
      .map((item) => ({
        folderId: item.id!,
        name: item.name || '',
      }));
  }, [userViewQuery.data, hiddenUserViewIds]);

  const latestQueries = useQueries({
    queries: latestFolders.map((folder) => ({
      queryKey: ['homeSections', currentServer?.id, 'latest', folder.folderId],
      queryFn: async () => {
        if (!currentServer) return [];
        const response = await mediaAdapter.getLatestItemsByFolder({
          userId: currentServer.userId,
          folderId: folder.folderId,
          limit: 16,
        });
        return response.data.Items || [];
      },
      enabled,
    })),
  });

  const randomItemsQuery = useQueryWithFocus<MediaItem[]>({
    refetchOnScreenFocus: false,
    queryKey: ['homeSections', currentServer?.id, 'random'],
    queryFn: async () => {
      if (!currentServer) return [];
      return await mediaAdapter.getRandomItems({
        userId: currentServer.userId,
        limit: 6,
      });
    },
    enabled,
  });

  const resumeSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'resume',
      title: '继续观看',
      items: resumeQuery.data ?? [],
      type: 'resume',
      isLoading: resumeQuery.isPending,
    }),
    [resumeQuery.data, resumeQuery.isPending],
  );

  const nextUpSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'nextup',
      title: '接下来',
      items: nextUpQuery.data ?? [],
      type: 'nextup',
      isLoading: nextUpQuery.isPending,
    }),
    [nextUpQuery.data, nextUpQuery.isPending],
  );

  const userViewSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'userview',
      title: '媒体库',
      items: userViewQuery.data ?? [],
      type: 'userview',
      isLoading: userViewQuery.isPending,
    }),
    [userViewQuery.data, userViewQuery.isPending],
  );

  const latestSections = useMemo<HomeSectionWithStatus[]>(
    () =>
      latestFolders.map((folder, index) => {
        const query = latestQueries[index];
        const items = query?.data ?? [];

        return {
          key: `latest_${folder.folderId}`,
          title: `最近添加的 ${folder.name}`,
          items,
          type: 'latest',
          isLoading: query?.isPending ?? false,
        } satisfies HomeSectionWithStatus;
      }),
    [latestFolders, latestQueries],
  );

  const sections = useMemo<HomeSectionWithStatus[]>(
    () => [resumeSection, nextUpSection, userViewSection, ...latestSections],
    [resumeSection, nextUpSection, userViewSection, latestSections],
  );

  return {
    sections,
    resume: resumeSection,
    nextUp: nextUpSection,
    userView: userViewSection,
    latest: latestSections,
    randomItemsQuery,
  };
}

export default function HomeScreen() {
  const { servers, currentServer, setCurrentServer, refreshServerInfo, isInitialized } =
    useMediaServers();
  const navigation = useNavigation();
  const navigationRef = useNavigationContainerRef();
  const rootNavigationState = useRootNavigationState();
  const mediaAdapter = useMediaAdapter();

  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');

  const carouselPlaceholderColor = useThemeColor(
    { light: '#d1d1d6', dark: '#2b2b2b' },
    'background',
  );

  const colorScheme = useColorScheme() ?? 'light';

  const gradientStartColor = colorScheme === 'light' ? 'rgba(252,255,255,0)' : 'rgba(0,0,0,0)';
  const gradientEndColor = colorScheme === 'light' ? 'rgba(252,255,255,1)' : 'rgba(0,0,0,1)';

  const { colors, locations } = easeGradient({
    colorStops: {
      0: { color: gradientStartColor },
      1: { color: gradientEndColor },
    },
    easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    extraColorStopsPerTransition: 12,
  });

  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const carouselHeight = windowHeight * 0.7;

  const router = useRouter();

  const { sections, randomItemsQuery } = useHomeSections(currentServer);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselScrollOffset = useSharedValue(0);
  const carouselProgress = useSharedValue(0);
  const carouselTextProgress = useSharedValue(0);
  const isFocused = useIsFocused();

  const carouselItems = useMemo(() => {
    return randomItemsQuery.data ?? [];
  }, [randomItemsQuery.data]);

  const carouselImageInfos = useMemo(() => {
    return carouselItems.map((item) => {
      const imageInfo = mediaAdapter.getImageInfo({
        item,
        opts: {
          preferBackdrop: true,
          preferThumb: true,
        },
      });
      const logoImageInfo = mediaAdapter.getImageInfo({
        item,
        opts: { preferLogo: true, width: 400 },
      });
      return {
        imageUrl: imageInfo.url,
        blurhash: imageInfo.blurhash,
        logoImageUrl: logoImageInfo.url?.replace('Primary', 'Logo'),
      };
    });
  }, [carouselItems, mediaAdapter]);

  const handleServerSelect = useCallback(
    (serverId: string) => {
      setCurrentServer(servers.find((server) => server.id === serverId)!);
      refreshServerInfo(serverId);

      if (navigationRef.current && rootNavigationState) {
        const rootRoute = rootNavigationState.routes.find((route) => route.name === '__root');
        if (rootRoute && rootRoute.state) {
          const tabsRoute = rootRoute.state.routes.find((route) => route.name === '(tabs)');
          if (tabsRoute && tabsRoute.state) {
            const resetRoutes = tabsRoute.state.routes.map((route) => ({
              name: route.name,
              params: route.name === 'index' ? undefined : { screen: 'index' },
            }));

            navigationRef.current.reset({
              index: 0,
              routes: [
                {
                  name: '__root',
                  state: {
                    index: 0,
                    routes: [
                      {
                        name: '(tabs)',
                        state: {
                          index: 0,
                          routes: resetRoutes,
                        },
                      },
                    ],
                  },
                },
              ],
            });
          }
        }
      }
    },
    [servers, setCurrentServer, refreshServerInfo, navigationRef, rootNavigationState],
  );

  useEffect(() => {
    if (carouselItems.length === 0) {
      setCarouselIndex(0);
      carouselScrollOffset.value = 0;
      return;
    }
  }, [carouselItems.length, carouselScrollOffset]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        servers && servers.length > 0 ? (
          <View style={styles.headerButtons}>
            <MenuView
              isAnchoredToRight
              title="服务器列表"
              onPressAction={({ nativeEvent }) => {
                const serverId = nativeEvent.event;
                if (serverId && serverId !== 'current') {
                  handleServerSelect(serverId);
                }
              }}
              actions={[
                ...(servers.map((server) => ({
                  id: server.id,
                  title: server.name,
                  state:
                    currentServer?.id === server.id
                      ? 'on'
                      : Platform.select({
                          ios: 'off',
                          android: 'mixed',
                        }),
                })) as MenuAction[]),
              ]}
            >
              <TouchableOpacity style={styles.serverButton}>
                <AvatarImage
                  key={currentServer?.id}
                  avatarUri={currentServer?.userAvatar}
                  style={styles.serverButtonAvatar}
                />
              </TouchableOpacity>
            </MenuView>
          </View>
        ) : undefined,
    });
  }, [
    currentServer?.userAvatar,
    navigation,
    servers,
    currentServer?.id,
    handleServerSelect,
    currentServer,
  ]);

  const handleCarouselItemPress = useCallback(
    (item: MediaItem) => {
      if (!item?.id) return;

      switch (item.type) {
        case 'Movie':
          router.push({ pathname: '/movie/[id]', params: { id: item.id } });
          return;
        case 'Series':
          router.push({ pathname: '/series/[id]', params: { id: item.id } });
          return;
        case 'Season':
          router.push({
            pathname: '/episode',
            params: { seasonId: item.id },
          });
          return;
        case 'Episode':
          router.push({
            pathname: '/episode',
            params: { episodeId: item.id, seasonId: item.seasonId },
          });
          return;
        default:
          if (item.seriesId) {
            router.push({ pathname: '/series/[id]', params: { id: item.seriesId } });
          }
      }
    },
    [router],
  );

  const renderMainCarouselItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const imageInfo = carouselImageInfos[index];
      const imageUrl = imageInfo?.imageUrl;

      return (
        <View style={[styles.carouselItemWrapper, { height: carouselHeight }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.carouselCard}
            onPress={() => handleCarouselItemPress(item)}
          >
            {imageUrl ? (
              <ItemImage
                uri={imageUrl}
                style={[styles.carouselImage, { backgroundColor }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                placeholderBlurhash={imageInfo.blurhash}
              />
            ) : (
              <View
                style={[
                  styles.carouselImage,
                  styles.carouselPlaceholder,
                  { backgroundColor: carouselPlaceholderColor },
                ]}
              >
                <IconSymbol name="video.fill" size={48} color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [
      carouselImageInfos,
      carouselHeight,
      handleCarouselItemPress,
      backgroundColor,
      carouselPlaceholderColor,
    ],
  );

  const renderTextCarouselItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const title = item.seriesName || item.name || '未知标题';
      const subtitle = getSubtitle(item);
      const imageInfo = carouselImageInfos[index];
      const logoImageUrl = imageInfo?.logoImageUrl;

      return (
        <View style={styles.carouselTextContainer}>
          {logoImageUrl ? (
            <Image
              source={{ uri: logoImageUrl }}
              style={styles.carouselLogo}
              contentFit="contain"
            />
          ) : (
            <ThemedText style={styles.carouselTitle} numberOfLines={1}>
              {title}
            </ThemedText>
          )}
          {subtitle ? (
            <ThemedText style={styles.carouselSubtitle} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      );
    },
    [carouselImageInfos],
  );

  if (servers.length === 0 && isInitialized) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <IconSymbol name="externaldrive.connected.to.line.below" size={48} color="#9AA0A6" />
        <ThemedText style={styles.emptyTitle}>还没有服务器</ThemedText>
        <ThemedText style={styles.emptySubtitle}>添加一个媒体服务器以开始使用</ThemedText>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/media')}>
          <ThemedText style={styles.primaryButtonText}>添加服务器</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ParallaxScrollView
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ top: -100 }}
      style={{ flex: 1, backgroundColor }}
      headerHeight={carouselHeight}
      enableMaskView
      gradientColors={colors as unknown as [string, string]}
      gradientLocations={locations as unknown as [number, number]}
      contentStyle={{ gap: 2, backgroundColor }}
      headerImage={
        <View>
          {carouselItems.length > 0 && (
            <Carousel
              width={windowWidth}
              height={carouselHeight}
              data={carouselItems}
              defaultScrollOffsetValue={carouselScrollOffset}
              loop={carouselItems.length > 1}
              autoPlay={isFocused && carouselItems.length > 1}
              autoPlayInterval={6500}
              scrollAnimationDuration={900}
              pagingEnabled
              onSnapToItem={(index) => setCarouselIndex(index)}
              onConfigurePanGesture={(panGesture) => {
                return panGesture.activeOffsetX([-5, 5]).failOffsetY([-20, 20]);
              }}
              onProgressChange={carouselProgress}
              renderItem={renderMainCarouselItem}
            />
          )}
        </View>
      }
    >
      <View>
        {carouselItems.length > 0 && (
          <Carousel
            width={windowWidth}
            height={120}
            data={carouselItems}
            defaultScrollOffsetValue={carouselScrollOffset}
            loop={carouselItems.length > 1}
            autoPlay={false}
            scrollAnimationDuration={900}
            pagingEnabled
            onConfigurePanGesture={(panGesture) => {
              return panGesture.activeOffsetX([-10, 10]);
            }}
            onProgressChange={carouselTextProgress}
            style={styles.carouselContainer}
            renderItem={renderTextCarouselItem}
          />
        )}
        {carouselItems.length > 1 && (
          <View style={styles.carouselIndicatorsContainer} pointerEvents="none">
            <View style={styles.carouselIndicators}>
              {carouselItems.map((item, index) => (
                <ThemedView
                  key={item.id ?? `${item.type}-${item.seriesId ?? index}`}
                  style={[
                    styles.carouselIndicatorDot,
                    index === carouselIndex && styles.carouselIndicatorDotActive,
                  ]}
                  lightColor={index === carouselIndex ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.25)'}
                  darkColor={
                    index === carouselIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'
                  }
                />
              ))}
            </View>
          </View>
        )}
        <View style={{ gap: 24, marginTop: 24 }}>
          {sections.map((section) => {
            if (section.type === 'resume') {
              if (!section.isLoading && section.items.length === 0) return null;
              return (
                <Section
                  key={section.key}
                  title={section.title}
                  onViewAll={() => router.push('/view-all/resume')}
                  items={section.items}
                  isLoading={section.isLoading}
                />
              );
            }
            if (section.type === 'nextup') {
              if (!section.isLoading && section.items.length === 0) return null;
              return (
                <Section
                  key={section.key}
                  title={section.title}
                  onViewAll={() => router.push('/view-all/nextup')}
                  items={section.items}
                  isLoading={section.isLoading}
                />
              );
            }
            if (section.type === 'userview') {
              return (
                <UserViewSection
                  key={section.key}
                  title={section.title}
                  userView={section.items}
                  isLoading={section.isLoading}
                />
              );
            }
            if (section.type === 'latest') {
              if (!section.isLoading && section.items.length === 0) return null;
              const folderId = section.key.replace('latest_', '');
              return (
                <Section
                  key={section.key}
                  title={section.title}
                  onViewAll={() =>
                    router.push({
                      pathname: '/view-all/[type]',
                      params: {
                        folderId,
                        folderName: section.title.replace('最近添加的 ', ''),
                        type: 'latest',
                      },
                    })
                  }
                  items={section.items}
                  isLoading={section.isLoading}
                  type="series"
                />
              );
            }
            return null;
          })}
        </View>
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselContainer: {
    position: 'absolute',
    bottom: 0,
    justifyContent: 'center',
  },
  carouselItemWrapper: {
    flex: 1,
    width: '100%',
  },
  carouselCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#151718',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselTextContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    gap: 6,
    zIndex: 2,
    textAlign: 'center',
  },
  carouselTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  carouselSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  carouselLogo: {
    height: 60,
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  carouselIndicatorsContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  carouselIndicatorDotActive: {
    width: 16,
  },
  serverButton: {
    borderWidth: 1,
    borderColor: '#f2f2f2',
    borderRadius: 64,
    backgroundColor: '#f2f2f2',
    overflow: 'hidden',
  },
  serverButtonAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
