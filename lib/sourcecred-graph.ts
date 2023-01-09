import { sourcecred as cred1 } from 'sourcecred'
import cred2 from 'sourcecred'
import type {
  SourceArg, Addresser, Epoch, Circle, Participant,
} from '../types'
import { randomUUID } from 'crypto'

// Different imports behave differently between Node & the browser
const sc = cred1 ?? cred2

// pluginName can be anything, but must only contain letters, numbers, and dashes
export const pluginName = 'Multilevel-Coordinape'

export const addressPrefix = ['wtf', 'metagame', 'coordinape']
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

    const distribute = (src: Circle) => {
      Object.entries(src.distribution).map(
        ([, { destination: dest, allotments: allots }]) => {
          graph.addNode({
            address: addr(dest),
            description: `${dest.type}:${dest.name}`,
            timestampMs: null,
          })

          graph.addEdge({
            address: addr.distributed_to([src, dest]),
            timestamp: epoch.end.getTime(),
            src: addr(src),
            dst: addr(dest),
          })

          Object.entries(allots).forEach(([giver, amount]) => {
            if(!!epoch.participants?.[giver]) {
              weights.edgeWeights.set(
                addr.distributed_to([epoch.participants[giver], src, dest]),
                { forwards: amount, backwards: 0 },
              )
            }
          })

          if((dest as Circle).distribution) {
            distribute(dest as Circle)
          }
        }
      )
    }

    if(!epoch.top) throw new Error('No top circle set.')

    distribute(epoch.top)
  }

  return { graph, weights }
}
