import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function QuickLogWidget() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#7C6FEA',
        borderRadius: 16,
      }}
    >
      <TextWidget
        text="Log Feed"
        style={{
          fontSize: 18,
          color: '#ffffff',
          fontWeight: 'bold',
        }}
      />
    </FlexWidget>
  );
}
