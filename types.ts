export type Maybe<T> = T | null

export interface OverridableTokenClientConfig {
  prompt?: string
  enable_serial_consent?: boolean
  hint?: string
  state?: string
}

export interface TokenClient {
  callback?: (resp: TokenResponse) => void
  requestAccessToken: (overrideConfig?: OverridableTokenClientConfig) => void
}

export interface TokenResponse {
  access_token: string
  expires_in: string
  hd: string
  prompt: string
  token_type: string
  scopes: string
  state: string
  error: string
  error_description: string
  error_uri: string
}

export type Table = {
  name: string
  distribution: Record<string, Record<string, number>>
  cols: Array<string>
  startRow: number
  endRow: number
}

export type DateRange = {
  start: Date
  end: Date
}

export type Addresser = {
  epoch: (arg?: any) => string
  top: (arg?: any) => string
  guild: (arg?: any) => string
  player: (arg?: any) => string
  divided_by: (arg?: any) => string
  distributed_to: (arg?: any) => string
} & ((arg: any | Array<any>) => string)

export type ElementSource = {
  id: string
  type?: string
}

export type SourceArg = ElementSource | Array<ElementSource>
