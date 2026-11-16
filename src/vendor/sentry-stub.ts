/* 本地构建用：移除 Sentry 原生依赖后的空实现（仅为个人构建，不影响业务逻辑） */
type AnyObj = Record<string, unknown>
export const init = (_options?: AnyObj) => undefined
export const setContext = (_key: string, _context?: AnyObj) => undefined
export const setTag = (_key: string, _value?: unknown) => undefined
export const setTags = (_tags?: AnyObj) => undefined
export const captureMessage = (_message?: unknown) => undefined
export const captureException = (_error?: unknown) => undefined
export default { init, setContext, setTag, setTags, captureMessage, captureException }
