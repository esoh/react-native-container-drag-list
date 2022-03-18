import { get } from 'object-path-immutable';
import { CONTAINER_TYPE } from '../constants';

const { TOP, BOTTOM } = CONTAINER_TYPE;

export const dataToOrder = (data, {
  isItemContainer,
  containerItemsPath,
  containerKeyExtractor,
  keyExtractor,
}) => data.map(rootItem => {
  if (isItemContainer(rootItem)) {
    const items = get(rootItem, containerItemsPath)
      .map(childItem => keyExtractor(childItem));

    return {
      id: containerKeyExtractor(rootItem),
      items,
    };
  }
  return keyExtractor(rootItem);
});

export const getCurrentPosition = (id, isContainer, sortOrder) => {
  'worklet';

  if (isContainer) {
    const rootIndex = sortOrder.findIndex(orderObj => orderObj.id === id);
    return { rootIndex };
  }

  for (let i = 0; i < sortOrder.length; i += 1) {
    const currOrderObj = sortOrder[i];
    if (currOrderObj === id) return { rootIndex: i };

    if (currOrderObj.items?.length) {
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

const findIndex = (position, rangeMap) => {
  'worklet';

  for (let i = 0; i < rangeMap.length; i += 1) {
    const rangeObj = rangeMap[i];

    if (position.rootIndex === rangeObj.rootIndex) {
      if (position.childIndex != null) {
        if (position.childIndex === rangeObj.childIndex) return i;
      } else {
        return i;
      }
    }
  }
  return -1;
};

export const getNewPosition = (position, y, rangeMap) => {
  'worklet';

  const indexInRangeMap = findIndex(position, rangeMap);
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
        return { rootIndex: rangeObj.rootIndex + 1 };
      }
    }
    return { rootIndex: 0 };
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
          childIndex: rangeMap[i - 1].childIndex + 1,
        };
      } else {
        positionWithoutRemove = { rootIndex: rangeObj.rootIndex };
      }
      break;
    }
  }

  if (!positionWithoutRemove) {
    return { rootIndex: rangeMap[rangeMap.length - 1].rootIndex };
  }

  // if drag element is a child of a container
  // for which the pending position is of the same container,
  // then decrement childIndex.
  if (position.childIndex != null
    && positionWithoutRemove.childIndex != null
    && position.rootIndex === positionWithoutRemove.rootIndex
  ) {
    return {
      rootIndex: positionWithoutRemove.rootIndex,
      childIndex: positionWithoutRemove.childIndex - 1,
    };
  }

  if (position.childIndex != null) return positionWithoutRemove;

  return {
    rootIndex: positionWithoutRemove.rootIndex - 1,
    childIndex: positionWithoutRemove.childIndex,
  };
};

export const move = (sortOrder, removePosition, addPosition) => {
  'worklet';

  const newOrder = [];
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
          ...orderObj,
          items: orderObj.items.filter((orderItem, childIndex) => {
            if (childIndex === removePosition.childIndex) {
              removedItem = orderItem;
              return false;
            }
            return true;
          }),
        });
      } else {
        newOrder.push(orderObj);
      }
    });
  }

  if (addPosition.childIndex == null) {
    newOrder.splice(addPosition.rootIndex, 0, removedItem);
  } else {
    const orderObj = newOrder[addPosition.rootIndex];
    // for some reason if I do an array spread, it uses the same reference
    const items = orderObj.items.map(o => o);
    items.splice(addPosition.childIndex, 0, removedItem);

    newOrder[addPosition.rootIndex] = {
      ...orderObj,
      items,
    };
  }

  return newOrder;
};

export const positionsEqual = (pos0, pos1) => {
  'worklet';

  if (pos0.rootIndex !== pos1.rootIndex) return false;
  if (pos0.childIndex == null && pos1.childIndex == null) return true;
  return pos0.childIndex === pos1.childIndex;
};
