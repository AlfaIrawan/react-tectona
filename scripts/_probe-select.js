import fs from 'fs'
const s = fs.readFileSync('node_modules/@svar-ui/gantt-store/dist/index.js', 'utf8')
const marker = 'select-task",{id:a,toggle:i'
const i = s.indexOf(marker)
console.log(s.slice(i, i + 800))
