import React, {useRef, useMemo, useCallback} from 'react';
import {LayoutChangeEvent, View} from 'react-native';
import {cloneDeep} from 'lodash';
import {get} from 'object-path-immutable';
import {
  MeasurementsPending,
  Measurements,
  ContainerMeasurementsPending,
  ItemMeasurementsPending,
  Item,
  Data,
  Container,
  MetaProps,
  DragState,
} from './types';

type MeasureItemsViewProps = {
  data: Data;
  metaProps: MetaProps;
  onChangeMeasurements: (m: Measurements) => void;
  dragState: DragState;
};

const _removeDeleted = (
  measurementsInput: MeasurementsPending,
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
) => {
  const containerItems: Array<ContainerMeasurementsPending> = [];
  const items: Array<ItemMeasurementsPending> = [];
  const measurements = cloneDeep(measurementsInput);

  data.forEach(rootItem => {
    if (isItemContainer(rootItem)) {
      get(rootItem, containerItemsPath).forEach((childItem: Item) => {
        const childMeas = measurements.items.find(
          (i: ItemMeasurementsPending) => i.id === keyExtractor(childItem),
        );
        if (childMeas) {
          items.push(childMeas);
        }
      });
      const containerMeas = measurements.containerItems.find(
        (i: ContainerMeasurementsPending) =>
          i.id === containerKeyExtractor(rootItem),
      );
      if (containerMeas) {
        containerItems.push(containerMeas);
      }
    } else {
      const itemMeas = measurements.items.find(
        (i: ItemMeasurementsPending) => i.id === keyExtractor(rootItem),
      );
      if (itemMeas) {
        items.push(itemMeas);
      }
    }
  });
  return {containerItems, items};
};

const _addMeasurement = (
  measurements: MeasurementsPending,
  measurementValues: ContainerMeasurementsPending | ItemMeasurementsPending,
  isContainer = false,
) => {
  if (isContainer) {
    const containerMeasIdx = measurements.containerItems.findIndex(
      c => c.id === measurementValues.id,
    );
    if (containerMeasIdx !== -1) {
      measurements.containerItems[containerMeasIdx] = {
        ...measurements.containerItems[containerMeasIdx],
        ...measurementValues,
      };
    } else {
      measurements.containerItems.push(measurementValues);
    }
  } else {
    const itemMeasIdx = measurements.items.findIndex(
      i => i.id === measurementValues.id,
    );
    if (itemMeasIdx !== -1) {
      measurements.items[itemMeasIdx] = {
        ...measurements.items[itemMeasIdx],
        ...measurementValues,
      };
    } else {
      measurements.items.push(measurementValues);
    }
  }
};

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
  onChangeMeasurements, // JS layout measurements
  dragState,
}: MeasureItemsViewProps) {
  const measurements = useRef<MeasurementsPending>({
    containerItems: [],
    items: [],
  });

  const allMeasured = useCallback(
    (msmts: MeasurementsPending) =>
      data.every((rootItem: Item | Container) => {
        if (isItemContainer(rootItem)) {
          const childrenMeasured = get(rootItem, containerItemsPath).every(
            (childItem: Item) => {
              const childId = keyExtractor(childItem);
              const meas = msmts.items.find(({id}) => id === childId);
              return meas?.height !== undefined;
            },
          );
          if (!childrenMeasured) {
            return false;
          }

          const containerId = containerKeyExtractor(rootItem);
          const meas = msmts.containerItems.find(({id}) => id === containerId);
          return (
            meas &&
            meas.startY !== undefined &&
            meas.endY !== undefined &&
            meas.height !== undefined
          );
        }
        const itemId = keyExtractor(rootItem);
        const meas = msmts.items.find(({id}) => id === itemId);
        return meas?.height !== undefined;
      }),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [data],
  );

  const handleOnLayout =
    (id: string, isContainer = false) =>
    ({
      nativeEvent: {
        layout: {height},
      },
    }: LayoutChangeEvent) => {
      _addMeasurement(measurements.current, {id, height}, isContainer);
      if (allMeasured(measurements.current)) {
        onChangeMeasurements({...measurements.current} as Measurements);
      }
    };

  const handleTopPlaceholderOnLayout =
    (id: string) =>
    ({
      nativeEvent: {
        layout: {y},
      },
    }: LayoutChangeEvent) => {
      _addMeasurement(measurements.current, {id, startY: y}, true);
      if (allMeasured(measurements.current)) {
        onChangeMeasurements({...measurements.current} as Measurements);
      }
    };

  const handleBottomPlaceholderOnLayout =
    (id: string) =>
    ({
      nativeEvent: {
        layout: {y},
      },
    }: LayoutChangeEvent) => {
      _addMeasurement(measurements.current, {id, endY: y}, true);
      if (allMeasured(measurements.current)) {
        onChangeMeasurements({...measurements.current} as Measurements);
      }
    };

  // THIS IS STEP 1
  const items = useMemo(() => {
    measurements.current = _removeDeleted(measurements.current, data, {
      isItemContainer,
      containerItemsPath,
      containerKeyExtractor,
      keyExtractor,
    });
    return data.map((item: Item | Container, rootIndex: number) => {
      if (isItemContainer(item)) {
        const children = get(item, containerItemsPath).map(
          (child: Item, childIndex: number) => {
            const id = keyExtractor(child);
            return (
              <View key={id} onLayout={handleOnLayout(id)}>
                {renderItem({
                  item: child,
                  dragProps: undefined,
                  dragState,
                  position: {rootIndex, childIndex},
                })}
              </View>
            );
          },
        );

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
              dragProps: undefined,
              dragState,
              position: {rootIndex},
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
            dragProps: undefined,
            dragState,
            position: {rootIndex},
          })}
        </View>
      );
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [data, dragState]);

  return <>{items}</>;
}

export default React.memo(
  MeasureItemsView,
  (prevProps: MeasureItemsViewProps, nextProps: MeasureItemsViewProps) =>
    prevProps.dragState === nextProps.dragState &&
    prevProps.data === nextProps.data,
);
