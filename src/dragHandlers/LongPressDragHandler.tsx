import React, {useRef} from 'react';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {DragProps} from '../types';

function LongPressDragHandler({ dragProps, children }: { dragProps: DragProps, children: React.ReactNode}) {
  const { onDrag, onDragStart, onDragEnd } = dragProps || {};

  const isPanning = useSharedValue(false);
  const y0 = useSharedValue(null);

  const onDragStartInternal = (y: number) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    if (onDragStart) onDragStart(y);
  };

  const onDragEndInternal = (y: number) => {
    if (onDragEnd) onDragEnd(y);
  };

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      isPanning.value = true;
    })
    .onUpdate((e) => {
      if (y0.value === null) return;
      if (onDrag) onDrag(e.absoluteY - y0.value, e.absoluteY);
    })
    .onTouchesUp(() => {
      if (y0.value !== null) {
        runOnJS(onDragEndInternal)(undefined);
        y0.value = null;
      }
      isPanning.value = true;
    });

  const longPressGesture = Gesture.LongPress()
    .onStart((e) => {
      y0.value = e.absoluteY;
      runOnJS(onDragStartInternal)(e.absoluteY);
    })
    .onEnd((e) => {
      if (!isPanning.value && y0.value !== null) {
        runOnJS(onDragEndInternal)(e.absoluteY);
        y0.value = null;
      }
    });

  return (
    <GestureDetector gesture={Gesture.Simultaneous(panGesture, longPressGesture)}>
      <Animated.View>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

export default LongPressDragHandler;
