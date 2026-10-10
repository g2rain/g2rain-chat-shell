/**
 * Locale list API（登录后拉可选语言）
 */

import { getHttpClient } from '../http'

/** 对应后端 LocaleCodeNameVo */
export interface LocaleCodeName {
  /** 语言区域编码，如 zh-CN */
  code: string
  /** 语言区域名称 */
  name: string
}

/** GET /infra/locale_setting/code_name_map */
export async function getLocaleCodeNameList(): Promise<LocaleCodeName[]> {
  const http = getHttpClient()
  const res = await http.client.get<LocaleCodeName[]>('/infra/locale_setting/code_name_map')
  return res.data ?? []
}
