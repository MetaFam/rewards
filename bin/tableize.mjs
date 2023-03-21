#!/usr/bin/env node

import apolloClient from '@apollo/client'
import fetch from 'node-fetch'
import yargs from 'yargs'
import fs from 'fs'
import { fileURLToPath } from 'url'

const { ApolloClient, InMemoryCache, gql, HttpLink } = apolloClient;

const args = (
  yargs(process.argv.slice(2))
  .options({
    epoch: {
      type: 'string',
      alias: 'e',
      description: 'Comma-separated list of epoch ids to process',
      default: process.env.TOP_CIRCLE,
    },
    graphql: {
      type: 'string',
      alias: 'g',
      description: 'Hasura’s GraphQL endpoint [env:GRAPHQL_URL]',
      default: (
        process.env.GRAPHQL_URL
        ?? 'https://coordinape-prod.hasura.app/v1/graphql'
      ),
      demandOption: true,
    },
    auth: {
      type: 'string',
      alias: 'a',
      description: 'Authorization token [env:AUTH_TOKEN]',
      default: null,
    },
  })
  .alias('h', 'help')
  .help()
)
const argv = await args.argv

const dateFor = (date) => new Date(date).toISOString().split('T')[0]

if(!argv.auth) {
  console.error('No auth token provided')
  process.exit(4)
}

const headers = {
  Authorization: `${!/^bearer\s+/i.test(argv.auth) ? 'Bearer ' : ''}${argv.auth}`
}

const apollo = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: argv.graphql,
    headers,
    fetch,
  })
})

if(!argv.epoch) {
  const epochsQuery = gql`
    query Epochs {
      epochs {
        id
        circle {
          name
        }
        start_date
        end_date
      }
    }
  `

  const { data: { epochs: unsortedEpochs } } = await apollo.query({
    query: epochsQuery,
  })

  const epochs = [...unsortedEpochs].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  )

  console.info('┌--id---┬----------circle------------┬---start----┬----end-----┐')

  epochs.forEach((epoch) => {
    const data = [
      epoch.id.toString().padEnd(5),
      epoch.circle.name.padEnd(26),
      dateFor(epoch.start_date),
      dateFor(epoch.end_date),
    ]
    console.info(`| ${data.join(' | ')} |`)
  })

  process.exit(3)
}

const distributionQuery = gql`
  query EpochDistribution($id: bigint!) {
    epochs(where: {id: {_eq: $id}}) {
      id
      start_date
      end_date
      circle {
        name
        id
      }
      token_gifts {
        recipient {
          address
          profile {
            name
          }
        }
        tokens
        sender {
          address
          profile {
            name
          }
        }
      }
    }
  }
`

const addresses = {}

await Promise.all(
  argv.epoch.split(/,;\s/).map(async (id) => {
    const { data: { epochs: [epoch] } } = await apollo.query({
      query: distributionQuery,
      variables: { id: Number(id) },
    })

    const table = {}

    epoch.token_gifts.forEach(({
      sender: { profile: { name: sender } },
      recipient: { address: toAddr, profile: { name: recipient } },
      tokens,
    }) => {
      table[sender] ??= {}
      table[sender][recipient] = tokens
      addresses[recipient] = toAddr
    })

    const senders = Object.keys(table).sort()
    const allRecipients = (
      Object.values(table).map((dist) => Object.keys(dist)).flat()
    )
    const recipients = [...new Set(allRecipients)].sort()

    const arrs = senders.map((sender) => (
      recipients.map((recipient) => (
        table[sender][recipient] ?? ''
      ))
    ))

    arrs.forEach((arr, i) => arr.unshift(senders[i]))
    recipients.unshift('')
    arrs.unshift(recipients)

    const out = arrs.map((arr) => arr.join(',')).join("\n")

    const csv = `${epoch.circle.name}.${dateFor(epoch.start_date)}–${dateFor(epoch.end_date)}.csv`
    const filename = fileURLToPath(new URL(`../output/${csv}`, import.meta.url))

    console.info(`Writing ${filename}…`)

    fs.writeFileSync(filename, out)
  })
)
