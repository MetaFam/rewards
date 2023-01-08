import { Maybe, Table } from './App'

const pullTable = (
  { start, values }: { start: number, values: Array<Array<unknown>>}
) => {
  while(start < values.length && values[start].length === 0) {
    start++
  }

  let end = start
  while(end + 1 < values.length && values[end + 1].length !== 0) {
    end++
  }

  if(start === end) throw new Error(`No table found after line #${start}`)

  const name = values[start][0] as string
  const cols = values[start].slice(1, -1) as Array<string>
  const distribution = Object.fromEntries(
    values.slice(start + 1, end).map((row) => {
      const actor = row[0]
      const dist = Object.fromEntries(
        row.slice(1, -1).map((num, idx) => (
          [cols[idx], Number(num)]
        ))
      )
      return [actor, dist]
    })
  )

  return { name, distribution, cols, startRow: start, endRow: end }
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
  try {
    const api = (gapi.client as any).sheets
    const response = await api.spreadsheets.values.get({
      spreadsheetId: id,
      range: '!A1:Q100',
    });

    const { values, range } = response.result;
    if(!values || values.length === 0) {
      throw new Error('No values found in spreadsheet "${id}".')
    }

    const [, sheetName] = range.match(/^(?:'([^']+)'|([^']\S+))!.*$/) ?? []

    const epoch = dateRangeFor(sheetName)

    const tables: Record<string, Table> = {}
    try {
      let start = 0
      let topName = null
      while(true) {
        const table = pullTable({ start, values })
        start = table.endRow + 1
        topName ??= table.name
        if(
          topName == table.name
          || tables[topName].cols.includes(table.name)
        ) {
          tables[table.name] = table
        } else {
          console.warn(
            `Table "${table.name}" is not a column of "${topName}".`
          )
        }
      }
    } catch(err) {
      if(!(err as Error).message.startsWith(
        'No table found after line'
      )) {
        throw err
      }
    }
    return { sheetName, tables, epoch }
  } catch (err) {
    console.error({ err })
    // setStatus(<p>Error: {(err as Error).message}</p>)
  }
}