import Head from 'next/head'
import { Inter } from '@next/font/google'
import { useCallback, useEffect, useState } from 'react'
import {
  Maybe, DateRange, Table,
} from '../types'
import { processSheet } from '../lib/process'
import { declaration as scDeclaration } from '../lib/sourcecred-graph'
import styles from '../styles/Home.module.css'
import { useGAPI } from '../lib/useGAPI'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  const [epoch, setEpoch] = useState<Maybe<DateRange>>(null)
  const [tables, setTables] = useState<Maybe<Record<string, Table>>>(null)
  const [declaration, setDeclaration] = useState<Maybe<string>>(null)

  const { connect, authenticated } = useGAPI()

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
    <>
      <Head>
        <title>Coorditang</title>
        <meta name="description" content="Multitiered Coordinape Distribution"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="shortcut icon" href="/logo.svg"/>
      </Head>
      <main className={styles.main}>
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
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                    {Object.entries(table.distribution).map(([actor, row]) => (
                      <tr key={actor}>
                        <th>{actor}</th>
                        {table.cols.map((col) => {
                          const title = `${actor}→${col}`
                          return (
                            <td {...{ title }} key={title}>
                              {row[col] === 0 ? '' : row[col]}
                            </td>
                          )
                        })}
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
                <li><a href={declaration} target="_blank" rel="noreferrer">
                  SourceCred Declaration
                </a></li>
              )}
            </ul>
          </li>
        </ol>

      </main>
    </>
  )
}
