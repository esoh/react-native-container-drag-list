import React from 'react';

export type Item = any;
export type Container = {[key:string]: any};
export type Data = Array<Item | Container>;

export type DragState = {
  isDragging: boolean;
  isContainer: null | boolean;
  id: null | string;
};

export type ContainerMeasurements = {
  id: string;
  height?: number;
  startY?: number; // Y value where items in the container start
  endY?: number; // Y value where items in the container end
};

export type ItemMeasurements = {
  id: string;
  height?: number;
};

export type Measurements = {
  containerItems: Array<ContainerMeasurements>;
  items: Array<ItemMeasurements>;
};

export type Position = {
  rootIndex: number;
  childIndex?: number; // if this is an item in a container, this will be the index of the index within the container
};

export type DragProps = {
  onDrag: (yDelta: number, absoluteY: number) => void;
  onDragStart: (absoluteY: number) => void;
  onDragEnd: (absoluteY: number) => void;
} | undefined;

export type MetaProps = {
  renderItem: (info: {
    item: Item;
    dragState: DragState;
    position: Position;
    dragProps: DragProps;
  }) => React.ReactNode;
  keyExtractor: (item: Item) => string;
  renderContainer: (info: {
    children: Array<React.ReactNode>;
    containerItem: Container;
    dragState: DragState;
    dragProps: DragProps;
  }) => React.ReactNode;
  containerKeyExtractor: (c: Container) => string;
  isItemContainer: (i: Item | Container) => boolean;
  containerItemsPath: string;
};

export type SortOrderContainer = {id: string; items: Array<string>};
export type SortOrder = Array<string>;
