#! /usr/bin/env node

import fetch from 'node-fetch'
import yargs from 'yargs'

import apollo from '@apollo/client'
import 'dotenv/config'
const { ApolloClient, InMemoryCache, HttpLink, gql } = apollo

const epochsQuery = gql`
  query Epochs($name: String!) {
    circles(where: {name: {_eq: $name}}) {
      epochs(order_by: {start_date: asc}) {
        end_date
        id
        start_date
        description
      }
    }
  }
`
const circleQuery = gql`
  query Circle($id: bigint!) {
    circles(where: {id: {_eq: $id}}) {
      users {
        address
        name
        fixed_non_receiver
        non_receiver
      }
    }
  }
`

const distributionQuery = gql`
  query EpochDistribution($id: bigint!) {
    epochs(where: {id: {_eq: $id}}) {
      end_date
      start_date
      circle {
        name
        id

      }

      token_gifts {
        recipient {
          address
          name
        }
        tokens
        sender {
          address
          name
        }
      }
    }
  }
`

const args = (
  yargs(process.argv.slice(2))
  .options({
    top: {
      type: 'string',
      alias: 't',
      description: 'Name of the top-level Circle [env:TOP_CIRCLE]',
      default: process.env.TOP_CIRCLE,
    },
    seeds: {
      type: 'number',
      alias: 's',
      description: 'Number of SEEDs to distribute [env:NUM_SEEDS]',
      default: process.env.NUM_SEEDS,
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
    epoch: {
      type: 'number',
      alias: 'e',
      description: 'Epoch Id [env:EPOCH_ID]',
      default: process.env.EPOCH_ID,
    }
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

const getEpochs = async (top) => {
  const result = await client.query({
    query: epochsQuery,
    variables: { name: top },
  })
  const [circle] = result.data.circles
  if(!circle){
    throw new Error(`No epochs for circle '${top}`)
  }

  return circle.epochs
}

const getEpoch = async (id) => {
  const result = await client.query({
    query: distributionQuery,
    variables: { id },
  })
  
  console.log({result})

  const [epoch] = result.data.epochs
  return epoch
}

const getCircle = async (id) => {
  const result = await client.query({
    query: circleQuery,
    variables: { id },
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

const isoDate = (date) => {
  if(!(date instanceof Date)) {
    date = new Date(date)
  }

  return(
    `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
  )
}

const name = argv.circle

const main = async () => {
  if(argv.epoch == null) {
    if(!argv.top) {
      throw new Error('You must specify the top circle name or an epoch ID.')
    }
    const epochs = await getEpochs(argv.top)
    
    console.log(`Circle: ${argv.top} Epochs`)
    epochs.forEach(
      ({
        start_date: start, end_date: end, id, description
      }) => {
        console.log(
          `${id.toString().padStart(6, ' ')}: ${isoDate(start)}–${isoDate(end)}: ${description ?? ''}`
        )
      }
    )
    process.exit(5)
  }

  const epoch = await getEpoch(argv.epoch) 

  const top = await getCircle(epoch.circle.id)

  const circles = top.users.map((user) => {
    if(!user.fixed_non_receiver){
      return user
    }
  }).filter((u) => !!u)

  console.log({circles})
  // console.log({g: JSON.stringify(epoch.token_gifts, null, 2)})
  
  const gifts = epoch.token_gifts.map((gift) => ({
    from: {
      name: gift.recipient.name,
      address: gift.recipient.address,
    },
    to: {
      name: gift.recipient.name,
      address: gift.recipient.address,
    },
    amount: gift.tokens,
  }))

  circles.forEach((circle) => {
    const received = gifts.filter(
      (gift) => gift.to.address === circle.address
    )
    console.log(`${circle.name}: `)
    received.forEach((gift) => {
      console.log(`  ${gift.from.name}: ${gift.amount}`)
    })
  })
  
  new Set(gifts.map(({ to: { name } }) => name))

  // console.log({Set: Array.from(new Set(gifts.map(({ to: { name } }) => name)))})

  
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
).catch(
  (error) => {
    args.showHelp()
    console.error(error.message)
    process.exit(7)
  }
)
