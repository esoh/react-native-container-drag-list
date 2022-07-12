import React, {useCallback, useEffect, useRef} from 'react';
import {update, get} from 'object-path-immutable';
import {
  useDerivedValue,
  useSharedValue,
  runOnJS,
  SharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Offsets,
  DragState,
  Measurements,
  Data,
  MetaProps,
  Item,
  Direction,
  Container,
  SortOrder,
  SortOrderContainer,
} from './types';
import DraggableItem from './DraggableItem';
import DraggableContainer from './DraggableContainer';
import {
  dataToOrder,
  fromOrderAndMeasurementsToOffsets,
  move,
  getCurrentPosition,
  getNewPosition,
  arePositionsEqual,
  createRangeMap,
} from './utils';
import {DIRECTION} from './constants';

const {UP, DOWN} = DIRECTION;

function DraggablesView({
  data,
  metaProps: {
    renderItem,
    renderContainer,
    isItemContainer,
    containerItemsPath,
    containerKeyExtractor,
    keyExtractor,
  },
  measurements,
  onDragStart,
  onDragEnd,
  dragState,
  scrollOffset,
  onChange,
  scrollIfNeeded,
  scrollViewScreenY,
  contentViewY,
}: {
  data: Data;
  metaProps: MetaProps;
  measurements: SharedValue<Measurements | undefined>;
  onDragStart: (id: string, isContainer: boolean) => void;
  onDragEnd: () => void;
  dragState: DragState;
  onChange: (newData: Data) => void;
  scrollIfNeeded: (
    yFinger: number,
    lastGestureDirection: Direction | null,
  ) => void; // worklet func
  scrollViewScreenY: SharedValue<number>; // scrollview y offset within screen
  scrollOffset: SharedValue<number>; // scrollview content y offset within scrollview
  contentViewY: SharedValue<number>; // y where items start within scrollview content
}) {
  const pendingSortOrder = useSharedValue(
    dataToOrder(data, {
      isItemContainer,
      containerItemsPath,
      containerKeyExtractor,
      keyExtractor,
    }),
  );

  const dataRef = useRef(data);
  useEffect(() => {
    pendingSortOrder.value = dataToOrder(data, {
      isItemContainer,
      containerItemsPath,
      containerKeyExtractor,
      keyExtractor,
    });
    dataRef.current = data;
  }, [data]);

  const onChangeSortOrder = useCallback(
    (sortOrder: SortOrder) => {
      const items: Array<{id: string; item: Item}> = [];
      const containers: Array<{id: string; item: Container}> = [];
      dataRef.current.forEach((rootItem: Item | Container) => {
        if (isItemContainer(rootItem)) {
          containers.push({
            id: containerKeyExtractor(rootItem),
            item: rootItem,
          });
          get(rootItem, containerItemsPath).forEach((child: Item) => {
            items.push({
              id: keyExtractor(child),
              item: child,
            });
          });
        } else {
          items.push({
            id: keyExtractor(rootItem),
            item: rootItem,
          });
        }
      });

      const newData = sortOrder.map((orderObj: string | SortOrderContainer) => {
        const isContainer = typeof orderObj === 'object';
        if (isContainer) {
          const container = containers.find(c => c.id === orderObj.id)
            ?.item as Container;
          return update(container, containerItemsPath, () =>
            orderObj.items.map(
              id => items.find(i => i.id === id)?.item as Item,
            ),
          );
        }
        return items.find(i => i.id === orderObj)?.item as Item;
      });

      onChange(newData);
    },
    [data],
  );

  // calculate offsets using measurements and data.
  const offsets = useDerivedValue<Offsets | null>(() => {
    return fromOrderAndMeasurementsToOffsets(
      pendingSortOrder.value,
      measurements.value,
    );
  }, []);

  const isDraggingValue = useSharedValue(false);
  const isDraggingContainerValue = useSharedValue(false);
  const itemBeingDraggedIdValue = useSharedValue<string | null>(null);
  // original scroll offset - we need this because the original y is in
  // reference to the scrollview content, not the screen.
  const origScrollOffset = useSharedValue<number | null>(null);
  // need to know where to render the dragged item in respect to the screen,
  // in case the offsets change upon dragging.
  const origContentOffset = useSharedValue<number | null>(null);
  // to detect the last drag gesture direction to see if we need to scroll
  const prevEventY = useSharedValue<number | null>(null);
  const dragScreenOffset = useSharedValue(0);
  const dragItemTranslateYValue = useDerivedValue(
    () =>
      dragScreenOffset.value +
      (origContentOffset.value || 0) +
      ((scrollOffset.value ?? 0) - (origScrollOffset.value ?? 0)),
  );
  // finger absoluteY
  const fingerScreenY = useSharedValue(0);
  const rangeMap = useDerivedValue(() =>
    createRangeMap(
      measurements.value,
      pendingSortOrder.value,
      offsets.value,
      isDraggingContainerValue.value,
    ),
  );

  const createDragProps = useCallback(
    ({id, isContainer}: {id: string; isContainer: boolean}) => ({
      onDragStart: (itemContentOffsetY: number, absoluteY: number) => {
        'worklet';

        origScrollOffset.value = scrollOffset.value;
        origContentOffset.value = itemContentOffsetY;

        isDraggingValue.value = true;
        isDraggingContainerValue.value = isContainer;
        itemBeingDraggedIdValue.value = id;
        dragScreenOffset.value = 0;

        fingerScreenY.value = absoluteY;

        runOnJS(onDragStart)(id, isContainer);
      },
      onDrag: (eventY: number, absoluteY: number) => {
        'worklet';

        // this shouldn't be possible
        if (itemBeingDraggedIdValue.value === null) {
          return;
        }

        dragScreenOffset.value = eventY;

        // TODO fingerY will change the order if needed
        fingerScreenY.value = absoluteY;
        const fingerContentY =
          scrollOffset.value -
          scrollViewScreenY.value +
          fingerScreenY.value -
          contentViewY.value;
        const isContainerInternal = isDraggingContainerValue.value;
        const currentPosition = getCurrentPosition(
          {id: itemBeingDraggedIdValue.value, isContainer: isContainerInternal},
          pendingSortOrder.value,
        );

        // shouldn't happen
        if (currentPosition === null || rangeMap.value === null) {
          return;
        }

        const newPosition = getNewPosition(
          currentPosition,
          fingerContentY,
          rangeMap.value,
        );
        if (!arePositionsEqual(currentPosition, newPosition)) {
          const newSortOrder = move(
            pendingSortOrder.value,
            currentPosition,
            newPosition,
          );
          pendingSortOrder.value = newSortOrder;
        }

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
      },
      onDragEnd: (cbfunc: () => void) => {
        'worklet';

        origScrollOffset.value = null;
        origContentOffset.value = null;

        isDraggingValue.value = false;
        dragScreenOffset.value = withTiming(0, {}, () => {
          cbfunc();
        });
        onChangeSortOrder(pendingSortOrder.value);
        runOnJS(onDragEnd)();
      },
    }),
    [onChangeSortOrder],
  );

  const animatingParentContainers = useSharedValue<Array<string>>([]);

  const newDraggableItem = ({item}: {item: Item}) => {
    const id = keyExtractor(item);
    return (
      <DraggableItem
        key={id}
        id={id}
        renderItem={renderItem}
        item={item}
        dragState={dragState}
        offsets={offsets}
        pendingSortOrder={pendingSortOrder}
        {...createDragProps({id, isContainer: false})}
        dragValues={{
          isDraggingValue,
          isDraggingContainerValue,
          itemBeingDraggedIdValue,
          dragItemTranslateYValue,
          animatingParentContainers,
        }}
      />
    );
  };

  const newDraggableContainer = useCallback(
    ({
      containerItem,
      childItems,
    }: {
      containerItem: Container;
      childItems: Array<Item>;
    }) => {
      const id = containerKeyExtractor(containerItem);
      return (
        <DraggableContainer
          id={id}
          key={id}
          renderContainer={renderContainer}
          containerItem={containerItem}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          childItems={childItems}
          dragState={dragState}
          offsets={offsets}
          pendingSortOrder={pendingSortOrder}
          {...createDragProps({id, isContainer: true})}
          dragValues={{
            isDraggingValue,
            isDraggingContainerValue,
            itemBeingDraggedIdValue,
            dragItemTranslateYValue,
            animatingParentContainers,
          }}
        />
      );
    },
    [offsets, dragState, createDragProps],
  );

  const draggables: Array<React.ReactNode> = [];
  data.forEach(rootItem => {
    if (isItemContainer(rootItem)) {
      const childItems = get(rootItem, containerItemsPath);

      childItems.forEach((child: Item) => {
        draggables.push(newDraggableItem({item: child}));
      });

      draggables.push(
        newDraggableContainer({
          containerItem: rootItem,
          childItems,
        }),
      );
    } else {
      draggables.push(newDraggableItem({item: rootItem}));
    }
  });

  return <>{draggables}</>;
}

export default React.memo(DraggablesView, (prev, next) => {
  return prev.data === next.data && prev.dragState === next.dragState;
});
