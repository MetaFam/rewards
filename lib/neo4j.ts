import * as neo4j from 'neo4j-driver'
import { PapaResult } from '../types'

export const query = async (
  { database, query, params }:
  {
    database: neo4j.Driver
    query: string
    params: Record<string, unknown>
  }
) => {
  const session = database.session({ database: 'neo4j' })
  try {
    const result = await session.run(query, params)
    return result.records
  } finally {
    await session.close()
  }
}

export const load = async (
  { url, pass, nodes, edges }:
  {
    url: string
    pass: string
    nodes: PapaResult
    edges: PapaResult
  }
) => {
  const database = neo4j.driver(
    url,
    neo4j.auth.basic('neo4j', pass),
    url.startsWith('bolt://') ? { encrypted: 'ENCRYPTION_OFF' } : {},
  )
  const prefix = new Date().toISOString()

  await Promise.all(
    nodes.data.map(async (node) => {
      const {
        cred, description, mint, timestampMs: timestamp,
      } = node
      const addr = node['address:ID']
      const params = {
        id: `${prefix}/${addr}`,
        type: node['nodeType:LABEL'],
        plugin: node['plugin:LABEL'],
        cred, description, mint,
        timestamp: (
          timestamp ? new Date(timestamp).toISOString() : null
        ),
      }

      let label = 'Node'
      const path = addr.split('/')
      if(path.includes('CIRCLE')) {
        label = 'Circle'
      } else if(path.includes('USER_EPOCH')) {
        label = 'User'
      } else if(path.includes('EPOCH')) {
        label = 'Epoch'
      } else if(path.includes('SEED')) {
        label = 'Seed'
      } else if(path.includes('EPOCH_ACCUMULATOR')) {
        label = 'Accumulator'
      }

      const creationCypher = `
        MERGE (n:${label} { id: $id })
        SET
          n.type = $type,
          n.plugin = $plugin,
          n.cred = $cred,
          n.description = $description,
          n.mint = $mint,
          n.timestamp = $timestamp
        RETURN n
      `
      await query(
        { database, query: creationCypher, params }
      )
    })
  )

  await Promise.all(
    edges.data.map(async (edge) => {
      const {
        address: addr, credFlow, reversed, transitionProbability,
      } = edge
      const params = {
        id: `${prefix}/${addr}`,
        srcId: `${prefix}/${edge['src:START_ID']}`,
        destId: `${prefix}/${edge['dst:END_ID']}`,
        credFlow, reversed, transitionProbability,
      }

      const creationCypher = `
        MERGE (src { id: $srcId })
        MERGE (dest { id: $destId })
        MERGE (src)-[e:Edge { id: $id }]->(dest)
        SET
            e.credFlow = $credFlow,
            e.reversed = $reversed,
            e.transitionProbability = $transitionProbability
        RETURN e
      `
      await query(
        { database, query: creationCypher, params }
      )
    })
  )

  console.info('Import Done.')
}
