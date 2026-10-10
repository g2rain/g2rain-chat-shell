/**
 * 前端国际化文案包 API
 */

import { getI18nTags } from '../../shared/env'
import { getHttpClient } from '../http'

export interface I18nLocaleMessage {
  messageCode: string
  messageText: string
  extendField?: string
}

/**
 * 拉取 UI 文案包
 * GET /infra/i18n_message/locale?tags={VITE_I18N_TAGS}&locale=zh-CN
 */
export async function fetchI18nLocaleMessages(locale: string): Promise<I18nLocaleMessage[]> {
  const http = getHttpClient()
  const res = await http.client.get<I18nLocaleMessage[]>('/infra/i18n_message/locale', {
    tags: getI18nTags(),
    locale: locale.trim(),
  })
  return res.data ?? []
}
