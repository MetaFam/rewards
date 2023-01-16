/* eslint-disable @next/next/no-img-element */
import Head from 'next/head'
import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import {
  Maybe, Circle, Epoch, NamedScore, CredScore,
} from '../types'
import { processSheet, participants, getSheet, toId } from '../lib/process'
import {
  buildGraph, declaration as scDeclaration, pluginName, identityProposals
} from '../lib/sourcecred/graph';
import {
  credRank,
  graphAPI
} from '../lib/sourcecred/test'
import { useGAPI } from '../lib/useGAPI'
import styles from '../styles/Home.module.css'

const Circle = ({ circle }: { circle: Circle }) => (
  <section key={circle.name}>
    <h3>{circle.name}</h3>
    <table className={
      ['table', 'notch'].map((p) => styles[p]).join(' ')
    }>
      <thead><tr>
        <th></th>
        {circle.actees.map(({ name }) => (
          <th key={name}>{name}</th>
        ))}
      </tr></thead>
      <tbody>
        {circle.actors.map(({ id: actorId, name: actor }) => (
          <tr key={actorId}>
            <th>{actor}</th>
            {circle.actees.map(({ id: acteeId, name: actee }) => {
              const { allotments: allots } = (
                circle.distribution[acteeId] ?? {}
              )
              const title = `${actor}→${actee}`
              const allot = allots?.[actorId]

              return (
                <td {...{ title }} key={title}>
                  {!!allot ? allot : ''}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)

export default function Home() {
  const [epoch, setEpoch] = useState<Maybe<Epoch>>(null)
  const [declarationURL, setDeclarationURL] = useState<Maybe<string>>(null)
  const [epochURL, setEpochURL] = useState<Maybe<string>>(null)
  const [sheetDataURL, setSheetDataURL] = useState<Maybe<string>>(null)
  const [graphURL, setGraphURL] = useState<Maybe<string>>(null)
  const [credDistribution, setDist] = (
    useState<Maybe<Array<NamedScore>>>(null)
  )

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
      const { epoch, data } = await processSheet(await getSheet(id)) ?? {}
      if(!epoch) throw new Error('Failed to extract epoch.')
      setEpoch(epoch)

      const sheetJSON = JSON.stringify(data, null, 2)
      const sheetBlob = new Blob([sheetJSON], { type: 'text/json' })
      setSheetDataURL(window.URL.createObjectURL(sheetBlob))

      const epochJSON = JSON.stringify(epoch, null, 2)
      const epochBlob = new Blob([epochJSON], { type: 'text/json' })
      setEpochURL(window.URL.createObjectURL(epochBlob))
    }
  }, [])

  useEffect(() => {
    const declaration = JSON.stringify(scDeclaration, null, 2)
    const declBlob = new Blob([declaration], { type: 'text/json' })
    setDeclarationURL(window.URL.createObjectURL(declBlob))
  }, [])

  useEffect(() => {
    const test = async () => {
      if(epoch) {
        const weightedGraph = await buildGraph({ epochs: [epoch] })
        const graphJSON = JSON.stringify(weightedGraph, null, 2)
        const graphBlob = new Blob([graphJSON], { type: 'text/json' })
        setGraphURL(window.URL.createObjectURL(graphBlob))

        const identities = identityProposals({
          pluginName, participants: Object.values(participants)
        })

        const graphAPIOutput = await graphAPI({
          pluginId: pluginName,
          weightedGraph,
          declaration: scDeclaration,
          identityProposals: identities,
        })

        const { credGrainView } = await credRank({
          ledger: graphAPIOutput.ledger, weightedGraph
        })
        setDist(credGrainView.participants().map(
          ({ identity: { name }, cred: score }: CredScore) => (
            { name, score }
          )
        ))
      }
    }

    test()
  }, [epoch])

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
                <input
                  id="sheet"
                  defaultValue="https://docs.google.com/spreadsheets/d/1QPObFhGUpbz9ZY2P5n0-g0wQssJZXy3EISFmVOewQho/edit#gid=0"
                />
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
          {credDistribution && (
            <li className={styles.outline}>
              <h2>Distribution</h2>

              <table className={styles.table}>
                <thead><tr>
                  <th>Participant</th>
                  <th>Score</th>
                </tr></thead>
                <tbody>
                  {credDistribution.map(({ name, score }) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          )}
          <li className={styles.outline}>
            <h2>Links</h2>

            <ul>
              {sheetDataURL && (
                <li>
                  <a
                    href={sheetDataURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sheet Data
                  </a>
                </li>
              )}
              {epochURL && (
                <li>
                  <a
                    href={epochURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Epoch
                  </a>
                </li>
              )}
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
