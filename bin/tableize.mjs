#!/usr/bin/env node

import fs from 'fs'

const [filename] = process.argv.slice(2)
const data = JSON.parse(
  fs.readFileSync(filename, 'utf8')
)

const table = {}

data.forEach(({
  sender: { name: sender },
  recipient: { name: recipient },
  tokens,
}) => {
  table[sender] ??= {}
  table[sender][recipient] = tokens
})

const senders = Object.keys(table).sort()
const allRecipients = (
  Object.values(table).map((dist) => Object.keys(dist)).flat()
)
const recipients = [...new Set(allRecipients)].sort()

const arrs = senders.map((sender) => (
  recipients.map((recipient) => (
    table[sender][recipient] ?? ''
  ))
))

arrs.forEach((arr, i) => arr.unshift(senders[i]))
recipients.unshift('')
arrs.unshift(recipients)

const out = arrs.map((arr) => arr.join(',')).join("\n")

console.debug(out)
