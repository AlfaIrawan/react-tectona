import fs from 'fs'
const s = fs.readFileSync('node_modules/@svar-ui/gantt-store/dist/index.js', 'utf8')
const i = s.indexOf('on("select-task"')
console.log(s.slice(i, i + 900))
