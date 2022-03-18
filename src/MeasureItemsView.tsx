import React, { useRef, useMemo } from 'react';
import { View } from 'react-native';
import { cloneDeep } from 'lodash';
import { get } from 'object-path-immutable';

const removeDeleted = (measurementsInput, data, {
  isItemContainer,
  containerItemsPath,
  containerKeyExtractor,
  keyExtractor,
}) => {
  const containerItems = [];
  const items = [];
  const measurements = cloneDeep(measurementsInput);

  data.forEach(rootItem => {
    if (isItemContainer(rootItem)) {
      get(rootItem, containerItemsPath).forEach(childItem => {
        const childMeas = measurements.items.find(i => i.id === keyExtractor(childItem));
        if (childMeas) items.push(childMeas);
      });
      const containerMeas = measurements.containerItems.find(
        i => i.id === containerKeyExtractor(rootItem),
      );
      if (containerMeas) containerItems.push(containerMeas);
    } else {
      const itemMeas = measurements.items.find(i => i.id === keyExtractor(rootItem));
      if (itemMeas) items.push(itemMeas);
    }
  });
  return { containerItems, items };
};

// TODO - might wanna add dragState so that height and measurements are always
// up to date, such that if a dragState changes measurements, it will take
// effect on the MeasureItemsView items.

function MeasureItemsView({
  data,
  metaProps: {
    renderItem,
    renderContainer,
    isItemContainer,
    containerItemsPath,
    containerKeyExtractor,
    keyExtractor,
  },
  onChangeHeight,
  onChangeMeasurements,
  dragState,
  providedItemHeightsVal,
}) {
  const allMeasured = measurements => data.every(rootItem => {
    if (isItemContainer(rootItem)) {
      const childrenMeasured = get(rootItem, containerItemsPath).every(childItem => {
        const childId = keyExtractor(childItem);
        const meas = measurements.items.find(({ id }) => id === childId);
        return (meas?.height !== undefined);
      });
      if (!childrenMeasured) return false;

      const containerId = containerKeyExtractor(rootItem);
      const meas = measurements.containerItems.find(({ id }) => id === containerId);
      return meas
        && meas.startY !== undefined
        && meas.endY !== undefined
        && meas.height !== undefined;
    }
    const itemId = keyExtractor(rootItem);
    const meas = measurements.items.find(({ id }) => id === itemId);
    return meas?.height !== undefined;
  });

  const measurements = useRef({ containerItems: [], items: [] });

  const handleOnLayout = (id, isContainer = false) => ({ nativeEvent: { layout: { height } } }) => {
    if (isContainer) {
      const containerMeasIdx = measurements.current.containerItems.findIndex(c => c.id === id);
      if (containerMeasIdx !== -1) {
        measurements.current.containerItems[containerMeasIdx] = {
          ...measurements.current.containerItems[containerMeasIdx],
          height,
        };
      } else {
        measurements.current.containerItems.push({ id, height });
      }
    } else {
      const itemMeasIdx = measurements.current.items.findIndex(i => i.id === id);
      if (itemMeasIdx !== -1) {
        measurements.current.items[itemMeasIdx] = {
          ...measurements.current.items[itemMeasIdx],
          height,
        };
      } else {
        measurements.current.items.push({ id, height });
      }
    }
    if (allMeasured(measurements.current)) onChangeMeasurements({ ...measurements.current });
  };

  const handleTopPlaceholderOnLayout = id => ({ nativeEvent: { layout: { y } } }) => {
    const containerMeasIdx = measurements.current.containerItems.findIndex(c => c.id === id);
    if (containerMeasIdx !== -1) {
      measurements.current.containerItems[containerMeasIdx] = {
        ...measurements.current.containerItems[containerMeasIdx],
        startY: y,
      };
    } else {
      measurements.current.containerItems.push({ id, startY: y });
    }
    if (allMeasured(measurements.current)) onChangeMeasurements({ ...measurements.current });
  };

  const handleBottomPlaceholderOnLayout = id => ({ nativeEvent: { layout: { y } } }) => {
    const containerMeasIdx = measurements.current.containerItems.findIndex(c => c.id === id);
    if (containerMeasIdx !== -1) {
      measurements.current.containerItems[containerMeasIdx] = {
        ...measurements.current.containerItems[containerMeasIdx],
        endY: y,
      };
    } else {
      measurements.current.containerItems.push({ id, endY: y });
    }
    if (allMeasured(measurements.current)) onChangeMeasurements({ ...measurements.current });
  };

  const handleChangeItemHeight = id => h => {
    'worklet';

    const providedItemHeights = [...providedItemHeightsVal.value];
    const idx = providedItemHeights.findIndex(i => i.id === id);
    if (idx === -1) {
      providedItemHeights.push({ id, height: h });
    } else {
      providedItemHeights[idx] = { id, height: h };
    }
    providedItemHeightsVal.value = providedItemHeights;
  };

  // THIS IS STEP 1
  const items = useMemo(() => {
    measurements.current = removeDeleted(measurements.current, data, {
      isItemContainer,
      containerItemsPath,
      containerKeyExtractor,
      keyExtractor,
    });
    return data.map((item, rootIndex) => {
      if (isItemContainer(item)) {
        const children = get(item, containerItemsPath).map((child, childIndex) => {
          const id = keyExtractor(child);
          return (
            <View key={id} onLayout={handleOnLayout(id)}>
              {renderItem({
                item: child,
                dragState,
                onChangeHeightVal: handleChangeItemHeight(id),
                position: { rootIndex, childIndex },
              })}
            </View>
          );
        });

        const id = containerKeyExtractor(item);
        // This placeholder view will tell us where the items begin in the
        // container
        children.unshift(
          <View
            key="placeholder-top"
            onLayout={handleTopPlaceholderOnLayout(id)}
          />,
        );

        children.push(
          <View
            key="placeholder-bottom"
            onLayout={handleBottomPlaceholderOnLayout(id)}
          />,
        );

        // return container
        return (
          <View key={id} onLayout={handleOnLayout(id, true)}>
            {renderContainer({
              children,
              containerItem: item,
              dragState,
            })}
          </View>
        );
      }

      // return items
      const id = keyExtractor(item);
      return (
        <View key={id} onLayout={handleOnLayout(id)}>
          {renderItem({
            item,
            dragState,
            onChangeHeightVal: handleChangeItemHeight(id),
            position: {
              value: { rootIndex },
            },
          })}
        </View>
      );
    });
  }, [data, dragState]);

  return (
    <View
      onLayout={({ nativeEvent: { layout: { height } } }) => {
        onChangeHeight(height);
      }}
      style={{
        opacity: 0,
        position: 'absolute',
        overflow: 'hidden',
        zIndex: -3,
      }}
    >
      {items}
    </View>
  );
}

export default MeasureItemsView;

