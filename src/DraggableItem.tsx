import React, {useMemo, useState} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {
  DerivedValue,
  useAnimatedStyle,
  useDerivedValue,
  SharedValue,
  withTiming,
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Position,
  SortOrderContainer,
  ItemOffset,
  ContainerOffset,
  Offsets,
  MetaProps,
  Item,
  SortOrder,
  DragState,
  DragValues,
} from './types';
import {arePositionsEqual} from './utils';

const _getCurrentPosition = (id: string, order: SortOrder) => {
  'worklet';

  for (let i = 0; i < order.length; i += 1) {
    const currOrderObj = order[i];
    if (currOrderObj === id) {
      return {rootIndex: i};
    }

    if (typeof currOrderObj === 'object') {
      const found = currOrderObj.items.findIndex(childId => childId === id);
      if (found !== -1) {
        return {
          rootIndex: i,
          childIndex: found,
        };
      }
    }
  }

  // this is possible if you just added an item - I suppose order wouldn't be
  // updated with the new item
  return null;
};

const styles = StyleSheet.create({
  draggable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});

function DraggableItem({
  id,
  offsets,
  pendingSortOrder,
  renderItem,
  item,
  dragState: dragStateProp,
  onDragStart,
  onDrag,
  onDragEnd,
  dragValues,
}: {
  id: string;
  offsets: DerivedValue<Offsets | null>;
  pendingSortOrder: SharedValue<SortOrder>;
  renderItem: MetaProps['renderItem'];
  item: Item;
  dragState: DragState;
  onDragStart: (itemContentOffsetY: number, absoluteY: number) => void; // WORKLET FUNC
  onDrag: (eventY: number, absoluteY: number) => void; // WORKLET FUNC
  onDragEnd: (cbFunc: () => void) => void; // WORKLET FUNC
  dragValues: DragValues;
}) {
  const offset = useDerivedValue<ItemOffset | ContainerOffset | undefined>(() =>
    offsets.value?.items?.find(i => i.id === id),
  );

  const isAnimatingFromDrag = useSharedValue(false);
  const dragProps = useMemo(
    () => ({
      onDragStart: (absoluteY: number) => {
        onDragStart(offset.value?.y ?? 0, absoluteY);
        isAnimatingFromDrag.value = true;
      },
      onDrag,
      onDragEnd: () => {
        onDragEnd(() => {
          'worklet';

          isAnimatingFromDrag.value = false;
        });
      },
    }),
    [],
  );

  const isDraggingValue = useDerivedValue(
    () =>
      dragValues.isDraggingValue.value &&
      !dragValues.isDraggingContainerValue.value &&
      dragValues.itemBeingDraggedIdValue.value === id,
  );
  const parentIdValue = useDerivedValue(
    () =>
      (
        pendingSortOrder.value.find(orderItem => {
          return typeof orderItem === 'object' && orderItem.items.includes(id);
        }) as SortOrderContainer | undefined
      )?.id,
  );
  const isParentContainerDraggingValue = useDerivedValue(
    () =>
      dragValues.isDraggingValue.value &&
      dragValues.isDraggingContainerValue.value &&
      dragValues.itemBeingDraggedIdValue.value === parentIdValue.value,
  );
  const dragContainerTranslateY = useDerivedValue(() => {
    if (!parentIdValue.value) {
      return null;
    }
    const containerOffsetObj = offsets.value?.containers?.find(
      c => c.id === parentIdValue.value,
    );
    if (offset.value?.y != null && containerOffsetObj?.y != null) {
      return withTiming(
        offset.value.y -
          containerOffsetObj.y +
          dragValues.dragItemTranslateYValue.value,
        {duration: 50},
      );
    }
    return null;
  });
  const dragTranslateY = useDerivedValue(() =>
    withTiming(
      (isDraggingValue.value
        ? dragValues.dragItemTranslateYValue.value
        : offset.value?.y) ?? 0,
      {duration: 50},
    ),
  );

  const style = useAnimatedStyle(() => {
    let translateY;
    if (isDraggingValue.value) {
      translateY = dragTranslateY.value;
    } else if (
      isParentContainerDraggingValue.value &&
      dragContainerTranslateY.value != null
    ) {
      translateY = dragContainerTranslateY.value;
    } else {
      translateY = withTiming(offset.value?.y ?? 0);
    }

    const isParentContainerAnimatingFromDrag =
      parentIdValue.value != null &&
      dragValues.animatingParentContainers.value.includes(parentIdValue.value);

    const zIndex =
      isAnimatingFromDrag.value || isParentContainerAnimatingFromDrag ? 2 : 1;
    return {
      transform: offset.value?.y !== undefined ? [{translateY}] : undefined,
      zIndex,
      // HACK - without the withTiming, the opacity refuses to change
      opacity: withTiming(offset.value?.y === undefined ? 0 : 1, {
        duration: 50,
      }),
    };
  }, []);

  const [position, setPosition] = useState<Position>(
    _getCurrentPosition(id, pendingSortOrder.value),
  );
  const setPositionWithCompare = (newPos) => setPosition(prev => {
    if (prev && arePositionsEqual(prev, newPos)) {
      return prev;
    }
    return newPos;
  });
  useDerivedValue(() => {
    const pos = _getCurrentPosition(id, pendingSortOrder.value);
    if (pos) {
      runOnJS(setPositionWithCompare)(pos);
    }
  }, []);

  return (
    <Animated.View style={[styles.draggable, style]}>
      {renderItem({
        item: item,
        position,
        dragProps,
        dragState: dragStateProp,
      })}
    </Animated.View>
  );
}

export default React.memo(
  DraggableItem,
  (prev, next) => prev.item === next.item && prev.dragState === next.dragState,
);
