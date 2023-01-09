import { useCallback, useState } from 'react'
import type { Maybe, TokenClient, TokenResponse } from '../types'

export const useGAPI = () => {
  const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY
  const DISCOVERY_DOC = (
    'https://sheets.googleapis.com/$discovery/rest?version=v4'
  )
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly'

  const [tokenClient, setTokenClient] = (
    useState<Maybe<TokenClient>>(null)
  )
  const [authenticated, setAuthenticated] = useState(false)

  const initGAPI = useCallback(() => {
    if(!API_KEY) throw new Error('GAPI `$API_KEY` isn’t set.')

    const initializeGapiClient = async () => {
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      })
    }

    window.gapi.load('client', initializeGapiClient)
  }, [API_KEY])

  const initGSI = useCallback(() => {
    if(!CLIENT_ID) throw new Error('OAuth `$CLIENT_ID` isn’t set.')

    setTokenClient(
      window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp: TokenResponse) => {
          if(resp.error !== undefined) {
            throw new Error(resp.error_description)
          }
          setAuthenticated(true)
        },
      })
    )
  }, [CLIENT_ID])

  const connect = useCallback(async () => {
    if(!tokenClient) throw new Error('Token client isn’t set.')

    console.info({ tok: window.gapi.client.getToken() })

    const existing = window.gapi.client.getToken() != null
    tokenClient.requestAccessToken({
      prompt: existing ? '' : 'consent'
    })
  }, [tokenClient])

  const logout = useCallback(() => {
    const token = window.gapi.client.getToken()
    if(token != null) {
      window.google.accounts.oauth2.revoke(
        token.access_token,
        () => {
          window.gapi.client.setToken({ access_token: '' })
          setAuthenticated(false)
        },
      )
    }
  }, [])

  return {
    initGAPI,
    gapi: typeof window !== 'undefined' ? window.gapi : null,
    initGSI,
    connect,
    logout,
    authenticated,
  }
}
