import { Circle, Maybe, Participant, UnresolvedCircle } from '../types'

class TableSearchError extends Error {}

export const sum = (arr: Array<number>) => arr.reduce((a, b) => a + b, 0)

const pullCircle = (
  { start, values }:
  {
    start: number
    values: Array<Array<string>>
  }
) => {
  while(start < values.length && values[start].length === 0) {
    start++
  }

  let end = start
  while(
    end + 1 < values.length
    && values[end + 1].length !== 0
    && values[end + 1][0] !== ''
  ) {
    end++
  }

  if(start + 1 >= end) {
    throw new TableSearchError(`No table found after line #${start}`)
  }

  const name = values[start][0] as string
  const actees = values[start].slice(1, -1)
  const actors: Array<Participant> = []
  const distribution = Object.fromEntries(
    values.slice(start + 1, end).map((row) => {
      const actor = participantNamed(row[0] as string)
      actors.push(actor)
      const dist = Object.fromEntries(
        row.slice(1, -1).map((num, idx) => (
          [toId(actees[idx]), Number(num)]
        ))
      )
      return [actor.id, dist]
    })
  )

  const totals = Object.fromEntries(
    actees.map((actee) => [
      toId(actee),
      sum(Object.values(distribution).map(
        (dist) => dist[toId(actee)] ?? 0
      ))
    ])
  )

  const circle = {
    type: 'circle' as 'circle',
    id: toId(name),
    name,
    distribution: Object.fromEntries(
      actees.map((actee) => {
        const id = toId(actee)
        return [
          id,
          {
            destination: id,
            allotments: Object.fromEntries(
              actors.map((actor) => {
                const amount = distribution[actor.id]?.[id]
                return (amount ? [actor.id, amount] : [])
              })
              .filter((x) => x.length > 0)
            ),
          },
        ]
      })
    ),
    actors,
    actees,
    totals,
  }

  return {
    circle,
    name,
    distribution,
    actors,
    actees,
    startRow: start,
    endRow: end,
  }
}

export const dateRangeFor = (date: string) => {
  if(!/^\S+ \d{4}/.test(date)) return null

  const [month, year] = date.split(' ')
  const start = new Date(`${month} 1, ${year}`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() - 1)

  return {
    start,
    end,
    toString() {
      return (
        `${start.getFullYear()}/${start.getMonth() + 1}/`
        + `${start.getDate()}–${end.getDate()}`
      )
    },
  }
}

export const toId = (str: string) => (
  str.replace(/[^\da-z-]/gi, '-').toLowerCase()
)

export const participants: Record<string, Participant> = {}
export const addresses: Record<string, string> = {}
export const participantNamed = (name: string) => {
  const id = toId(name)

  if(!/^[\da-z-]+$/.test(id)) {
    throw new Error(`Invalid participant name "${name}".`)
  }

  let participant = participants[id]
  if(!participant) {
    participants[id] = participant = (
      { type: 'participant', name, id, address: addresses[id] }
    )
  }
  participant.address ??= addresses[id]

  return participant
}

export const getSheet = async (id: string) => {
  const api = (window.gapi.client as any).sheets
  const response = await api.spreadsheets.values.get({
    spreadsheetId: id,
    range: '!A1:Q100',
  })

  const { values, range } = response.result
  if(!values || values.length === 0) {
    throw new Error(`No values found in spreadsheet "${id}".`)
  }

  const [, sheetName] = range.match(/^(?:'([^']+)'|([^']\S+))!.*$/) ?? []

  return (
    { sheetName, values } as
    { sheetName: string, values: Array<Array<string>>}
  )
}
export const processSheet = async (
  { sheetName, values }:
  { sheetName: string, values: Array<Array<string>> }
) => {
  const span = dateRangeFor(sheetName)

  if(!span) throw new Error(`Unparsable "${sheetName}".`)

  const unresCircles: Record<string, UnresolvedCircle> = {}
  let topId: Maybe<string> = null
  let start = 0
  try {
    for(;;) {
      const info = pullCircle({ start, values })
      const id = toId(info.name)
      start = info.endRow + 1
      topId ??= id
      if(
        topId === id
        || unresCircles[topId].actees.map(toId).includes(id)
      ) {
        unresCircles[id] = info.circle
      } else {
        console.warn(
          `Circle "${info.name}" ("${id}") is not a column of "${topId}".`
        )
      }
    }
  } catch(err) {
    if(!(err instanceof TableSearchError)) throw err
  }

  if(values[++start][0] === 'Players') {
    while(values[++start]?.length > 0) {
      const [name, address] = values[start].slice(1)
      console.info({ name, address })
      addresses[toId(name)] = address
    }
  }

  if(!topId) throw new Error('No top circle found.')

  const circles: Record<string, Circle> = {}

  Object.entries(unresCircles).forEach(
    ([name, circle]) => {
      if(name === topId) return

      circles[name] = (
        Object.assign(
          {},
          circle,
          { actees: circle.actees.map(participantNamed) },
          { distribution: Object.fromEntries(
            Object.entries(circle.distribution).map(
              ([name, dist]) => [
                name,
                {
                  destination: participantNamed(dist.destination),
                  allotments: dist.allotments,
                },
              ]
            )
          ) },
        )
      )
    }
  )

  circles[topId] = (
    Object.assign(
      {},
      unresCircles[topId],
      { actees: unresCircles[topId].actees.map(
        (actee) => circles[toId(actee)]
      ) },
      { distribution: Object.fromEntries(
        Object.entries(unresCircles[topId].distribution).map(
          ([name, dist]) => [
            name,
            {
              destination: circles[dist.destination],
              allotments: dist.allotments,
            },
          ]
        )
      ) },
    )
  )

  const epoch = Object.assign({}, span, {
    type: 'epoch',
    id: toId(sheetName),
    top: circles[topId],
    circles,
    participants,
  })

  return { sheetName, circles, epoch, data: values }
}
