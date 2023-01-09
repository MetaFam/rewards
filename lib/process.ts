import { Circle, Participant } from '../types'

class TableSearchError extends Error {}

const pullCircle = (
  { start, values, participantNamed }:
  {
    start: number
    values: Array<Array<unknown>>
    participantNamed: (name: string) => Participant
  }
) => {
  while(start < values.length && values[start].length === 0) {
    start++
  }

  let end = start
  while(end + 1 < values.length && values[end + 1].length !== 0) {
    end++
  }

  if(start === end) {
    throw new TableSearchError(`No table found after line #${start}`)
  }

  const name = values[start][0] as string
  const actees = values[start].slice(1, -1) as Array<string>
  const actors: Array<Participant> = []
  const distribution = Object.fromEntries(
    values.slice(start + 1, end).map((row) => {
      const actor = row[0] as string
      actors.push(participantNamed(actor))
      const dist = Object.fromEntries(
        row.slice(1, -1).map((num, idx) => (
          [actees[idx], Number(num)]
        ))
      )
      return [actor, dist]
    })
  )
  const circle = {
    type: 'circle' as 'circle',
    id: name.replace(/[^a-z-]/gi, '-'),
    name,
    distribution: actees.map((actee) => ({
      destination: actee,
      allotments: Object.fromEntries(
        actors.map((actor) => (
          [actor.name, distribution[actor.name]?.[actee] ?? 0]
        )),
      ),
    })),
    actors,
    actees,
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

const dateRangeFor = (date: string) => {
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

export const processSheet = async (id: string) => {
  const participants: Record<string, Participant> = {}

  const participantNamed = (name: string) => {
    let participant = participants[name]
    if(!participant) {
      participants[name] = participant = (
        { type: 'participant', name, id: crypto.randomUUID() }
      )
    }
    return participant
  }

  const api = (gapi.client as any).sheets
  const response = await api.spreadsheets.values.get({
    spreadsheetId: id,
    range: '!A1:Q100',
  })

  const { values, range } = response.result
  if(!values || values.length === 0) {
    throw new Error('No values found in spreadsheet "${id}".')
  }

  const [, sheetName] = range.match(/^(?:'([^']+)'|([^']\S+))!.*$/) ?? []

  const epoch = dateRangeFor(sheetName)

  if(!epoch) throw new Error(`Unparsable "${sheetName}".`)

  const circles: Record<string, Circle> = {}
  let topName = null
  try {
    let start = 0
    while(true) {
      const info = pullCircle({ start, values, participantNamed })
      start = info.endRow + 1
      topName ??= info.name
      if(
        topName === info.name
        || circles[topName].actees.includes(info.name)
      ) {
        circles[info.name] = info.circle
      } else {
        console.warn(
          `Circle "${info.name}" is not a column of "${topName}".`
        )
      }
    }
  } catch(err) {
    if(!(err instanceof TableSearchError)) throw err
  }

  if(!topName) throw new Error('No top circle found.')

  Object.assign(epoch, {
    circles,
    top: circles[topName],
    participants,
  })

  return { sheetName, circles, epoch }
}
