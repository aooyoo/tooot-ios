import Button from '@components/Button'
import Icon from '@components/Icon'
import { Loading } from '@components/Loading'
import { MenuContainer, MenuRow } from '@components/Menu'
import { displayMessage } from '@components/Message'
import openLink from '@components/openLink'
import CustomText from '@components/Text'
import * as Sentry from '../../../vendor/sentry-stub'
import apiInstance from '@utils/api/instance'
import apiTooot, { TOOOT_API_DOMAIN } from '@utils/api/tooot'
import { PUSH_ADMIN, PUSH_DEFAULT, setChannels } from '@utils/push/constants'
import { updateExpoToken } from '@utils/push/updateExpoToken'
import { useAppsQuery } from '@utils/queryHooks/apps'
import { useProfileQuery } from '@utils/queryHooks/profile'
import { setAccountStorage, setGlobalStorage, useAccountStorage, useGlobalStorage } from '@utils/storage/actions'
import { StyleConstants } from '@utils/styles/constants'
import layoutAnimation from '@utils/styles/layoutAnimation'
import { useTheme } from '@utils/styles/ThemeManager'
import * as Crypto from 'expo-crypto'
import * as Notifications from 'expo-notifications'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, Linking, Platform, ScrollView, TextInput, View } from 'react-native'
import { fromByteArray } from 'react-native-quick-base64'

export const getPushPath = ({
  expoToken,
  domain,
  accountId
}: {
  expoToken?: string
  domain: string
  accountId: string | number
}) => `${expoToken}/${domain}/${accountId}`
export const getPushendpoint = (pushPath: string) =>
  `https://${TOOOT_API_DOMAIN}/push/send/${pushPath}/${(Math.random() + 1)
    .toString(36)
    .substring(2)}`

const TabMePush: React.FC = () => {
  const { colors } = useTheme()
  const { t } = useTranslation('screenTabs')

  const [expoToken] = useGlobalStorage.string('app.expo_token')
  const [push] = useAccountStorage.object('push')
  const [domain] = useAccountStorage.string('auth.domain')
  const [accountAcct] = useAccountStorage.string('auth.account.acct')
  const [accountDomain] = useAccountStorage.string('auth.account.domain')
  const [accountId] = useAccountStorage.string('auth.account.id')
  const [authToken] = useAccountStorage.string('auth.token')
  const [barkRaw] = useGlobalStorage.string('app.bark')
  const [barkDraft, setBarkDraft] = useState<string>('')
  const [barkStatus, setBarkStatus] = useState<string>('')
  const bark: { url?: string; id?: string; secret?: string; enabled?: boolean } = (() => {
    try {
      return JSON.parse(barkRaw || '{}')
    } catch {
      return {}
    }
  })()
  useEffect(() => {
    if (bark.url && !barkDraft) setBarkDraft(bark.url)
  }, [bark.url])

  const BARK_WORKER = 'https://toot-push.qiaohk.workers.dev'
  const postJson = async (path: string, body: object) => {
    const res = await fetch(`${BARK_WORKER}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
    return data as { id?: string; secret?: string }
  }
  const barkTest = async (id?: string, secret?: string) => {
    const targetId = id || bark.id
    const targetSecret = secret || bark.secret
    if (!targetId || !targetSecret) {
      setBarkStatus('还没有订阅，请先启用')
      return
    }
    try {
      const res = await fetch(`${BARK_WORKER}/test?id=${targetId}&secret=${targetSecret}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setBarkStatus('测试推送已发出，检查 Bark 是否收到')
    } catch (e: any) {
      setBarkStatus(`测试失败：${e?.message || e}`)
    }
  }
  const barkSubscribe = async () => {
    const target = (barkDraft || '').trim().replace(/\/+$/, '')
    if (!/^https:\/\//.test(target)) {
      setBarkStatus('请填写 https:// 开头的 Bark 地址，例如 https://api.day.app/xxxxxx')
      return
    }
    if (!domain || !authToken) {
      setBarkStatus('缺少实例信息，请先登录账号')
      return
    }
    setBarkStatus('正在启用…')
    try {
      if (bark.id && bark.secret) {
        await postJson('/unsubscribe', { id: bark.id, secret: bark.secret }).catch(() => {})
      }
      const data = await postJson('/subscribe', { domain, token: authToken, bark: target })
      setGlobalStorage(
        'app.bark',
        JSON.stringify({ url: target, id: data.id, secret: data.secret, enabled: true })
      )
      setBarkStatus('已启用，正在发送测试推送…')
      await barkTest(data.id, data.secret)
    } catch (e: any) {
      setBarkStatus(`启用失败：${e?.message || e}`)
    }
  }
  const barkDisable = async () => {
    if (bark.id && bark.secret) {
      await postJson('/unsubscribe', { id: bark.id, secret: bark.secret }).catch(() => {})
    }
    setGlobalStorage('app.bark', JSON.stringify({ url: bark.url || barkDraft, enabled: false }))
    setBarkStatus('已关闭 Bark 推送')
  }


  const appsQuery = useAppsQuery()

  const [pushEnabled, setPushEnabled] = useState<boolean>()
  const [pushCanAskAgain, setPushCanAskAgain] = useState<boolean>()

  const checkPush = async () => {
    const permissions = await Notifications.getPermissionsAsync()
    setPushEnabled(permissions.granted)
    setPushCanAskAgain(permissions.canAskAgain)
    layoutAnimation()
    await updateExpoToken()
  }
  useEffect(() => {
    checkPush()
  }, [])
  useEffect(() => {
    checkPush()
  }, [pushEnabled])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', checkPush)
    return () => {
      subscription.remove()
    }
  }, [])

  const alerts = () =>
    push?.alerts
      ? PUSH_DEFAULT().map(alert => (
          <MenuRow
            key={alert}
            title={t(`me.push.${alert}.heading`)}
            switchValue={push?.alerts[alert]}
            switchOnValueChange={async () => {
              const alerts = { ...push?.alerts, [alert]: !push?.alerts[alert] }

              if (pushEnabled && push.global) {
                const body: { data: { alerts: Mastodon.PushSubscription['alerts'] } } = {
                  data: { alerts }
                }
                await apiInstance<Mastodon.PushSubscription>({
                  method: 'put',
                  url: 'push/subscription',
                  body
                })
              }

              setAccountStorage([{ key: 'push', value: { ...push, alerts } }])
            }}
          />
        ))
      : null

  const profileQuery = useProfileQuery()
  const adminAlerts = () =>
    profileQuery.data?.role?.permissions
      ? PUSH_ADMIN().map(({ type }) => (
          <MenuRow
            key={type}
            title={t(`me.push.${type}.heading`)}
            switchValue={push?.alerts[type]}
            switchOnValueChange={async () => {
              const alerts = { ...push?.alerts, [type]: !push?.alerts[type] }

              if (pushEnabled && push.global) {
                const body: {
                  data: { alerts: Mastodon.PushSubscription['alerts'] }
                } = {
                  data: { alerts }
                }
                await apiInstance<Mastodon.PushSubscription>({
                  method: 'put',
                  url: 'push/subscription',
                  body
                })
              }

              setAccountStorage([{ key: 'push', value: { ...push, alerts } }])
            }}
          />
        ))
      : null

  const pushPath = getPushPath({ expoToken, domain, accountId })
  const accountFull = `@${accountAcct}@${accountDomain}`


  const barkSection = () => (
            <MenuContainer>
              <MenuRow
                title='Bark 推送'
                description='自签名安装没有 APNs，用 Bark 接收 Mastodon 通知（由 Worker 每分钟轮询）'
                switchValue={!!bark.enabled}
                switchOnValueChange={async () => {
                  if (bark.enabled) {
                    await barkDisable()
                  } else {
                    await barkSubscribe()
                  }
                }}
              />
              <View
                style={{
                  paddingHorizontal: StyleConstants.Spacing.Global.PagePadding,
                  paddingBottom: StyleConstants.Spacing.M
                }}
              >
                <TextInput
                  value={barkDraft}
                  onChangeText={setBarkDraft}
                  placeholder='https://api.day.app/你的key'
                  placeholderTextColor={colors.secondary}
                  autoCapitalize='none'
                  autoCorrect={false}
                  keyboardType='url'
                  style={{
                    color: colors.primaryDefault,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.backgroundOverlayDefault,
                    paddingVertical: StyleConstants.Spacing.S,
                    marginBottom: StyleConstants.Spacing.S
                  }}
                />
                <View style={{ flexDirection: 'row', gap: StyleConstants.Spacing.S }}>
                  <Button type='text' size='S' content='保存并启用' onPress={barkSubscribe} />
                  <Button type='text' size='S' content='发送测试' onPress={() => barkTest()} />
                  {bark.enabled ? (
                    <Button type='text' size='S' destructive content='关闭' onPress={barkDisable} />
                  ) : null}
                </View>
                {barkStatus ? (
                  <CustomText
                    fontStyle='S'
                    style={{ color: colors.secondary, marginTop: StyleConstants.Spacing.XS }}
                  >
                    {barkStatus}
                  </CustomText>
                ) : null}
              </View>
            </MenuContainer>
  )

  return appsQuery.isFetched ? (
    <ScrollView>
      {barkSection()}
      {!!appsQuery.data?.vapid_key ? (
        <>
          {!!expoToken?.length || (!expoToken?.length && !pushEnabled) ? (
            <>
              {pushEnabled === false ? (
                <MenuContainer>
                  <Button
                    type='text'
                    content={
                      pushCanAskAgain ? t('me.push.enable.direct') : t('me.push.enable.settings')
                    }
                    style={{
                      marginTop: StyleConstants.Spacing.Global.PagePadding,
                      marginHorizontal: StyleConstants.Spacing.Global.PagePadding * 2
                    }}
                    onPress={async () => {
                      if (pushCanAskAgain) {
                        const result = await Notifications.requestPermissionsAsync()
                        setPushEnabled(result.granted)
                        setPushCanAskAgain(result.canAskAgain)
                      } else {
                        Linking.openSettings()
                      }
                    }}
                  />
                </MenuContainer>
              ) : null}
              <MenuContainer>
                <MenuRow
                  title={t('me.push.global.heading', { acct: `@${accountAcct}@${accountDomain}` })}
                  description={t('me.push.global.description')}
                  switchDisabled={!pushEnabled}
                  switchValue={pushEnabled === false ? false : push?.global}
                  switchOnValueChange={async () => {
                    if (push.global) {
                      // Turning off
                      await apiInstance({
                        method: 'delete',
                        url: 'push/subscription'
                      })
                      await apiTooot({
                        method: 'delete',
                        url: `push/unsubscribe/${pushPath}`
                      })

                      setAccountStorage([{ key: 'push', value: { ...push, global: false } }])
                      if (Platform.OS === 'android') {
                        Notifications.deleteNotificationChannelGroupAsync(accountFull)
                      }
                    } else {
                      // Fix a bug for some users of v4.8.0
                      let authKey = push.key
                      if (push.key?.length <= 10) {
                        authKey = fromByteArray(Crypto.getRandomBytes(16))
                      }

                      const body: {
                        subscription: any
                        data: { alerts: Mastodon.PushSubscription['alerts'] }
                      } = {
                        subscription: {
                          endpoint: getPushendpoint(pushPath),
                          keys: {
                            p256dh:
                              'BMn2PLpZrMefG981elzG6SB1EY9gU7QZwmtZ/a/J2vUeWG+zXgeskMPwHh4T/bxsD4l7/8QT94F57CbZqYRRfJo=',
                            auth: authKey
                          }
                        },
                        data: { alerts: push.alerts }
                      }

                      const res = await apiInstance<Mastodon.PushSubscription>({
                        method: 'post',
                        url: 'push/subscription',
                        body
                      })

                      if (!res.body.server_key?.length) {
                        displayMessage({
                          type: 'danger',
                          duration: 'long',
                          message: t('me.push.missingServerKey.message'),
                          description: t('me.push.missingServerKey.description')
                        })
                        await apiInstance({
                          method: 'delete',
                          url: 'push/subscription'
                        })
                        Sentry.setContext('Push server key', {
                          instance: domain,
                          resBody: res.body
                        })
                        Sentry.captureMessage('Push register error')
                        return Promise.reject()
                      }

                      await apiTooot({
                        method: 'post',
                        url: `push/subscribe/${pushPath}`,
                        body: {
                          accountFull,
                          serverKey: res.body.server_key,
                          auth: push.decode === false ? null : authKey
                        }
                      }).catch(async () => {
                        await apiInstance({
                          method: 'delete',
                          url: 'push/subscription'
                        })
                        return Promise.reject()
                      })

                      setAccountStorage([
                        { key: 'push', value: { ...push, global: true, key: authKey } }
                      ])
                      if (Platform.OS === 'android') {
                        setChannels(true)
                      }
                    }
                  }}
                />
              </MenuContainer>
              <MenuContainer>
                <MenuRow
                  title={t('me.push.decode.heading')}
                  description={t('me.push.decode.description')}
                  switchDisabled={!pushEnabled || !push?.global}
                  switchValue={push?.decode}
                  switchOnValueChange={async () => {
                    await apiTooot({
                      method: 'put',
                      url: `push/update-decode/${pushPath}`,
                      body: { auth: push?.decode ? null : push.key }
                    })

                    setAccountStorage([{ key: 'push', value: { ...push, decode: !push.decode } }])

                    if (Platform.OS === 'android') {
                      setChannels(true)
                    }
                  }}
                />
                <MenuRow
                  title={t('me.push.howitworks')}
                  iconBack='external-link'
                  onPress={async () => openLink('https://tooot.app/how-push-works')}
                />
              </MenuContainer>
              <MenuContainer children={alerts()} />
              <MenuContainer children={adminAlerts()} />

            </>
          ) : (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: StyleConstants.Spacing.L,
                paddingHorizontal: StyleConstants.Spacing.Global.PagePadding
              }}
            >
              <Icon name='frown' size={StyleConstants.Font.Size.L} color={colors.primaryDefault} />
              <CustomText
                fontStyle='M'
                style={{
                  color: colors.primaryDefault,
                  textAlign: 'center',
                  marginTop: StyleConstants.Spacing.S
                }}
              >
                {t('me.push.notAvailable')}
              </CustomText>
            </View>
          )}
        </>
      ) : (
        <View
          style={{
            flex: 1,
            minHeight: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: StyleConstants.Spacing.Global.PagePadding
          }}
        >
          <Icon name='frown' size={StyleConstants.Font.Size.L} color={colors.primaryDefault} />
          <CustomText
            fontStyle='M'
            style={{
              color: colors.primaryDefault,
              textAlign: 'center',
              marginTop: StyleConstants.Spacing.S
            }}
          >
            {t('me.push.missingServerKey.message')}
          </CustomText>
          <CustomText
            fontStyle='S'
            style={{
              color: colors.primaryDefault,
              textAlign: 'center'
            }}
          >
            {t('me.push.missingServerKey.description')}
          </CustomText>
        </View>
      )}
    </ScrollView>
  ) : (
    <Loading style={{ flex: 1 }} />
  )
}

export default TabMePush
