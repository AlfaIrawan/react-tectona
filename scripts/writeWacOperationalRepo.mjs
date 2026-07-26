import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(
  __dirname,
  '../../../Service Registry Management/python-workspace-access-control-service-fastapi/db/operations/operational_team_repo.py'
)

const body = fs.readFileSync(path.join(__dirname, 'wacOperationalRepoBody.txt'), 'utf8')
if (body.trim() === 'PLACEHOLDER') {
  console.error('Body file not populated yet')
  process.exit(1)
}
fs.writeFileSync(target, body, 'utf8')
console.log('Wrote', target)
