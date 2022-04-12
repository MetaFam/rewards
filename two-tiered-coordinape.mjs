// import {
//   ApolloClient,
//   InMemoryCache,
//   // ApolloProvider,
//   // useQuery,
//   // gql
// } from "@apollo/client"
import fetch from 'node-fetch'
import apollo from '@apollo/client'
import 'dotenv/config'
const { ApolloClient, InMemoryCache, HttpLink, gql } = apollo
// const { ApolloClient, InMemoryCache } = require('@apollo/client')

const query = gql`
  query MyCircles($name: String!) {
    circles(limit: 3, where: {name: {_eq: $name}}) {
      users(order_by: {created_at: asc}) {
        id
        name
        give_token_received
        give_token_remaining
      }
    }
  }
`

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: new HttpLink({
    uri: 'https://coordinape-prod.hasura.app/v1/graphql',
    headers: {
      authorization: process.env.COORDINAPE_AUTH_TOKEN,
    },
    fetch,
  })
})

const main = async () => {
  const result = await client.query({
    query,
    variables: { name: 'MetaGame Guilds & Raids' },
  })
  // console.log(JSON.stringify(result, null, 2))
  const groups = result.data.circles[0].users.filter((user) => (
    /(guild|raid)/i.test(user.name)
  ))
  const total = (
    groups.map((group) => group.give_token_received)
      .reduce((acc, amt) => acc + amt, 0)
  )
  await Promise.all(groups.map(async (group) => {
    const circle = await client.query({
      query,
      variables: { name: group.name },
    })
    console.log(
      `${group.name}: ${(group.give_token_received * 100 / total).toFixed(2)}%`
    )
    const { users } = circle.data.circles[0] ?? {}
    if (users) {
      const userTotal = (
        users.map((user) => user.give_token_received)
          .reduce((acc, amt) => acc + amt, 0)
      )
      users.forEach((user) => {
        if (userTotal === 0) {
          console.log(`  ${user.name}: 0%`)
        } else {
          console.log(
            `  ${user.name}: ${(user.give_token_received * 100 / userTotal).toFixed(2)}%`
          )
        }
      })
    }
  }))
}


main().then(
  () => { process.exit(0) }
)