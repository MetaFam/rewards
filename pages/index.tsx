/* eslint-disable @next/next/no-img-element */
import Head from 'next/head'
import { useCallback, useEffect, useState } from 'react'
import Script from 'next/script'
import {
  Maybe, Circle, Epoch, NamedScore, CredScore, Participant,
} from '../types'
import { processSheet, participants, getSheet, toId, sum } from '../lib/process';
import {
  buildGraph, declaration as scDeclaration, pluginName, identityProposals, graphToJSON
} from '../lib/sourcecred/graph';
import {
  credRank,
  graphAPI
} from '../lib/sourcecred/test'
import { useGAPI } from '../lib/useGAPI'
import styles from '../styles/Home.module.css'

const Circle = ({ circle }: { circle: Circle }) => {
  const totalTotal = sum(Object.values(circle.totals))

  return (
    <section>
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
          <tr className={styles.total}>
            <th>Total:</th>
            {circle.actees.map(({ id, name }) => {
              const { allotments: allots } = (
                circle.distribution[id] ?? {}
              )
              const localTotal = sum(Object.values(allots))
              return (
                <td key={id} title={`Total: ${name}`}>
                  {localTotal}{' '}
                  ({(localTotal / totalTotal * 100).toFixed(2)}%)
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </section>
  )
}

const Distribution = (
  { participants, dist }:
  {
    participants: Record<string, Participant>
    dist: Record<string, number>
  }
) => {
  const [seed, setSeed] = useState(1000)

  return (
    <table className={styles.table}>
      <thead><tr>
        <th>Participant</th>
        <th>Score</th>
        <th>Percent</th>
        <th>
          <input
            type="number"
            value={seed}
            onChange={({ target: { value } }) => {
              setSeed(parseInt(value, 10))
            }}
            id={styles.seed}
          />{' '}
          SEEDs
        </th>
      </tr></thead>
      <tbody>
        {(() => {
          const total = sum(Object.values(dist))
          return (
            Object.keys(dist).sort().map(
              (id) => {
                const score = dist[id]
                const ratio = score / total
                return (
                  <tr key={id}>
                    <td>{participants[id].name}</td>
                    <td>{score}</td>
                    <td>{(ratio * 100).toFixed(2)}%</td>
                    <td>{(ratio * seed).toFixed(2)}</td>
                  </tr>
                )
              }
            )
          )
        })()}
      </tbody>
    </table>
  )
}

export default function Home() {
  const [authRequired, setAuthRequired] = useState(false)
  const [epoch, setEpoch] = useState<Maybe<Epoch>>(null)
  const [epochURL, setEpochURL] = useState<Maybe<string>>(null)
  const [sheetDataURL, setSheetDataURL] = useState<Maybe<string>>(null)
  const [declarationURL, setDeclarationURL] = useState<Maybe<string>>(null)
  const [graphURL, setGraphURL] = useState<Maybe<string>>(null)
  const [identitiesURL, setIdentitiesURL] = useState<Maybe<string>>(null)
  const [credDistribution, setDist] = (
    useState<Maybe<Record<string, number>>>(null)
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
        const graphJSON = graphToJSON(weightedGraph)
        setGraphURL(window.URL.createObjectURL(
          new Blob([graphJSON], { type: 'text/json' })
        ))

        const identities = identityProposals({
          pluginName, participants: Object.values(participants)
        })

        const identitiesJSON = JSON.stringify(identities, null, 2)
        setIdentitiesURL(window.URL.createObjectURL(
          new Blob([identitiesJSON], { type: 'text/json' })
        ))

        const graphAPIOutput = await graphAPI({
          pluginId: pluginName,
          weightedGraph,
          declaration: scDeclaration,
          identityProposals: identities,
        })

        const { credGrainView } = await credRank({
          ledger: graphAPIOutput.ledger, weightedGraph
        })
        setDist(Object.fromEntries(
          credGrainView.participants().map(
            ({ identity: { name }, cred: score }: CredScore) => (
              [name, score]
            )
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
          content="Coorditang: Multitiered Coordinape Distribution"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <meta property="og:image"  content="splash.png"/>
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
          {authRequired && (
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
          )}
          <li className={styles.flex}>
            <form onSubmit={(async (evt) => {
                evt.preventDefault()

                const form = evt.target as HTMLFormElement
                const sheet = (
                  form.elements.namedItem('sheet') as HTMLInputElement
                )
                try {
                  await extractTables(sheet.value)
                } catch(err) {
                  if((err as { status: number }).status === 403) {
                    alert('Authentication required.')
                    setAuthRequired(true)
                  }
                }
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
                  // disabled={!authenticated}
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
          {epoch && credDistribution && (
            <li className={styles.outline}>
              <h2>Distribution</h2>

              <Distribution
                dist={credDistribution}
                participants={epoch.participants}
              />
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
                    SourceCred Declaration <em>(declaration.json)</em>
                  </a>
                </li>
              )}
              {identitiesURL && (
                <li>
                  <a
                    href={identitiesURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Identity Proposals <em>(identityProposals.json)</em>
                  </a>
                </li>
              )}
              {graphURL && (
                <li>
                  <a
                    href={graphURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Weighted Graph <em>(graph.json)</em>
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
