import { getHttpClient } from '../http'

/** 当前账号在当前应用中可切换的用户身份 */
export interface UserIdentityVo {
  userId: string | number
  userName?: string
  organId: string | number
  organName?: string
}

/** GET /basis/user/identities — 当前应用由后端从请求身份中取，不传参数 */
export async function listIdentities(): Promise<UserIdentityVo[]> {
  const http = getHttpClient()
  const res = await http.client.get<UserIdentityVo[]>('/basis/user/identities')
  return res.data ?? []
}
