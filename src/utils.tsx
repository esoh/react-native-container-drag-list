import {get} from 'object-path-immutable';
import {
  ContainerOffset,
  ItemOffset,
  Offsets,
  Measurements,
  ContainerMeasurements,
  ItemMeasurements,
  Data,
  MetaProps,
  Item,
  SortOrderContainer,
  SortOrder,
  Position,
  RangeMapArray,
} from './types';
import {CONTAINER_TYPE} from './constants';

const {TOP, BOTTOM} = CONTAINER_TYPE;

export const dataToOrder = (
  data: Data,
  {
    isItemContainer,
    containerItemsPath,
    containerKeyExtractor,
    keyExtractor,
  }: {
    isItemContainer: MetaProps['isItemContainer'];
    containerItemsPath: MetaProps['containerItemsPath'];
    containerKeyExtractor: MetaProps['containerKeyExtractor'];
    keyExtractor: MetaProps['keyExtractor'];
  },
): SortOrder =>
  data.map(rootItem => {
    if (isItemContainer(rootItem)) {
      const items = get(rootItem, containerItemsPath).map((childItem: Item) =>
        keyExtractor(childItem),
      );

      return {
        id: containerKeyExtractor(rootItem),
        items,
      };
    }
    return keyExtractor(rootItem);
  });

export const fromOrderAndMeasurementsToOffsets = (
  order: SortOrder,
  measurements: Measurements | undefined,
): Offsets | null => {
  'worklet';

  const containerOffsets: Array<ContainerOffset> = [];
  const itemOffsets: Array<ItemOffset> = [];

  if (measurements === undefined) {
    return null;
  }

  let y = 0;
  order.forEach((orderObj: string | SortOrderContainer) => {
    const isContainer = typeof orderObj === 'object';
    if (isContainer) {
      // calculate the y offsets of all the child items
      const containerY = y;
      const containerMeas = measurements.containerItems.find(
        (c: ContainerMeasurements) => c.id === orderObj.id,
      );
      if (containerMeas) {
        // container top height
        y += containerMeas.startY;
        let contentHeight = 0;
        orderObj.items.forEach(childId => {
          const itemHeight =
            measurements.items.find((i: ItemMeasurements) => i.id === childId)
              ?.height ?? 0;
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
      const itemHeight =
        measurements.items.find((i: ItemMeasurements) => i.id === orderObj)
          ?.height ?? 0;
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
};

export const move = (
  sortOrder: SortOrder,
  removePosition: Position,
  addPosition: Position,
) => {
  'worklet';

  const newOrder: SortOrder = [];
  let removedItem;
  if (removePosition.childIndex == null) {
    sortOrder.forEach((orderItem, rootIndex) => {
      if (rootIndex === removePosition.rootIndex) {
        removedItem = orderItem;
      } else {
        newOrder.push(orderItem);
      }
    });
  } else {
    sortOrder.forEach((orderObj, rootIndex) => {
      if (rootIndex === removePosition.rootIndex) {
        newOrder.push({
          ...(orderObj as SortOrderContainer),
          items: (orderObj as SortOrderContainer).items.filter(
            (orderItem, childIndex) => {
              if (childIndex === removePosition.childIndex) {
                removedItem = orderItem;
                return false;
              }
              return true;
            },
          ),
        });
      } else {
        newOrder.push(orderObj);
      }
    });
  }

  if (removedItem) {
    if (addPosition.childIndex == null) {
      newOrder.splice(addPosition.rootIndex, 0, removedItem);
    } else {
      const orderObj = newOrder[addPosition.rootIndex] as SortOrderContainer;
      // for some reason if I do an array spread, it uses the same reference
      const items = orderObj.items.map(o => o);
      items.splice(addPosition.childIndex, 0, removedItem);

      newOrder[addPosition.rootIndex] = {
        ...orderObj,
        items,
      };
    }
  }

  return newOrder;
};

export const getCurrentPosition = (
  {id, isContainer}: {id: string; isContainer: boolean},
  sortOrder: SortOrder,
) => {
  'worklet';

  if (isContainer) {
    const rootIndex = sortOrder.findIndex(
      orderObj => typeof orderObj === 'object' && orderObj.id === id,
    );
    return {rootIndex};
  }

  for (let i = 0; i < sortOrder.length; i += 1) {
    const currOrderObj = sortOrder[i];
    if (currOrderObj === id) {
      return {rootIndex: i};
    }

    if (typeof currOrderObj === 'object' && currOrderObj.items?.length) {
      const found = currOrderObj.items.findIndex(childId => childId === id);
      if (found !== -1) {
        return {
          rootIndex: i,
          childIndex: found,
        };
      }
    }
  }

  return null;
};

const _findIndex = (position: Position, rangeMap: RangeMapArray) => {
  'worklet';

  for (let i = 0; i < rangeMap.length; i += 1) {
    const rangeObj = rangeMap[i];

    if (position.rootIndex === rangeObj.rootIndex) {
      if (position.childIndex != null) {
        if (position.childIndex === rangeObj.childIndex) {
          return i;
        }
      } else {
        return i;
      }
    }
  }
  return -1;
};

export const getNewPosition = (
  position: Position,
  y: number,
  rangeMap: RangeMapArray,
) => {
  'worklet';

  const indexInRangeMap = _findIndex(position, rangeMap);
  // dragging up?
  // work backwards from the current position to get new position
  if (y <= rangeMap[indexInRangeMap].y) {
    for (let i = indexInRangeMap - 1; i >= 0; i -= 1) {
      if (y > rangeMap[i].y) {
        const rangeObj = rangeMap[i];
        // need to handle
        // 1. child index
        // 2. container BOTTOM
        // 3. container TOP
        // 4. root item
        if (rangeObj.childIndex != null) {
          return {
            rootIndex: rangeObj.rootIndex,
            childIndex: rangeObj.childIndex + 1,
          };
        }
        if (rangeObj.container === TOP) {
          return {
            rootIndex: rangeObj.rootIndex,
            childIndex: 0,
          };
        }
        // will handle 3 & 4
        return {rootIndex: rangeObj.rootIndex + 1};
      }
    }
    return {rootIndex: 0};
  }

  let positionWithoutRemove;
  for (let i = indexInRangeMap + 1; i < rangeMap.length; i += 1) {
    if (y < rangeMap[i].y) {
      const rangeObj = rangeMap[i];
      if (rangeObj.childIndex != null) {
        positionWithoutRemove = {
          rootIndex: rangeObj.rootIndex,
          childIndex: rangeObj.childIndex,
        };
      } else if (rangeObj.container === BOTTOM) {
        positionWithoutRemove = {
          rootIndex: rangeObj.rootIndex,
          childIndex: (rangeMap[i - 1].childIndex ?? 0) + 1,
        };
      } else {
        positionWithoutRemove = {rootIndex: rangeObj.rootIndex};
      }
      break;
    }
  }

  if (!positionWithoutRemove) {
    return {rootIndex: rangeMap[rangeMap.length - 1].rootIndex};
  }

  // if drag element is a child of a container
  // for which the pending position is of the same container,
  // then decrement childIndex.
  if (
    position.childIndex != null &&
    positionWithoutRemove.childIndex != null &&
    position.rootIndex === positionWithoutRemove.rootIndex
  ) {
    return {
      rootIndex: positionWithoutRemove.rootIndex,
      childIndex: positionWithoutRemove.childIndex - 1,
    };
  }

  if (position.childIndex != null) {
    return positionWithoutRemove;
  }

  return {
    rootIndex: positionWithoutRemove.rootIndex - 1,
    childIndex: positionWithoutRemove.childIndex,
  };
};

export const arePositionsEqual = (pos0: Position, pos1: Position) => {
  'worklet';

  if (pos0.rootIndex !== pos1.rootIndex) {
    return false;
  }
  if (pos0.childIndex == null && pos1.childIndex == null) {
    return true;
  }
  return pos0.childIndex === pos1.childIndex;
};

// creates a y offset range map of y offset to suggested position
export const createRangeMap = (
  measurements: Measurements | undefined,
  sortOrder: SortOrder,
  offsets: Offsets | null,
  isForContainer: boolean,
) => {
  'worklet';

  if (!measurements || !offsets) {
    return null;
  }

  const ranges: RangeMapArray = [];

  if (isForContainer) {
    sortOrder.forEach((orderObj, idx) => {
      const isCurrItemContainer = typeof orderObj === 'object';

      if (isCurrItemContainer) {
        const containerOffset = offsets.containers.find(
          c => c.id === orderObj.id,
        );
        if (containerOffset) {
          ranges.push({
            y: containerOffset.y + containerOffset.height / 2,
            rootIndex: idx,
          });
        }
      } else {
        const itemOffset = offsets.items.find(i => i.id === orderObj);
        if (itemOffset) {
          ranges.push({
            y: itemOffset.y + itemOffset.height / 2,
            rootIndex: idx,
          });
        }
      }
    });
  } else {
    sortOrder.forEach((orderObj: SortOrderContainer | string, idx: number) => {
      const isCurrItemContainer = typeof orderObj === 'object';

      if (isCurrItemContainer) {
        const containerMeas = measurements.containerItems.find(
          (c: ContainerMeasurements) => c.id === orderObj.id,
        );
        const containerOffset = offsets.containers.find(
          c => c.id === orderObj.id,
        );
        if (containerMeas && containerOffset) {
          const topMidY = containerMeas.startY / 2 + containerOffset.y;
          ranges.push({
            y: topMidY,
            rootIndex: idx,
            container: CONTAINER_TYPE.TOP,
          });

          orderObj.items.forEach((childId, childIdx) => {
            const childOffset = offsets.items.find(i => i.id === childId);
            if (childOffset) {
              ranges.push({
                y: childOffset.y + childOffset.height / 2,
                rootIndex: idx,
                childIndex: childIdx,
              });
            }
          });

          const bottomMidY =
            (containerMeas.endY + containerMeas.height) / 2 + containerOffset.y;
          ranges.push({
            y: bottomMidY,
            rootIndex: idx,
            container: CONTAINER_TYPE.BOTTOM,
          });
        }
      } else {
        const itemOffset = offsets.items.find(i => i.id === orderObj);
        if (itemOffset) {
          ranges.push({
            y: itemOffset.y + itemOffset.height / 2,
            rootIndex: idx,
          });
        }
      }
    });
  }
  return ranges;
};
