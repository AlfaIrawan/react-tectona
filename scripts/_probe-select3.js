import fs from 'fs'
const s = fs.readFileSync('node_modules/@svar-ui/react-gantt/dist/index.es.js', 'utf8')
const i = s.indexOf('onSelectTask')
console.log(s.slice(i, i + 400))
