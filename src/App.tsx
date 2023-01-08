import { useCallback, useEffect, useState } from 'react'
import { processSheet } from './process'
import { declaration as scDeclaration } from './sourcecred-graph';
import './App.css'

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

export const App = () => {
  const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
  const API_KEY = import.meta.env.VITE_API_KEY
  const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4'
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly'

  const [tokenClient, setTokenClient] = useState<Maybe<TokenClient>>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [epoch, setEpoch] = useState<Maybe<DateRange>>(null)
  const [tables, setTables] = useState<Maybe<Record<string, Table>>>(null)
  const [declaration, setDeclaration] = useState<Maybe<string>>(null)

  useEffect(() => {
    const initializeGapiClient = async () => {
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      })
    }

    window.gapi.load('client', initializeGapiClient)
  }, [])

  const connect = useCallback(() => {
    if(!CLIENT_ID) throw new Error('OAuth `$CLIENT_ID` isn’t set.')

    let client = tokenClient
    if(!client) {
      client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp: TokenResponse) => {
          if(resp.error !== undefined) throw new Error(resp.error_description)
          setAuthenticated(true)
        },
      })

      setTokenClient(client)
    }
    if(window.gapi.client.getToken() === null) {
      client.requestAccessToken({ prompt: 'consent' })
    } else {
      client.requestAccessToken({ prompt: '' })
    }
  }, [])

  const extractTables = useCallback(async (sheetURL: string) => {
    const [, id] = (
      sheetURL.match(/^https:\/\/.+\/([^/]+)\/edit.*$/) ?? []
    )
    if(id) {
      const { tables, epoch } = await processSheet(id) ?? {}
      setTables(tables ?? null)
      setEpoch(epoch ?? null)
    } else {
      // setTables(<p>Invalid spreadsheet URL <q>{sheetURL}</q>.</p>)
    }
  }, [])

  useEffect(() => {
    const declaration = JSON.stringify(scDeclaration, null, 2)
    const declBlob = new Blob([declaration], { type: 'text/json' })
    setDeclaration(window.URL.createObjectURL(declBlob))
  }, [tables])

  return (
    <main>
      <ol>
        <li>
          <form onSubmit={((evt) => {
            evt.preventDefault()
            connect()
          })}>
            <input
              type="submit"
              value={`Connect${authenticated ? 'ed' : ''} to Google`}
              disabled={authenticated}
            />
          </form>
        </li>
        <li>
          Spreadsheet URL:{' '}
          <form onSubmit={(async (evt) => {
            evt.preventDefault()

            const form = evt.target as HTMLFormElement
            const sheet = (
              form.elements.namedItem('sheet') as HTMLInputElement
            )
            await extractTables(sheet.value)
          })}>
            <input id="sheet"/>
            <input
              type="submit"
              value="Process"
              title={authenticated ? 'Process Spreadsheet' : 'Authenticate'}
              disabled={!authenticated}
            />
          </form>
        </li>
        {tables && Object.keys(tables).length > 0 && (
          <li>
            Data:
            {epoch && (
              <section><>Epoch: {epoch?.toString()}</></section>
            )}
            {Object.values(tables).map((table) => (
              <section key={table.name}>
                <h2>{table.name}</h2>
                <table>
                  <tr>
                    <th></th>
                    {table.cols.map((col) => (
                      <th>{col}</th>
                    ))}
                  </tr>
                  {Object.entries(table.distribution).map(([actor, row]) => (
                    <tr>
                      <th>{actor}</th>
                      {table.cols.map((col) => (
                        <td title={`${actor}→${col}`}>
                          {row[col] === 0 ? '' : row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </table>
              </section>
            ))}
          </li>
        )}
        <li>
          <ul>
            {declaration && (
              <li><a href={declaration} target="_blank">
                SourceCred Declaration
              </a></li>
            )}
          </ul>
        </li>
      </ol>
    </main>
  )
}

export default App
