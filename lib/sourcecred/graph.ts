import { sourcecred as cred1 } from 'sourcecred'
import cred2 from 'sourcecred'
import type {
  SourceArg, Addresser, Epoch, Circle, Participant,
} from '../../types'
import { toId, participantNamed, sum } from '../process';

// Different imports behave differently between Node & the browser
const sc = cred1 ?? cred2

// pluginName can be anything, but must only contain letters, numbers, and dashes
export const pluginName = 'Multilevel-Coordinape'

export const addressPrefix = ['wtf', 'metagame', 'coorditang']
export const nodePrefix = sc.core.graph.NodeAddress.fromParts(addressPrefix)
export const edgePrefix = sc.core.graph.EdgeAddress.fromParts(addressPrefix)

export const addr = (() => {
  const addrFunc = (
    { type = 'node', title }: { type?: string, title?: string } = {}
  ) => (
    (src: SourceArg) => {
      const args = []
      
      args.push(type === 'node' ? nodePrefix : edgePrefix)
      src = Array.isArray(src) ? src : [src]
      const name = title ?? src[0].type

      if(name === 'participant' && src.length === 1) {
        const { nodeAddressForEthAddress } = (
          sc.plugins.ethereum.utils.address
        )
        const { address, name } = src[0] as Participant
        if(!address) throw new Error(`No address found for ${name}.`)
        return nodeAddressForEthAddress(address)
      }

      if(name) args.push(name.toUpperCase())

      const ids = (
        src.map((src) => (
          typeof src === 'object' ? `${src.type}:${src.id}` : src
        ))
        .filter((src) => !!src)
      )
      args.push(...ids)
  
      return (type === 'node' ? (
        sc.core.graph.NodeAddress.append.apply(this, args)
      ) : (
        sc.core.graph.EdgeAddress.append.apply(this, args)
      ))
    }
  )
  
  const addr = addrFunc()
  Object.assign(
    addr, 
    Object.fromEntries(
      ['epoch', 'top', 'guild', 'player'].map((title) => (
        [title, addrFunc({ title })]
      ))
      .concat(['divided_by', 'distributed_to'].map((title) => (
        [title, addrFunc({ title, type: 'edge' })]
      )))
    )
  )
  return addr as unknown as Addresser
})()

export const declaration = (() => {
  const nodeTypes = {
    epoch: {
      name: 'epoch',
      pluralName: 'epochs',
      prefix: addr.epoch(),
      defaultWeight: 1,
      description: 'Period of time over which contributions are measured.',
    },
    topCircle: {
      name: 'top',
      pluralName: 'tops',
      prefix: addr.top(),
      defaultWeight: 0,
      description: 'A circle for distributing to guilds.',
    },
    guild: {
      name: 'guild',
      pluralName: 'guilds',
      prefix: addr.guild(),
      defaultWeight: 0,
      description: 'A working group within the organization.',
    },
    player: {
      name: 'player',
      pluralName: 'players',
      prefix: addr.player(),
      defaultWeight: 0,
      description: 'A participant in the organization.',
    },
  }

  const edgeTypes = {
    divided_by: {
      forwardName: 'divided by',
      backwardName: 'was divided by',
      prefix: addr.divided_by(),
      defaultWeight: { forwards: 1, backwards: 0 },
      description: 'Connects an epoch to the circle which divides it.'
    },
    distributed_to: {
      forwardName: 'distributed to',
      backwardName: 'received',
      prefix: addr.distributed_to(),
      defaultWeight: { forwards: 1, backwards: 0 },
      description: 'Connects a Circle to its members.'
    },
  }
  
  return {
    name: pluginName,
    nodePrefix,
    nodeTypes: Object.values(nodeTypes),
    edgePrefix,
    edgeTypes: Object.values(edgeTypes),
    userTypes: [nodeTypes.player],
    keys: {
      operatorKeys: [],
      shareKeys: [],
      weightKeys: [],
    },
  }
})()

export const buildGraph = ({ epochs }: { epochs: Array<Epoch>}) => {
  const graph = new sc.core.graph.Graph()
  const weights = sc.core.weights.empty()

  for (const epoch of epochs) {
    graph.addNode({
      address: addr(epoch),
      description: `Epoch from ${epoch.toString()}`,
      timestampMs: epoch.end.getTime(),
    })

    const { top } = epoch
    graph.addNode({
      address: addr(top),
      description: `Top Circle for Epoch ${epoch.toString()}`,
      timestampMs: epoch.end.getTime(),
    })

    graph.addEdge({
      address: addr.divided_by([epoch, top]),
      timestamp: epoch.end.getTime(),
      src: addr(epoch),
      dst: addr(top),
    })

    // Creates a graph where GIVE gifts are the edge weights
    const weightDistribute = (src: Circle) => {
      Object.entries(src.distribution).map(
        ([, { destination: dest, allotments: allots }]) => {
          graph.addNode({
            address: addr(dest),
            description: `${dest.type}: ${dest.name}`,
            timestampMs: null,
          })

          Object.entries(allots).forEach(([giver, amount]) => {
            const participant = participantNamed(giver)
            if(amount > 0) {
              const address = addr.distributed_to(
                [participant, src, dest]
              )

              graph.addEdge({
                address,
                timestamp: epoch.end.getTime(),
                src: addr(src),
                dst: addr(dest),
              })

              weights.edgeWeights.set(
                address, { forwards: amount, backwards: 0 },
              )
            }
          })

          if((dest as Circle).distribution) {
            weightDistribute(dest as Circle)
          }
        }
      )
    }

    // Create a graph where the relative percentages received
    // are the edge weights
    const probabilityDistribute = (src: Circle) => {
      const totalTotal = sum(Object.values(src.totals))
      Object.entries(src.totals).forEach(([destId, amount]) => {
        const { destination: dest } = src.distribution[destId]

        graph.addNode({
          address: addr(dest),
          description: `${dest.type}: ${dest.name}`,
          timestampMs: null,
        })

        const address = addr.distributed_to([src, dest])

        graph.addEdge({
          address,
          timestamp: epoch.end.getTime(),
          src: addr(src),
          dst: addr(dest),
        })

        weights.edgeWeights.set(
          address,
          { forwards: amount / totalTotal, backwards: 0 },
        )

        if((dest as Circle).distribution) {
          probabilityDistribute(dest as Circle)
        }
      })
    }


    if(!epoch.top) throw new Error('No top circle set.')

    probabilityDistribute(epoch.top)
  }

  return { graph, weights }
}

export const identityProposals = (
  { pluginName, participants }:
  { pluginName: string, participants: Array<Participant> }
) => (
  participants.map((participant) => ({
    // "name" can only contain letters, numbers, and dashes
    name: toId(participant.name),
    pluginName,
    type: 'USER', // The options are USER, BOT, ORGANIZATION, PROJECT
    alias: {
      description: `participant: ${participant.name}`,
      address: addr(participant),
    }
  }))
)

export const graphToJSON = (graph: typeof sc.core.weightedGraph) => (
  JSON.stringify(
    sc.core.weightedGraph.toJSON(graph), null, 2
  )
)
