/*
 * LOGIC AROUND THIS COMPONENT
 *
 * 1. Render statically placed items & containers.
 *    Use onLayout for each container and item to calculate item offsets and
 *    heights.
 * 2. Once step 1 is complete, absolutely render new layout.
 * 3. Use  DragHandler. On the UI thread, if new position is sensed, then
 *    reorder and recalculate layout.
 * 4. If finger position is within the scroll range, then scroll the ScrollView.
 */

import React, {
  useState,
  useCallback,
  useEffect,
} from 'react';
import Animated, {
  runOnUI,
  useSharedValue,
  withTiming,
  useAnimatedRef,
  useAnimatedScrollHandler,
  scrollTo,
  measure,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import { View } from 'react-native';
import MeasureItemsView from './MeasureItemsView';
import DraggableItemsView from './DraggableItemsView';
import { DIRECTION } from './constants';
import {DragState, Measurements, MetaProps, Data} from './types';

const { UP, DOWN } = DIRECTION;

const DRAG_THRESHOLD = 100;
const SCROLL_AMOUNT = 5;
const REFRESH_MS = 3;

const idExtractor = item => {
  'worklet';

  return item.id;
};

const noContainers = () => {
  'worklet';

  return false;
};

function ReorderDragScrollView({
  renderItem,
  renderContainer = () => null,
  data,
  onChange,
  isItemContainer = noContainers,
  containerItemsPath = 'items',
  containerKeyExtractor = idExtractor,
  keyExtractor = idExtractor,
  FooterComponent,
  HeaderComponent,
  onScroll: onScrollProp, // worklet fn
}: {
  renderItem: MetaProps['renderItem'];
  renderContainer?: MetaProps['renderContainer'];
  data: Data;
  onChange: (newData: Data) => void;
  isItemContainer?: MetaProps['isItemContainer']; // WORKLET FUNC
  containerItemsPath?: MetaProps['containerItemsPath']; // path to array of items in a conainer, as specified by object-path-immutable
  keyExtractor?: MetaProps['keyExtractor']; // WORKLET FUNC
  containerKeyExtractor?: MetaProps['containerKeyExtractor']; // WORKLET FUNC
  FooterComponent?: React.ReactNode;
  HeaderComponent?: React.ReactNode;
  onScroll?: (y: number) => void;
}) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isContainer: null,
    id: null,
  });
  const onDragEnd = () => {
    setDragState((p: DragState) => ({ ...p, isDragging: false }));
  };

  const scrollView = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const scrollAnim = useSharedValue(0);
  useEffect(() => {
    if (!dragState.isDragging) cancelAnimation(scrollAnim);
  }, [dragState.isDragging]);

  const scrollIfNeeded = (y: number, lastGestureDirection: typeof DIRECTION.UP | typeof DIRECTION.DOWN) => {
    'worklet';

    const { height: scrollViewHeight, pageY: scrollViewY } = measure(scrollView);
    if (y <= scrollViewY + DRAG_THRESHOLD && lastGestureDirection === UP) {
      // trigger scroll loop
      scrollAnim.value = withRepeat(withTiming(0, { duration: REFRESH_MS }, () => {
        scrollOffset.value = Math.max(scrollOffset.value - SCROLL_AMOUNT, 0);
        scrollTo(scrollView, 0, scrollOffset.value, false);
      }), -1);
    } else if (y >= scrollViewY + scrollViewHeight - DRAG_THRESHOLD
      && lastGestureDirection === DOWN) {
      // trigger scroll loop
      scrollAnim.value = withRepeat(withTiming(0, { duration: REFRESH_MS }, () => {
        scrollOffset.value = Math.min(
          scrollOffset.value + SCROLL_AMOUNT, contentHeight.value - scrollViewHeight,
        );
        scrollTo(scrollView, 0, scrollOffset.value, false);
      }), -1);
    } else {
      cancelAnimation(scrollAnim);
    }
  };
  const onScroll = useAnimatedScrollHandler({
    onScroll: ({ contentOffset: { y } }) => {
      scrollOffset.value = y;
      if (onScrollProp) onScrollProp(y);
    },
  });

  const msmts = useSharedValue<Measurements>(undefined);

  // functions that describe the data
  const metaProps = {
    renderItem,
    keyExtractor,
    renderContainer,
    containerKeyExtractor,
    isItemContainer,
    containerItemsPath,
  };

  const contentViewY = useSharedValue(0);
  const scrollViewScreenY = useSharedValue(0);

  const onDragStart = useCallback((id, isContainer) => {
    runOnUI(() => {
      'worklet';

      if (scrollView) {
        const { pageY } = measure(scrollView);
        scrollViewScreenY.value = pageY;
      }
    })();
    setDragState({
      isDragging: true,
      isContainer,
      id,
    });
  }, [setDragState]);

  return (
    <Animated.ScrollView
      ref={scrollView}
      contentContainerStyle={{ flexGrow: 1 }}
      scrollEnabled={!dragState.isDragging}
      onScroll={onScroll}
      onContentSizeChange={(w, h) => {
        contentHeight.value = h;
      }}
      scrollEventThrottle={16}
    >
      <View style={{ position: 'relative', zIndex: -2 }}>
        {HeaderComponent}
      </View>
      <View
        style={{ position: 'relative', zIndex: 2 }}
        onLayout={({ nativeEvent: { layout: { y } } }) => {
          contentViewY.value = y;
        }}
      >
        <DraggableItemsView
          data={data}
          metaProps={metaProps}
          measurements={msmts}
          scrollIfNeeded={scrollIfNeeded}
          scrollOffset={scrollOffset}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onChange={onChange}
          dragState={dragState}
          scrollViewScreenY={scrollViewScreenY}
          contentViewY={contentViewY}
        />
        <MeasureItemsView
          data={data}
          metaProps={metaProps}
          onChangeMeasurements={m => {
            msmts.value = m;
          }}
          dragState={dragState}
        />
      </View>
      <View style={{ position: 'relative', zIndex: -2 }}>
        {FooterComponent}
      </View>
    </Animated.ScrollView>
  );
}

export default ReorderDragScrollView;
export * from './dragHandlers';
export * from './types';
