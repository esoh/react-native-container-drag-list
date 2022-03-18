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
  useAnimatedStyle,
  scrollTo,
  measure,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import { View } from 'react-native';
import MeasureItemsView from './MeasureItemsView';
import DraggableItemsView from './DraggableItemsView';
import { DIRECTION } from './constants';

const { UP, DOWN } = DIRECTION;

const DRAG_THRESHOLD = 100;
const SCROLL_AMOUNT = 5;
const REFRESH_MS = 3;

function ReorderDragScrollView({
  renderItem, // fn(item, containerItem)
  renderContainer,
  data,
  onChange,
  isItemContainer,
  containerItemsPath,
  containerKeyExtractor,
  keyExtractor,
  FooterComponent,
  HeaderComponent,
  onScroll: onScrollProp, // worklet fn
}) {
  const [dragState, setDragState] = useState({
    isDragging: false,
    isContainer: null,
    id: null,
  });
  const onDragEnd = () => {
    setDragState(p => ({ ...p, isDragging: false }));
  };

  const scrollView = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const scrollAnim = useSharedValue(0);
  useEffect(() => {
    if (!dragState.isDragging) cancelAnimation(scrollAnim);
  }, [dragState.isDragging]);

  const scrollIfNeeded = (y, lastGestureDirection) => {
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

  const autoHeight = useSharedValue<undefined | number>(undefined);
  const msmts = useSharedValue(undefined);

  const measuredStyle = useAnimatedStyle(() => {
    if (autoHeight.value === undefined) return {};
    return { height: withTiming(autoHeight.value) };
  });

  const providedItemHeightsVal = useSharedValue([]);

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
        <Animated.View style={measuredStyle}>
          <DraggableItemsView
            data={data}
            metaProps={metaProps}
            measurements={msmts}
            providedItemHeightsVal={providedItemHeightsVal}
            scrollIfNeeded={scrollIfNeeded}
            scrollOffset={scrollOffset}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onChange={onChange}
            dragState={dragState}
            scrollViewScreenY={scrollViewScreenY}
            contentViewY={contentViewY}
          />
        </Animated.View>
        <MeasureItemsView
          data={data}
          metaProps={metaProps}
          onChangeMeasurements={m => { msmts.value = m; }}
          onChangeHeight={h => { autoHeight.value = h; }}
          dragState={dragState}
          providedItemHeightsVal={providedItemHeightsVal}
        />
      </View>
      <View style={{ position: 'relative', zIndex: -2 }}>
        {FooterComponent}
      </View>
    </Animated.ScrollView>
  );
}

const idExtractor = item => {
  'worklet';

  return item.id;
};

const noContainers = () => {
  'worklet';

  return false;
};

ReorderDragScrollView.defaultProps = {
  containerKeyExtractor: idExtractor,
  keyExtractor: idExtractor,
  isItemContainer: noContainers,
  HeaderComponent: null,
  FooterComponent: null,
};

export default ReorderDragScrollView;
export * from './dragHandlers';

