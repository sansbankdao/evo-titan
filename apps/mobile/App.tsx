/**
 * apps/mobile/App.tsx — Evo Titan
 *
 * @format
 */

import './global.css';

import { StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Brand } from './src/components/Brand';
import { Screen } from './src/components/Screen';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Brand />
          <Text className="mt-4 text-center text-base text-slate-400">
            Desktop, mobile and web. Built with Astro, Tauri v2, React Native and Tailwind CSS.
          </Text>
        </View>
      </Screen>
    </SafeAreaProvider>
  );
}

export default App;
