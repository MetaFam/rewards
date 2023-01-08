import { sourcecred as sc } from 'sourcecred'

export type Addresser = {
  epoch: () => string
  top: () => string
  guild: () => string
  player: () => string
  divided_by: () => string
  distributed_to: () => string
}
export type ElementSource = {
  id: string
  type?: string
}
export type SourceArg = ElementSource | Array<ElementSource>

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
      description: 'A period of time in Coordinape over which contributions are measured',
    },
    topCircle: {
      name: 'top',
      pluralName: 'tops',
      prefix: addr.top(),
      defaultWeight: 0,
      description: 'A circle for disrtibuting to guilds',
    },
    guild: {
      name: 'guild',
      pluralName: 'guilds',
      prefix: addr.guild(),
      defaultWeight: 0,
      description: 'A working group within the organization',
    },
    player: {
      name: 'player',
      pluralName: 'players',
      prefix: addr.player(),
      defaultWeight: 0,
      description: 'A participant in the organization',
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

export const buildGraph = () => {
  
}