import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  useColorScheme,
} from 'react-native';

import {Header} from 'react-native/Libraries/NewAppScreen';
import TestComponent from '@esoh/react-native-container-drag-list';

const App = () => {
  console.log('hi');
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: 'red',
  };

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}
      >
        <Header />
        <TestComponent />
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
