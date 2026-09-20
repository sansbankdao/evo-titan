// apps/mobile/src/components/Screen.tsx — Evo Titan
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function Screen({ children }: PropsWithChildren) {
  return <View className="flex-1 bg-slate-950">{children}</View>;
}
