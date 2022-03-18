// This is an example test file.
/* eslint-disable */
import React from 'react';
import {View, Text, StyleSheet, Button, LayoutChangeEvent} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import ReorderDragScrollView, {
  LongPressDragHandler,
} from '@esoh/react-native-container-drag-list';

const styles = StyleSheet.create({
  item: {
    backgroundColor: 'blue',
    textAlign: 'center',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topContainer: {
    backgroundColor: 'cyan',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: 25,
  },
  bottomContainer: {
    backgroundColor: 'cyan',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    height: 50,
  },
  draggable: {padding: 10},
  collapsibleText: {paddingVertical: 50},
});

const sampleData = [
  {value: '0', id: 0},
  {value: '1', id: 1},
  {value: '2', id: 2},
  {
    id: 3,
    data: [
      {value: '4', id: 4},
      {value: '5', id: 5},
    ],
  },
  {value: '6', id: 6},
  {
    id: 7,
    data: [{value: '8', id: 8}],
  },
];

function Item({item, containerItem, dragProps, dragState}) {
  if (item.id === 0) {
    console.log('render0');
  }

  const isAnimating = useSharedValue(false);
  const progress = useDerivedValue(() => {
    if (dragState?.isDragging || dragState?.isAnimating?.value) {
      isAnimating.value = true;
      return withTiming(0);
    }
    return withTiming(1, undefined, () => {
      isAnimating.value = false;
    });
  }, [dragState?.isDragging]);

  const collapsibleHeightVal = useSharedValue(0);
  const handleLayout = ({
    nativeEvent: {
      layout: {height},
    },
  }: LayoutChangeEvent) => {
    if (!isAnimating.value) collapsibleHeightVal.value = height;
  };
  const style = useAnimatedStyle(() => {
    const collapsibleHeight = progress.value * collapsibleHeightVal.value;

    if (collapsibleHeightVal.value === 0) return {};

    return {
      height: collapsibleHeight,
      overflow: 'hidden',
    };
  }, [dragState?.isDragging]);

  return (
    <View>
      <LongPressDragHandler dragProps={dragProps}>
        <View style={styles.item}>
          <Text
            style={[
              containerItem ? {paddingLeft: 20} : undefined,
              styles.draggable,
            ]}
          >
            {item.value}
          </Text>
        </View>
      </LongPressDragHandler>
      <Animated.View style={style}>
        <View onLayout={handleLayout}>
          <Text style={styles.collapsibleText}>collapsible</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function App() {
  const [data, setData] = React.useState(sampleData);
  const renderItem = props => <Item {...props} />;

  const renderContainer = ({children, containerItem, dragProps}) => (
    <>
      <LongPressDragHandler dragProps={dragProps}>
        <View style={styles.topContainer}>
          <Text>{containerItem.id}</Text>
        </View>
      </LongPressDragHandler>
      {children}
      <View style={styles.bottomContainer} />
    </>
  );

  return (
    <View style={{flex: 1}}>
      <View style={{height: 200, backgroundColor: 'yellow'}} />
      <ReorderDragScrollView
        data={data}
        onChange={setData}
        renderItem={renderItem}
        renderContainer={renderContainer}
        isItemContainer={item => {
          'worklet';

          return item?.data;
        }}
        containerItemsPath="data"
        HeaderComponent={
          <Button
            style={{height: 100}}
            title="DELETE FIRST ITEM"
            onPress={() => {
              if (data?.length) {
                setData(prev => {
                  const newItems = [...prev];
                  newItems.splice(0, 1);
                  return newItems;
                });
              }
            }}
          />
        }
        FooterComponent={
          <Button
            style={{height: 100}}
            title="ADD"
            onPress={() => {
              setData(prev => [
                ...prev,
                {id: Math.random(), value: Math.random()},
              ]);
            }}
          />
        }
      />
    </View>
  );
}

export default App;
