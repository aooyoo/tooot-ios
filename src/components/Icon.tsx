import FeatherNames from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json'
import Feather from '@expo/vector-icons/Feather'
import React from 'react'
import { AccessibilityProps, StyleProp, View, ViewStyle } from 'react-native'
import { IS_IOS_26_OR_LATER } from '@utils/styles/ios26'

export type IconName = keyof typeof FeatherNames

export interface Props {
  accessibilityLabel?: AccessibilityProps['accessibilityLabel']

  name: IconName
  size: number
  color: string
  style?: StyleProp<ViewStyle>
  crossOut?: boolean
}

const Icon: React.FC<Props> = ({
  accessibilityLabel,
  name,
  size,
  color,
  style,
  crossOut = false
}) => {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        style,
        {
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center'
        }
      ]}
    >
      <Feather
        name={name}
        size={size}
        color={color}
        style={IS_IOS_26_OR_LATER ? { lineHeight: size, textAlign: 'center' } : undefined}
      />
      {crossOut ? (
        <View
          style={{
            position: 'absolute',
            transform: [{ rotate: '45deg' }],
            width: size * 1.35,
            borderBottomColor: color,
            borderBottomWidth: 2
          }}
        />
      ) : null}
    </View>
  )
}

export default Icon
