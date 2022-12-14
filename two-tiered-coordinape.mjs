#! /usr/bin/env node

import fetch from 'node-fetch'
import yargs from 'yargs'

import apollo from '@apollo/client'
import 'dotenv/config'
const { ApolloClient, InMemoryCache, HttpLink, gql } = apollo

const query = gql`
  query MyCircles($name: String!) {
    circles(where: {name: {_eq: $name}}) {
      name
      users(order_by: {created_at: asc}) {
        name
        give_token_received
        non_receiver
        address
      }
    }
  }
`

const args = (
  yargs(process.argv.slice(2))
  .options({
    circle: {
      type: 'string',
      alias: 'c',
      description: 'Name of the top-level Circle [env:TOP_CIRCLE]',
      default: process.env.TOP_CIRCLE,
      demandOption: true,
    },
    seeds: {
      type: 'number',
      alias: 's',
      description: 'Number of SEEDs to distribute [env:NUM_SEEDS]',
      default: process.env.NUM_SEEDS,
      demandOption: true,
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
  // .showHelpOnFail(true, 'HELP!')
)
const argv = await args.argv

const headers = {}
const token = argv.auth ?? process.env.AUTH_TOKEN
if(token && token.length > 0) {
  headers.Authorization = (
    `${!/^bearer\s+/i.test(token) ? 'Bearer ' : ''}${token}`
  )
}

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: argv.graphql,
    headers,
    fetch,
  })
})



const getCircle = async (name) => {
  const result = await client.query({
    query,
    variables: { name },
  })
  const [circle] = result.data.circles
  return circle
}

const totalReceived = (users) => {
  const total = (
    users.map((user) => user.give_token_received)
      .reduce((acc, amt) => acc + amt, 0)
  )

  if(total === 0) throw new Error('no GIVE allocated')
  return total
}
const name = argv.circle
const main = async () => {
  const top = await getCircle(name) 
  
  if (!top) new Error(`No circle named: "${name}"`)

  // console.log(JSON.stringify(result, null, 2))
  
  const groups = top.users.filter((user) => (
    (!user.non_receiver)
  ))

  const total = totalReceived(groups)

  const dist = await Promise.all(groups.map(async (group) => {
    try {
      const circle = await getCircle(group.name)
      const groupPct = group.give_token_received / total 
      process.stderr.write(
        `${group.name}: ${(groupPct * 100).toFixed(2)}%:`
        + ` ${argv.seeds * groupPct}\n`
      )
      if(circle){
        const { users } = circle
        const userTotal = totalReceived(users)
        return users.map((user) => {
          const received = user.give_token_received
          const userPct = received / userTotal
          process.stderr.write(
            ` ${user.name}: (${user.address})`
            + ` ${(userPct * 100).toFixed(2)}%:`
            + ` ${argv.seeds * groupPct * userPct}\n`
          )
          return {
            name: user.name,
            address: user.address,
            amount: argv.seeds * groupPct * userPct,
          }
        })
      } else {
        return {
          name: group.name,
          address: group.address,
          amount: argv.seeds * groupPct,
        }
      }
    } catch (error){
      console.error(error.message)
    }
  }))
  const entries = dist.flat()
  const recipients = new Set(entries.map(({address}) => address))
  recipients.forEach((address) => {
    const userEntries = entries.filter(({address:addr}) => (
      addr === address
    ))
    const total = (
      userEntries.map(({amount}) => amount)
      .reduce((acc, amt) => acc + amt, 0)
    )
    const [user] = userEntries
    console.log(`${user.name},${user.address},${total}`) 
  }
)}

main().then(
  () => { process.exit(0) }
)
