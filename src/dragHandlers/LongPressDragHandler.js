import React from 'react';
import { State, LongPressGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedGestureHandler } from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

function LongPressDragHandler({ dragProps = {}, children }) {
  const { onDrag, onDragStart, onDragEnd } = dragProps;

  const y0 = useSharedValue(null);
  const eventHandler = useAnimatedGestureHandler({
    onActive: e => {
      if (y0.value === null) return;
      if (onDrag) onDrag(e.absoluteY - y0.value, e.absoluteY);
    },
    onFinish: () => {
      y0.value = null;
    },
  });

  return (
    <LongPressGestureHandler
      onHandlerStateChange={({ nativeEvent: { state, absoluteY } }) => {
        'worklet';

        if (state === State.ACTIVE) {
          ReactNativeHapticFeedback.trigger('impactLight');
          if (onDragStart) onDragStart(absoluteY);
          y0.value = absoluteY;
        } else {
          if (onDragEnd) onDragEnd();
          y0.value = null;
        }
      }}
      onGestureEvent={eventHandler}
    >
      <Animated.View>
        {children}
      </Animated.View>
    </LongPressGestureHandler>
  );
}

export default LongPressDragHandler;
