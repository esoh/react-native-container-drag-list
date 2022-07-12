import React, {useState, useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  DerivedValue,
  useAnimatedStyle,
  useDerivedValue,
  SharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Position,
  ItemOffset,
  ContainerOffset,
  Offsets,
  MetaProps,
  Item,
  Container,
  SortOrder,
  DragState,
  DragValues,
} from './types';
import {arePositionsEqual} from './utils';

const _getCurrentPosition = (id: string, order: SortOrder) => {
  const rootIndex = order.findIndex(
    orderObj => typeof orderObj === 'object' && orderObj.id === id,
  );
  return {rootIndex};
};

const styles = StyleSheet.create({
  draggable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  containerContentItems: {flex: 1},
});

function DraggableContainer({
  id,
  offsets,
  pendingSortOrder,
  renderItem,
  renderContainer,
  containerItem,
  childItems,
  keyExtractor,
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
  renderContainer: MetaProps['renderContainer'];
  containerItem: Container;
  childItems?: Array<Item>;
  keyExtractor: MetaProps['keyExtractor'];
  dragState: DragState;
  onDragStart: (itemContentOffsetY: number, absoluteY: number) => void; // WORKLET FUNC
  onDrag: (eventY: number, absoluteY: number) => void; // WORKLET FUNC
  onDragEnd: (cbFunc: () => void) => void; // WORKLET FUNC
  dragValues: DragValues;
}) {
  const offset = useDerivedValue<ItemOffset | ContainerOffset | undefined>(
    () => {
      const offsetObject = offsets.value?.containers?.find(c => c.id === id);
      return offsetObject;
    },
  );

  const dragProps = useMemo(
    () => ({
      onDragStart: (absoluteY: number) => {
        dragValues.animatingParentContainers.value = [
          ...dragValues.animatingParentContainers.value,
          id,
        ];
        onDragStart(offset.value?.y ?? 0, absoluteY);
      },
      onDrag,
      onDragEnd: () => {
        onDragEnd(() => {
          'worklet';

          dragValues.animatingParentContainers.value =
            dragValues.animatingParentContainers.value.filter(
              containerId => containerId !== id,
            );
        });
      },
    }),
    [],
  );

  const isDraggingValue = useDerivedValue(
    () =>
      dragValues.isDraggingValue.value &&
      dragValues.isDraggingContainerValue.value &&
      dragValues.itemBeingDraggedIdValue.value === id,
  );

  const dragTranslateY = useDerivedValue(() =>
    withTiming(
      (isDraggingValue.value
        ? dragValues.dragItemTranslateYValue.value
        : offset.value?.y) ?? 0,
      {duration: 50},
    ),
  );

  const style = useAnimatedStyle(() => {
    const translateY = isDraggingValue.value
      ? dragTranslateY.value
      : withTiming(offset.value?.y ?? 0);

    return {
      transform: offset.value?.y !== undefined ? [{translateY}] : undefined,
      zIndex: dragValues.animatingParentContainers.value.includes(id) ? 2 : 0,
      // HACK - without the withTiming, the opacity refuses to change
      opacity: withTiming(offset.value?.y === undefined ? 0 : 1, {
        duration: 50,
      }),
    };
  });

  const [position, setPosition] = useState<Position>(() => {
    return _getCurrentPosition(id, pendingSortOrder.value);
  });
  const setPositionWithCompare = (newPos) => setPosition(prev => {
    if (prev && arePositionsEqual(prev, newPos)) {
      return prev;
    }
    return newPos;
  });
  useDerivedValue(() => {
    const pos = {
      rootIndex: pendingSortOrder.value.findIndex(
        o => typeof o === 'object' && o.id === id,
      ),
    };

    if (pos) {
      runOnJS(setPositionWithCompare)(pos);
    }
  });

  const containerContentStyle = useAnimatedStyle(() => ({
    height: withTiming(
      offset.value !== undefined && 'contentHeight' in offset.value
        ? offset.value.contentHeight
        : 0,
    ),
    opacity: 0,
  }));

  const children = childItems ? (
    <Animated.View style={containerContentStyle}>
      {childItems.map((child, childIndex) => (
        <View
          key={keyExtractor(child)}
          style={styles.containerContentItems}
          pointerEvents="none"
        >
          {renderItem({
            item: child,
            dragState: dragStateProp,
            position: {
              rootIndex: position.rootIndex,
              childIndex,
            },
            dragProps: undefined,
          })}
        </View>
      ))}
    </Animated.View>
  ) : undefined;

  return (
    <Animated.View style={[styles.draggable, style]}>
      {renderContainer({
        containerItem: containerItem,
        position,
        children,
        dragProps,
        dragState: dragStateProp,
      })}
    </Animated.View>
  );
}

export default React.memo(
  DraggableContainer,
  (prev, next) =>
    prev.containerItem === next.containerItem &&
    prev.dragState === next.dragState,
);
