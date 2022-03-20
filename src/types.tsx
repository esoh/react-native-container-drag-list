import React from 'react';
import {SharedValue} from 'react-native-reanimated';
import {CONTAINER_TYPE, DIRECTION} from './constants';

export type Item = any;
export type Container = {[key: string]: any};
export type Data = Array<Item | Container>;

export type DragState = {
  isDragging: boolean;
  isContainer: null | boolean;
  id: null | string;
};

export type ContainerMeasurementsPending = {
  id: string;
  height?: number;
  startY?: number; // Y value where items in the container start
  endY?: number; // Y value where items in the container end
};

export interface ContainerMeasurements extends ContainerMeasurementsPending {
  height: number;
  startY: number; // Y value where items in the container start
  endY: number; // Y value where items in the container end
}

export type ItemMeasurementsPending = {
  id: string;
  height?: number;
};

export interface ItemMeasurements extends ItemMeasurementsPending {
  height: number;
}

export type MeasurementsPending = {
  containerItems: Array<ContainerMeasurementsPending>;
  items: Array<ItemMeasurementsPending>;
};

export type Measurements = {
  containerItems: Array<ContainerMeasurements>;
  items: Array<ItemMeasurements>;
};

export type Position = {
  rootIndex: number;
  childIndex?: number; // if this is an item in a container, this will be the index of the index within the container
};

export type DragProps =
  | {
      onDrag: (yDelta: number, absoluteY: number) => void;
      onDragStart: (absoluteY: number) => void;
      onDragEnd: (absoluteY: number) => void;
    }
  | undefined;

export type MetaProps = {
  renderItem: (info: {
    item: Item;
    dragState: DragState;
    position: Position;
    dragProps: DragProps;
  }) => React.ReactNode;
  keyExtractor: (item: Item) => string;
  renderContainer: (info: {
    children?: React.ReactNode;
    containerItem: Container;
    dragState: DragState;
    position: Position;
    dragProps: DragProps;
  }) => React.ReactNode;
  containerKeyExtractor: (c: Container) => string;
  isItemContainer: (i: Item | Container) => boolean;
  containerItemsPath: string;
};

export type SortOrderContainer = {id: string; items: Array<string>};
export type SortOrder = Array<string | SortOrderContainer>;

export type ContainerOffset = {
  id: string;
  y: number;
  contentHeight: number;
  height: number;
};

export type ItemOffset = {
  id: string;
  y: number;
  height: number;
};

export type Offsets = {
  items: Array<ItemOffset>;
  containers: Array<ContainerOffset>;
};

export type Direction = typeof DIRECTION.DOWN | typeof DIRECTION.UP;

export type DragValues = {
  isDraggingValue: SharedValue<boolean>;
  isDraggingContainerValue: SharedValue<boolean>;
  itemBeingDraggedIdValue: SharedValue<string | null>;
  dragItemTranslateYValue: SharedValue<number>;
  animatingParentContainers: SharedValue<Array<string>>;
};

type RangeMapObject = {
  y: number;
  rootIndex: number;
  container?: typeof CONTAINER_TYPE.TOP | typeof CONTAINER_TYPE.BOTTOM;
  childIndex?: number;
};
export type RangeMapArray = Array<RangeMapObject>;
