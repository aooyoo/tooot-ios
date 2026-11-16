import { Platform } from 'react-native'

/**
 * iOS 26 起系统导航栏改为带胶囊背景的新样式，旧的自定义 header 按钮
 * 依赖负 margin 贴边的做法会让图标在新胶囊里偏位。
 * 只在 iOS >= 26 生效，iOS 18 及以下完全走原逻辑。
 */
const version = parseInt(String(Platform.Version), 10)

export const IS_IOS_26_OR_LATER = Platform.OS === 'ios' && Number.isFinite(version) && version >= 26

/** iOS 26+ 上把按钮固定成正方形并居中，取消负 margin。 */
export const ios26HeaderButtonFix = (native: boolean, side: 'left' | 'right') =>
  IS_IOS_26_OR_LATER
    ? {
        width: 44,
        height: 44,
        marginLeft: side === 'left' ? 0 : undefined,
        marginRight: side === 'right' ? 0 : undefined,
        paddingHorizontal: 0
      }
    : {}
