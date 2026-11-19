import { readFileSync } from 'node:fs'

function positionCode(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36).toUpperCase().padStart(5, '0').slice(-5)
}

const target = (process.argv[2] || '').toUpperCase().replace(/^#/, '')
const files = ['src/ui/trainingCurriculum.ts', 'src/ui/difficultyPositions.ts']
for (const file of files) {
  const txt = readFileSync(file, 'utf8')
  const re = /(?:xgid|gnuPos): '([^']+)'[^\n}]*?answer: '([^']*)'[^\n}]*?title: '((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = re.exec(txt))) {
    if (positionCode(m[1]) === target) {
      console.log('FOUND in', file)
      console.log('  id    :', m[1])
      console.log('  answer:', m[2] || '(boş → motor karar verir)')
      console.log('  title :', m[3].replace(/\\'/g, "'"))
    }
  }
}
console.log('arandı:', target)
