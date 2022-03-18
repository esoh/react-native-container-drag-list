/* eslint-disable no-param-reassign */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { DIRECTION } from '../constants';
import {
  getCurrentPosition,
  getNewPosition,
  move,
  positionsEqual,
} from './utils';

const { UP, DOWN } = DIRECTION;

function Draggable({
  renderContainer,
  renderItem,
  item,
  id,
  containerItem,
  isContainer,
  offsets,
  pendingSortOrder,
  scrollIfNeeded,
  scrollOffset,
  scrollViewScreenY,
  contentViewY,
  onDragStart,
  onDragEnd,
  childItems,
  keyExtractor,
  rangeMap,
  rootItemRangeMap,
  onChangeSortOrder,

  animatingContainers,
  dragState,
  dragItemTranslateY,
  dragScreenOffset,
  dragStateVal,
}) {
  const isAnimating = useSharedValue(false);

  const dragStateProp = {
    ...dragState,
    isAnimating,
  };

  // to detect the last drag gesture direction
  const prevEventY = useSharedValue(null);

  const offset = useDerivedValue(() => {
    const offsetObject = isContainer
      ? offsets.value?.containers?.find(c => c.id === id)
      : offsets.value?.items?.find(i => i.id === id);
    return offsetObject;
  });

  const containerIdVal = useDerivedValue(() => {
    if (isContainer) return null;

    const containerOrderObj = pendingSortOrder.value.find(orderItem => {
      if (!orderItem?.items) return false;
      return orderItem.items.includes(id);
    });

    if (!containerOrderObj) return null;
    return containerOrderObj.id;
  });

  const offsetFromContainer = useDerivedValue(() => {
    const containerOffsetObj = offsets.value?.containers?.find(c => c.id === containerIdVal.value);
    if (offset.value?.y != null && containerOffsetObj?.y != null) {
      return offset.value.y - containerOffsetObj.y;
    }
    return 0;
  });

  const style = useAnimatedStyle(() => {
    const isDragging = dragStateVal.value.isDragging
      && !!dragStateVal.value.isContainer === !!isContainer
      && dragStateVal.value.id === id;

    const isParentContainerDragging = dragStateVal.value.isContainer
      && dragStateVal.value.id === containerIdVal.value;
    const isParentContainerAnimating = animatingContainers.value.includes(containerIdVal.value);

    let translateY;
    if (isDragging) {
      translateY = dragItemTranslateY.value;
    } else if (isParentContainerDragging) {
      translateY = dragItemTranslateY.value + offsetFromContainer.value;
    } else {
      translateY = withTiming(offset.value?.y);
    }

    let zIndex;
    if (isAnimating.value || isParentContainerAnimating) {
      zIndex = 2;
    } else {
      zIndex = isContainer ? 0 : 1;
    }

    return {
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex,
      // HACK - without the withTiming, the opacity refuses to change
      opacity: withTiming(
        offset.value?.y === undefined ? 0 : 1,
        { duration: 50 },
      ),
      shadowOffset: {
        width: 0,
        height: withTiming(isDragging ? 2 : 0),
      },
      shadowOpacity: withTiming(isDragging ? 0.23 : 0),
      shadowRadius: withTiming(isDragging ? 2.62 : 0),
      elevation: withTiming(isDragging ? 4 : 0),
      right: 0,
      transform: offset.value?.y !== undefined ? [
        { translateY },
      ] : undefined,
    };
  });

  const containerContentStyle = useAnimatedStyle(() => ({
    height: withTiming(offset.value?.contentHeight || 0),
    opacity: 0,
  }));

  const [position, setPosition] = useState({});
  useDerivedValue(() => {
    let pos;
    if (isContainer) {
      pos = { rootIndex: pendingSortOrder.value.findIndex(o => o?.id === id) };
    } else {
      for (let i = 0; i < pendingSortOrder.value.length; i += 1) {
        const orderObj = pendingSortOrder.value[i];
        if (orderObj?.id != null) {
          const childIndex = orderObj.items.findIndex(child => child === id);
          if (childIndex !== -1) {
            pos = { rootIndex: i, childIndex };
            break;
          }
        }
        if (orderObj === id) {
          pos = { rootIndex: i };
          break;
        }
      }
    }

    runOnJS(setPosition)(pos);
  });

  const children = isContainer ? (
    <Animated.View style={containerContentStyle}>
      {childItems.map((child, childIndex) => (
        <View key={keyExtractor(child)} style={{ flex: 1 }}>
          {renderItem({
            item: child,
            containerItem,
            dragState: dragStateProp,
            onChangeHeightVal: () => {
              'worklet';
            },
            position: {
              rootIndex: position.rootIndex,
              childIndex,
            },
          })}
        </View>
      ))}
    </Animated.View>
  ) : undefined;

  // finger absoluteY
  const fingerScreenY = useSharedValue(0);

  const handleDragStart = absoluteY => {
    'worklet';

    onDragStart(id, isContainer, offset.value?.y);
    isAnimating.value = true;
    fingerScreenY.value = absoluteY;
    if (isContainer) {
      const containers = [...animatingContainers.value];
      containers.push(id);
      animatingContainers.value = containers;
    }
    dragScreenOffset.value = 0;
  };

  const handleDragEnd = () => {
    'worklet';

    onDragEnd(id, isContainer);
    if (!dragScreenOffset.value) {
      isAnimating.value = false;
      if (isContainer) {
        animatingContainers.value = [
          ...animatingContainers.value.filter(containerId => containerId !== id),
        ];
      }
    }
    dragScreenOffset.value = withTiming(
      0,
      {},
      () => {
        isAnimating.value = false;
        if (isContainer) {
          animatingContainers.value = [
            ...animatingContainers.value.filter(containerId => containerId !== id),
          ];
        }
      },
    );
    runOnJS(onChangeSortOrder)(pendingSortOrder.value);
  };

  const handleDrag = (eventY, absoluteY) => {
    'worklet';

    fingerScreenY.value = absoluteY;

    // eventY is Y in reference to the screen, not the scrollview content, and
    // starts at 0.
    dragScreenOffset.value = eventY;

    let lastGestureDirection = null;
    if (prevEventY.value !== null) {
      if (prevEventY.value > eventY) {
        lastGestureDirection = UP;
      } else if (prevEventY.value < eventY) {
        lastGestureDirection = DOWN;
      }
    }
    prevEventY.value = eventY;

    scrollIfNeeded(absoluteY, lastGestureDirection);

    const fingerContentY = scrollOffset.value
      - scrollViewScreenY.value + fingerScreenY.value - contentViewY.value;

    const resolvedRangeMap = isContainer ? rootItemRangeMap.value : rangeMap.value;

    // 1. get position of the current item using id/isContainer/pendingSortOrder
    const currentPosition = getCurrentPosition(id, isContainer, pendingSortOrder.value);
    // 2. use rangeMap + position to calculate new position
    const newPosition = getNewPosition(currentPosition, fingerContentY, resolvedRangeMap);
    if (!positionsEqual(currentPosition, newPosition)) {
      const newSortOrder = move(pendingSortOrder.value, currentPosition, newPosition);
      pendingSortOrder.value = newSortOrder;
    }
  };

  const renderFn = isContainer ? renderContainer : renderItem;

  return (
    <Animated.View style={style}>
      {renderFn({
        containerItem,
        item,
        children,
        dragProps: {
          onDragStart: handleDragStart,
          onDragEnd: handleDragEnd,
          onDrag: handleDrag,
        },
        dragState: dragStateProp,
        onChangeHeightVal: () => { 'worklet'; },
        position,
      })}
    </Animated.View>
  );
}

export default Draggable;
