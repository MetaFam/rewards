import * as neo4j from 'neo4j-driver'

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
    nodes: Array<any>
    edges: Array<any>
  }
) => {
  const database = neo4j.driver(
    url,
    neo4j.auth.basic('neo4j', pass),
    url.startsWith('bolt://') ? { encrypted: 'ENCRYPTION_OFF' } : {},
  )
    const importNodeCypher = `
      MERGE (imp:Import)
      ON CREATE SET
        imp.id = $id,
        imp.at = localdatetime(),
      RETURN imp.id as id
    `
    const params = { id: crypto.randomUUID() }
    const [record] = await query(
      { database, query: importNodeCypher, params }
    )
    const id = record.get('id')

    console.info({ id })
}
