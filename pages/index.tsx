/* eslint-disable @next/next/no-img-element */
import Head from 'next/head'
import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import {
  Maybe, Circle, Participant, Epoch,
} from '../types'
import { processSheet } from '../lib/process'
import {
  buildGraph, declaration as scDeclaration
} from '../lib/sourcecred-graph'
import { useGAPI } from '../lib/useGAPI'
import styles from '../styles/Home.module.css'

const Circle = ({ circle }: { circle: Circle }) => (
  <section key={circle.name}>
    <h3>{circle.name}</h3>
    <table className={styles.table}>
      <tr>
        <th></th>
        {circle.actees.map((actee) => {
          const { name } = actee
          return <th key={name}>{name}</th>
        })}
      </tr>
      {circle.actors.map(({ name: actor }) => (
        <tr key={actor}>
          <th>{actor}</th>
          {circle.actees.map(({ name: actee }) => {
            const { allotments: allots } = circle.distribution[actee]
            const title = `${actor}→${actee}`
            const allot = allots[actor]

            return (
              <td {...{ title }} key={title}>
                {!!allot ? allot : ''}
              </td>
            )
          })}
        </tr>
      ))}
    </table>
  </section>
)

export default function Home() {
  const [epoch, setEpoch] = useState<Maybe<Epoch>>(null)
  const [graph, setGraph] = useState<Maybe<string>>(null)
  const [declarationURL, setDeclarationURL] = useState<Maybe<string>>(null)
  const [graphURL, setGraphURL] = useState<Maybe<string>>(null)

  const {
    connect, authenticated, initGAPI, initGSI, tokenClient, 
  } = useGAPI()

  const extractTables = useCallback(async (sheetURL: string) => {
    const [, id] = (
      sheetURL.match(/^https:\/\/.+\/([^/]+)\/edit.*$/) ?? []
    )
    if(!id) {
      throw new Error('Invalid Sheet URL.')
    } else {
      console.debug('processing sheet')
      const { epoch } = await processSheet(id) ?? {}
      console.info({ epoch })
      if(!epoch) throw new Error('Failed to extract epoch.')
      setEpoch(epoch)

      const { graph } = await buildGraph({ epochs: [epoch] })
      setGraph(graph)
    }
  }, [])

  useEffect(() => {
    const declaration = JSON.stringify(scDeclaration, null, 2)
    const declBlob = new Blob([declaration], { type: 'text/json' })
    setDeclarationURL(window.URL.createObjectURL(declBlob))
  }, [])

  useEffect(() => {
    const graphJSON = JSON.stringify(graph, null, 2)
    const graphBlob = new Blob([graphJSON], { type: 'text/json' })
    setGraphURL(window.URL.createObjectURL(graphBlob))
  }, [graph])

  return (
    <>
      <Head>
        <title>Coorditang</title>
        <meta
          name="description"
          content="Multitiered Coordinape Distribution"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <link rel="shortcut icon" href="/logo.svg"/>
      </Head>
      <header>
        <img
          id={styles.splash}
          src="/splash.paths.svg"
          alt="Coorditang"
        />
      </header>
      <main className={styles.main}>
        <ol id={styles.steps}>
          <li>
            <form onSubmit={((evt) => {
              evt.preventDefault()
              connect()
            })}>
              <input
                type="submit"
                value={`Connect${authenticated ? 'ed' : ''} to Google`}
                disabled={authenticated || !tokenClient}
              />
            </form>
          </li>
          <li className={styles.flex}>
            <form onSubmit={(async (evt) => {
                evt.preventDefault()

                const form = evt.target as HTMLFormElement
                const sheet = (
                  form.elements.namedItem('sheet') as HTMLInputElement
                )
                await extractTables(sheet.value)
              })}>
              <fieldset id={styles.sheet}>
                <legend>Spreadsheet URL</legend>
                <input id="sheet"/>
                <input
                  type="submit"
                  value="Process"
                  title={
                    authenticated ? 'Process Spreadsheet' : 'Authenticate'
                  }
                  disabled={!authenticated}
                />
              </fieldset>
            </form>
          </li>
          {epoch && Object.keys(epoch.circles ?? {}).length > 0 && (
            <li className={styles.outline}>
              <h2>Data</h2>
              {epoch && (
                <>
                  <h3>Epoch: {epoch.toString()}</h3>
                  {Object.values(epoch.circles).map((circle) => (
                    <Circle key={circle.name} {...{ circle }}/>
                  ))}
                </>
              )}
            </li>
          )}
          <li>
            <ul>
              {declarationURL && (
                <li>
                  <a
                    href={declarationURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    SourceCred Declaration
                  </a>
                </li>
              )}
            </ul>
          </li>
        </ol>
      </main>
      <Script
        strategy="lazyOnload"
        src="https://apis.google.com/js/api.js"
        onLoad={initGAPI}
      />
      <Script
        strategy="lazyOnload"
        src="https://accounts.google.com/gsi/client"
        onLoad={initGSI}
      />
    </>
  )
}
