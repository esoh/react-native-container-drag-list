import React, { useEffect } from 'react';
import {
  useDerivedValue,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { update, get } from 'object-path-immutable';
import Draggable from './Draggable';
import { dataToOrder } from './utils';
import { CONTAINER_TYPE } from '../constants';

// While the drag translateY will be stored in the Draggable,
// this component will keep track of the offsets, and recalculate them as
// necessary.
//  It'll recalculate then whenever `data` changes, or when the heights change.
//
// Draggable will use the drag translateY if is dragging,
// but it will use the offsets as calculated if not.
function DraggableItemsView({
  data,
  metaProps: {
    renderItem,
    renderContainer,
    isItemContainer,
    containerItemsPath,
    containerKeyExtractor,
    keyExtractor,
  },
  measurements, // useSharedValue
  scrollIfNeeded,
  scrollOffset,
  scrollViewScreenY,
  contentViewY,
  onDragStart,
  onChange,
  onDragEnd,
  dragState,
  providedItemHeightsVal,
}) {
  // pendingSortOrder looks like this
  // [
  //  id-0
  //  id-1
  //  { id: id-3, items: [id-4, id-5] }
  //  id-6
  // ].
  // pendingSortOrder is modified while dragging, but we store this in a value because
  // we don't want to change the data until it's released, but we still want it
  // to change the order.
  const pendingSortOrder = useSharedValue(dataToOrder(data, {
    isItemContainer,
    containerItemsPath,
    containerKeyExtractor,
    keyExtractor,
  }));

  useEffect(() => {
    pendingSortOrder.value = dataToOrder(data, {
      isItemContainer,
      containerItemsPath,
      containerKeyExtractor,
      keyExtractor,
    });
  }, [data]);

  const onChangeSortOrder = sortOrder => {
    const items = [];
    const containers = [];
    data.forEach(rootItem => {
      if (isItemContainer(rootItem)) {
        containers.push({
          id: containerKeyExtractor(rootItem),
          item: rootItem,
        });
        get(rootItem, containerItemsPath).forEach(child => {
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

    const newData = sortOrder.map(orderObj => {
      const isContainer = orderObj?.id;
      if (isContainer) {
        const container = containers.find(c => c.id === orderObj.id).item;
        return update(container, containerItemsPath,
          () => orderObj.items.map(id => items.find(i => i.id === id).item));
      }
      return items.find(i => i.id === orderObj).item;
    });

    onChange(newData);
  };

  // calculate offsets using measurements and data.
  const offsets = useDerivedValue(() => {
    const containerOffsets = [];
    const itemOffsets = [];

    if (!measurements.value) return null;

    let y = 0;
    pendingSortOrder.value.forEach(orderObj => {
      // if it's a container, calculate the y offsets of all the child items
      if (orderObj?.id) {
        const containerY = y;
        const containerMeas = measurements.value.containerItems.find(c => c.id === orderObj.id);
        if (containerMeas) {
          // container top height
          y += containerMeas.startY;
          let contentHeight = 0;
          orderObj.items.forEach(childId => {
            const itemHeight = providedItemHeightsVal.value.find(i => i.id === childId)?.height
              ?? measurements.value.items.find(i => i.id === childId)?.height
              ?? 0;
            itemOffsets.push({
              id: childId,
              y,
              height: itemHeight,
            });
            y += itemHeight;
            contentHeight += itemHeight;
          });
          containerOffsets.push({
            id: orderObj.id,
            y: containerY,
            contentHeight,
            height: containerMeas.height,
          });
          // container bottom hiehgt
          y += containerMeas.height - containerMeas.endY;
        }
      } else {
        const itemHeight = providedItemHeightsVal.value.find(i => i.id === orderObj)?.height
          ?? measurements.value.items.find(i => i.id === orderObj)?.height
          ?? 0;
        itemOffsets.push({
          id: orderObj,
          y,
          height: itemHeight,
        });
        y += itemHeight;
      }
    });

    return {
      containers: containerOffsets,
      items: itemOffsets,
    };
  });

  // calculate range map using offsets, measurements, & order.
  const rangeMap = useDerivedValue(() => {
    if (!measurements.value) return null;

    const ranges = [];

    // an orderObj can be an id if it's an item or { id: containerId, items: []
    pendingSortOrder.value.forEach((orderObj, idx) => {
      const isCurrItemContainer = orderObj?.id !== undefined;

      if (isCurrItemContainer) {
        const containerMeas = measurements.value.containerItems.find(c => c.id === orderObj.id);
        const containerOffset = offsets.value.containers.find(c => c.id === orderObj.id);
        if (containerMeas && containerOffset) {
          const topMidY = containerMeas.startY / 2 + containerOffset.y;
          ranges.push({
            y: topMidY,
            rootIndex: idx,
            container: CONTAINER_TYPE.TOP,
          });

          orderObj.items.forEach((childId, childIdx) => {
            const childOffset = offsets.value.items.find(i => i.id === childId);
            ranges.push({
              y: childOffset.y + (childOffset.height / 2),
              rootIndex: idx,
              childIndex: childIdx,
            });
          });

          const bottomMidY = ((containerMeas.endY + containerMeas.height) / 2) + containerOffset.y;
          ranges.push({
            y: bottomMidY,
            rootIndex: idx,
            container: CONTAINER_TYPE.BOTTOM,
          });
        }
      } else {
        const itemOffset = offsets.value.items.find(i => i.id === orderObj);
        ranges.push({
          y: itemOffset.y + (itemOffset.height / 2),
          rootIndex: idx,
        });
      }
    });
    return ranges;
  });

  // solves dragging a container - cannot drag into another container
  const rootItemRangeMap = useDerivedValue(() => {
    if (!measurements.value) return null;

    const rootRangeMap = [];
    pendingSortOrder.value.forEach((orderObj, idx) => {
      const isCurrItemContainer = orderObj?.id !== undefined;

      if (isCurrItemContainer) {
        const containerOffset = offsets.value.containers.find(c => c.id === orderObj.id);
        if (containerOffset) {
          rootRangeMap.push({
            y: containerOffset.y + (containerOffset.height / 2),
            rootIndex: idx,
          });
        }
      } else {
        const itemOffset = offsets.value.items.find(i => i.id === orderObj);
        rootRangeMap.push({
          y: itemOffset.y + (itemOffset.height / 2),
          rootIndex: idx,
        });
      }
    });

    return rootRangeMap;
  });

  const animatingContainers = useSharedValue([]);

  // original scroll offset - we need this because the original y is in
  // reference to the scrollview content, not the screen.
  const origScrollOffset = useSharedValue(null);
  // need to know where to render the dragged item in respect to the screen,
  // in case the offsets change upon dragging.
  const origContentOffset = useSharedValue(null);
  const dragScreenOffset = useSharedValue(0);

  const dragItemTranslateY = useDerivedValue(() => dragScreenOffset.value
    + (origContentOffset.value || 0)
    + (scrollOffset.value - origScrollOffset.value));

  const dragStateVal = useSharedValue({
    id: null,
    isContainer: null,
    isDragging: false,
  });

  const handleDragStart = (id, isContainer = false, itemContentY) => {
    'worklet';

    origScrollOffset.value = scrollOffset.value;
    origContentOffset.value = itemContentY;
    dragStateVal.value = { id, isContainer, isDragging: true };

    runOnJS(onDragStart)(id, isContainer);
  };

  const handleDragEnd = () => {
    'worklet';

    origScrollOffset.value = null;
    origContentOffset.value = null;
    dragStateVal.value = {
      id: null,
      isContainer: null,
      isDragging: false,
    };

    runOnJS(onDragEnd)();
  };

  const draggableProps = (item, isContainer = false) => {
    const id = isContainer ? containerKeyExtractor(item) : keyExtractor(item);

    return {
      offsets,
      pendingSortOrder,
      isContainer,
      key: isContainer ? `container-${id}` : id,
      item: isContainer ? undefined : item,
      id,
      containerItem: isContainer ? item : undefined, // TODO populate for children
      renderContainer: isContainer ? renderContainer : undefined,
      renderItem,
      scrollIfNeeded,
      scrollOffset,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      dragState,
      animatingContainers,
      rangeMap,
      rootItemRangeMap,
      scrollViewScreenY,
      contentViewY,
      onChangeSortOrder,

      dragItemTranslateY,
      dragScreenOffset,
      dragStateVal,
    };
  };

  const draggables = [];
  /* eslint-disable react/jsx-props-no-spreading */
  data.forEach(rootItem => {
    if (isItemContainer(rootItem)) {
      // push child itsm
      const childItems = get(rootItem, containerItemsPath);

      childItems.forEach(child => {
        draggables.push(
          <Draggable
            {...draggableProps(child)}
            containerItem={rootItem}
          />,
        );
      });

      draggables.push(
        <Draggable
          {...draggableProps(rootItem, true)}
          childItems={childItems}
          keyExtractor={keyExtractor}
        />,
      );
    } else {
      draggables.push(<Draggable {...draggableProps(rootItem)} />);
    }
  });

  return <>{draggables}</>;
}

export default DraggableItemsView;
