import { spawn, spawnSync } from 'node:child_process'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const dir = dirname(fileURLToPath(import.meta.url))
const fixturePath = resolve(dir, '../../src/modules/workspace-management/demo/workspaceDemoFixtures.ts')
const compiled = ts.transpileModule(readFileSync(fixturePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { buildWorkspaceDemo, demoScenarios } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const images = {
  db: 'sha256:de3a4eab8fdfa507ea92aac488b916b08089e515db49b055fe71dfa271ba3a28',
  identity: 'sha256:ef46d130f0b13cc6cad0b06bae3dda7f5479ab3486c1cc5a79328f948b4a0ff6',
  org: 'sha256:44b08e7efaf41ddcf206fdd65cbb8b24e38dd3fa9a58396a7785b2a564febd0a',
  wac: 'sha256:863f6b733dffb4327a588fbc4ac2edf5489a57eadd3b0565e21a57dad2321698',
}
const services = {
  identity: ['IDENTITY_LITE', 'identity_sandbox', 8430],
  org: ['WORKSPACE_ORG', 'workspace_org_sandbox', 8424],
  wac: ['WORKSPACE_ACCESS_CONTROL', 'wac_sandbox', 8421],
}
const marker = 'io.tectona.workspace-sandbox'
const dockerArgs = ['--context', 'desktop-linux']
const [action, scenario, employeeSelector] = process.argv.slice(2)
const master = readFileSync(0, 'utf8').trim()
if (!/^[0-9a-f]{64}$/.test(master)) throw new Error('Invalid or missing local sandbox key')
const derive = (label) => createHmac('sha256', Buffer.from(master, 'hex')).update(label).digest('hex')
const index = demoScenarios.indexOf(scenario)
if (index < 0) throw new Error('Choose enterprise, smb or startup')
const dataset = buildWorkspaceDemo(scenario)
const before = scenario === 'enterprise' ? undefined : buildWorkspaceDemo(scenario, 'before-consolidation')
for (const person of dataset.employees) person.email = person.email.replace(/\.test$/, '.example.com')

const prefix = `tectona-wm-sandbox-${scenario}`
const network = prefix
const relayNetwork = `${prefix}-loopback`
const volume = `${prefix}-pgdata`
const ownership = derive('ownership:' + scenario).slice(0, 24)
const host = `${scenario}.localhost`
const port = 9561 + index
const origin = `http://${host}:${port}`
const hostPort = (service) => 19611 + index * 10 + Object.keys(services).indexOf(service)
const name = (service) => `${prefix}-${service}`
const pw = derive('postgres:' + scenario)
const jwt = derive('jwt:' + scenario)

function assert(ok, message) {
  if (!ok) throw new Error(message)
}

function docker(args, { optional = false, env, input } = {}) {
  const proc = spawnSync('docker', [...dockerArgs, ...args], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env }, input,
  })
  if (proc.status === 0) return proc.stdout.trim()
  if (optional && /No such (object|container|network|volume|image)|network [\w-]+ not found/i.test(proc.stderr)) return null
  // Docker may echo environment or SQL parameters. Print the action only.
  throw new Error(`Docker ${args[0]} failed for ${scenario} (exit ${proc.status})`)
}

function inspect(kind, target) {
  const raw = docker([kind, 'inspect', target], { optional: true })
  return raw ? JSON.parse(raw)[0] : null
}

function checkLabel(resource, target) {
  assert((resource.Config?.Labels ?? resource.Labels)?.[marker] === ownership, `Unrecognized sandbox resource: ${target}`)
}

function verifyTopology({ allowMissing = false } = {}) {
  const net = inspect('network', network)
  const disk = inspect('volume', volume)
  if (net) {
    checkLabel(net, network)
    assert(net.Internal && net.Driver === 'bridge', 'Sandbox network must be internal')
    for (const attachment of Object.values(net.Containers ?? {})) {
      assert(['db', 'relay', ...Object.keys(services)].some((kind) => name(kind) === attachment.Name), 'Foreign sandbox network attachment')
    }
  } else assert(allowMissing, 'Sandbox network is missing')
  if (disk) checkLabel(disk, volume)
  else assert(allowMissing, 'Sandbox database volume is missing')

  for (const service of ['db', ...Object.keys(services)]) {
    const container = inspect('container', name(service))
    if (!container) {
      assert(allowMissing, `Sandbox service missing: ${service}`)
      continue
    }
    checkLabel(container, name(service))
    assert(container.Image === images[service], `Unexpected ${service} image`)
    assert(container.HostConfig.NetworkMode === network, `Unexpected ${service} network`)
    const bindings = Object.entries(container.HostConfig.PortBindings ?? {})
    if (service === 'db') {
      assert(bindings.length === 0, 'Sandbox PostgreSQL must have no published ports')
      assert(container.Mounts.length === 1 && container.Mounts[0].Name === volume &&
        container.Mounts[0].Destination === '/var/lib/postgresql/data', 'Unexpected database volume')
    } else {
      assert(bindings.length === 0, `Unexpected ${service} published port`)
      assert(Object.keys(container.NetworkSettings.Networks).every((value) => value === network), 'Unexpected backend network attachment')
      const env = new Set(container.Config.Env)
      for (const [key, value] of Object.entries(envFor(service))) {
        assert(env.has(`${key}=${value}`), `Unexpected ${service} configuration for ${key}`)
      }
    }
  }
  const bridge = inspect('network', relayNetwork)
  const relay = inspect('container', name('relay'))
  if (bridge) {
    checkLabel(bridge, relayNetwork)
    assert(bridge.Driver === 'bridge' && Object.values(bridge.Containers ?? {}).every((item) => item.Name === name('relay')),
      'Unexpected relay network attachment')
  } else assert(allowMissing, 'Sandbox relay network is missing')
  if (relay) {
    checkLabel(relay, name('relay'))
    assert(relay.Image === images.identity && relay.HostConfig.NetworkMode === relayNetwork, 'Unexpected relay image or network')
    const attached = Object.keys(relay.NetworkSettings.Networks)
    assert(attached.length === 2 && attached.includes(network) && attached.includes(relayNetwork), 'Unexpected relay connections')
    const bindings = relay.HostConfig.PortBindings
    assert(Object.keys(bindings).length === 3, 'Unexpected number of relay ports')
    for (const [service, [, , servicePort]] of Object.entries(services)) {
      const binding = bindings[`${servicePort}/tcp`]
      assert(binding?.length === 1 && binding[0].HostIp === '127.0.0.1' &&
        Number(binding[0].HostPort) === hostPort(service), 'Unexpected relay port')
    }
  } else assert(allowMissing, 'Sandbox relay is missing')
}

function envFor(service) {
  const [key, database] = services[service]
  const env = {
    TECTONA_WORKSPACE_SANDBOX: 'v1',
    TECTONA_WORKSPACE_SCENARIO: scenario,
    PYTHONPATH: '/app',
    [key + '_ENVIRONMENT']: 'development',
    [key + '_POSTGRES_USER']: 'tectona_sandbox',
    [key + '_POSTGRES_HOST']: 'db',
    [key + '_POSTGRES_PASSWORD']: pw,
    [key + '_POSTGRES_DB']: database,
    [key + '_JWT_SECRET']: jwt,
    [key + '_JWT_ISSUER']: origin,
    [key + '_JWT_AUDIENCE']: 'tectona-spa',
    [key + '_REGISTER_WITH_REGISTRY_CORE']: 'false',
    [key + '_REGISTER_DECLARED_DEPENDENCIES_WITH_TOPOLOGY']: 'false',
  }
  if (service === 'identity') Object.assign(env, {
    IDENTITY_LITE_ISSUER_BASE_URL: origin,
    IDENTITY_LITE_TECTONA_APP_BASE_URL: origin,
    IDENTITY_LITE_ALLOW_PUBLIC_REGISTER: 'false',
    IDENTITY_LITE_SMTP_HOST: '',
    IDENTITY_LITE_FEDERATION_MICROSOFT_ENABLED: 'false',
    IDENTITY_LITE_FEDERATION_GOOGLE_ENABLED: 'false',
    IDENTITY_LITE_FEDERATION_META_ENABLED: 'false',
  })
  if (service === 'org') Object.assign(env, {
    WORKSPACE_ORG_AUTH_DISABLED: 'false',
    WORKSPACE_ORG_IDENTITY_LITE_BASE_URL: 'http://identity:8430',
    WORKSPACE_ORG_WAC_BASE_URL: 'http://wac:8421',
    WORKSPACE_ORG_SEED_DEV_DIRECTORY: 'false',
  })
  if (service === 'wac') Object.assign(env, {
    WORKSPACE_ACCESS_CONTROL_AUTH_DISABLED: 'false',
    WORKSPACE_ACCESS_CONTROL_SEED_DEV_MEMBERSHIPS: 'false',
    WORKSPACE_ACCESS_CONTROL_WORKSPACE_ORG_BASE_URL: 'http://org:8424',
  })
  return env
}

function envArgs(env) {
  return Object.keys(env).flatMap((key) => ['--env', key])
}

function checkFreePort(portToCheck) {
  return new Promise((resolvePort, reject) => {
    const listener = createServer().once('error', () => reject(new Error(`Sandbox port ${portToCheck} is already in use`)))
    listener.listen(portToCheck, '127.0.0.1', () => listener.close(resolvePort))
  })
}

async function ready(probe, label) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await probe()) return
    await new Promise((wait) => setTimeout(wait, 500))
  }
  throw new Error(`${label} did not become ready`)
}

function runSeed(service, args, payload, env) {
  return new Promise((resolveSeed, reject) => {
    const child = spawn('docker', [...dockerArgs, ...args], { windowsHide: true, env: { ...process.env, ...env } })
    let output = ''
    let diagnostic = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      output += chunk
      for (const line of chunk.split('\n')) {
        if (/^Verified [A-Za-z0-9 (),]+$/.test(line) ||
            /^Identity rows checked: \d+$/.test(line)) console.log(`${scenario}: ${line}`)
      }
    })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { diagnostic += chunk })
    child.stdin.on('error', () => {})
    child.on('error', reject)
    child.on('close', (status) => {
      if (status === 0) resolveSeed(output.trim())
      else {
        const safe = diagnostic.match(/Sandbox (?:identity|org|wac) seed failed: [\w /-]+/)?.[0]
        reject(new Error(safe ?? `Sandbox ${service} seed exited with status ${status}`))
      }
    })
    child.stdin.end(JSON.stringify({ dataset, origin, before, ...payload }))
  })
}

async function start() {
  verifyTopology({ allowMissing: true })
  for (const [service, image] of Object.entries(images)) {
    assert(docker(['image', 'inspect', image], { optional: true }), `Required local image unavailable: ${service}`)
    if (service !== 'db' && !inspect('container', name('relay'))) await checkFreePort(hostPort(service))
  }
  if (!inspect('network', network)) docker(['network', 'create', '--internal', '--label', `${marker}=${ownership}`, network])
  if (!inspect('volume', volume)) docker(['volume', 'create', '--label', `${marker}=${ownership}`, volume])
  if (!inspect('container', name('db'))) {
    const env = { POSTGRES_USER: 'tectona_sandbox', POSTGRES_PASSWORD: pw }
    docker(['create', '--name', name('db'), '--network', network, '--network-alias', 'db',
      '--label', `${marker}=${ownership}`, '--mount', `type=volume,source=${volume},target=/var/lib/postgresql/data`,
      ...envArgs(env), images.db], { env })
  }
  for (const service of Object.keys(services)) {
    if (inspect('container', name(service))) continue
    const env = envFor(service)
    docker(['create', '--name', name(service), '--network', network, '--network-alias', service,
      '--label', `${marker}=${ownership}`,
      '--mount', `type=bind,source=${dir},target=/sandbox,readonly`,
      '--mount', `type=bind,source=${resolve(dir, 'empty.env')},target=/app/.env,readonly`,
      ...envArgs(env), images[service]], { env })
  }
  if (!inspect('network', relayNetwork)) {
    docker(['network', 'create', '--label', `${marker}=${ownership}`, relayNetwork])
  }
  if (!inspect('container', name('relay'))) {
    docker(['create', '--name', name('relay'), '--network', relayNetwork,
      '--label', `${marker}=${ownership}`, '--read-only',
      '--mount', `type=bind,source=${dir},target=/sandbox,readonly`,
      ...Object.keys(services).flatMap((service) => ['--publish', `127.0.0.1:${hostPort(service)}:${services[service][2]}`]),
      images.identity, 'python', '-B', '/sandbox/relay.py'])
    docker(['network', 'connect', network, name('relay')])
  }
  verifyTopology()
  console.log(`${scenario}: verified internal network, dedicated PostgreSQL volume, service images and loopback ports`)
  docker(['start', name('db')])
  await ready(() => spawnSync('docker', [...dockerArgs, 'exec', name('db'), 'pg_isready', '-h', '127.0.0.1', '-U', 'tectona_sandbox'],
    { windowsHide: true, stdio: 'ignore' }).status === 0, 'Sandbox PostgreSQL')
  for (const [, database] of Object.values(services)) {
    const existing = docker(['exec', name('db'), 'psql', '-U', 'tectona_sandbox', '-d', 'postgres', '-Atc',
      `SELECT 1 FROM pg_database WHERE datname = '${database}'`])
    if (!existing) docker(['exec', name('db'), 'createdb', '-U', 'tectona_sandbox', database])
  }
  const identityEnv = envFor('identity')
  const identitySeed = runSeed('identity', ['run', '--rm', '-i', '--network', network,
    '--mount', `type=bind,source=${dir},target=/sandbox,readonly`, ...envArgs(identityEnv),
    images.identity, 'python', '-B', '/sandbox/seed.py', 'identity'], { master }, identityEnv)
  const directorySeed = (async () => {
    for (const service of ['org', 'wac']) docker(['start', name(service)])
    docker(['start', name('relay')])
    for (const service of ['org', 'wac']) await ready(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${hostPort(service)}/health`, { signal: AbortSignal.timeout(1500) })).ok
      } catch { return false }
    }, service)
    const org = await runSeed('org', ['exec', '-i', name('org'), 'python', '-B', '/sandbox/seed.py', 'org'], {})
    const { workspaces, retired, organizations, subsidiaries } = JSON.parse(org)
    console.log(`${scenario}: verified ${organizations} organizations, ${subsidiaries} subsidiaries and ${Object.keys(workspaces).length} workspaces`)
    await runSeed('wac', ['exec', '-i', name('wac'), 'python', '-B', '/sandbox/seed.py', 'wac'], { workspaces, retired })
  })()
  const results = await Promise.allSettled([identitySeed, directorySeed])
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length) throw new Error(failures.map((result) => result.reason.message).join(' / '))
  docker(['start', name('identity')])
  await ready(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${hostPort('identity')}/health`, { signal: AbortSignal.timeout(1500) })).ok
    } catch { return false }
  }, 'Ilex Identity Lite')
  console.log(`${scenario}: seed verified. Tectona frontend origin ${origin}`)
}

async function verify() {
  verifyTopology()
  const appId = '00000000-0000-0000-0000-000000000014'
  const api = (base, service, endpoint, options) =>
    fetch(`http://127.0.0.1:${base}${endpoint.startsWith('/oauth2/') ? '' : '/api/' + service}${endpoint}`, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(10000),
    })
  const post = (body) => ({ method: 'POST', body: new URLSearchParams(body) })
  const appPath = `/v1/apps/${appId}`
  const membersPath = (id) => `${appPath}/workspaces/${id}/members`
  const denied = (response) => [401, 403].includes(response.status)
  const roles = ['admin', 'editor', 'member', 'viewer']
  for (const role of roles) {
    const home = dataset.memberships.find((entry) =>
      entry.role === role && dataset.employees.some((person) =>
        person.id === entry.employeeId && person.homeWorkspaceId === entry.workspaceId,
      ),
    )
    assert(home, `No seeded home membership for role ${role}`)
    const employee = dataset.employees.find((person) => person.id === home.employeeId)
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const redirectUri = origin + '/login/oauth/callback'
    const authorize = {
      response_type: 'code', client_id: 'tectona-spa', redirect_uri: redirectUri,
      code_challenge: challenge, code_challenge_method: 'S256', email: employee.email,
      password: 'Aa1!' + derive('account:' + employee.id),
    }
    const signed = await api(hostPort('identity'), 'identity-lite', '/oauth2/authorize', post(authorize))
    assert(signed.ok, `Ilex authorization failed (HTTP ${signed.status})`)
    const { code } = await signed.json()
    const exchanged = await api(hostPort('identity'), 'identity-lite', '/oauth2/token', post({
      grant_type: 'authorization_code', client_id: 'tectona-spa',
      code, redirect_uri: redirectUri, code_verifier: verifier, session_policy: 'concurrent',
    }))
    assert(exchanged.ok, `Ilex token exchange failed (HTTP ${exchanged.status})`)
    const { access_token: token } = await exchanged.json()
    const headers = { Authorization: `Bearer ${token}` }
    const user = await api(hostPort('identity'), 'identity-lite', '/oauth2/userinfo', { headers })
    assert(user.ok, `Ilex userinfo failed (HTTP ${user.status})`)
    const profile = await user.json()
    assert(profile.email === employee.email, 'Signed-in Ilex subject does not match the account')
    const membershipsPath = `${appPath}/subjects/${profile.sub}/memberships`
    const memberships = await api(hostPort('wac'), 'workspace-access-control', membershipsPath, { headers })
    assert(memberships.ok, `WAC rejected the local token (HTTP ${memberships.status})`)
    const roleRows = (await memberships.json()).items
    const directory = await api(hostPort('org'), 'workspace-org', '/v1/workspaces?page=1&page_size=100&include_archived=true', { headers })
    assert(directory.ok, `Workspace Org rejected the local token (HTTP ${directory.status})`)
    const workspaces = new Map((await directory.json()).items.map((row) => [row.external_workspace_ref, row.id]))
    const ownId = workspaces.get(employee.homeWorkspaceId)
    const expected = dataset.memberships.filter((entry) => entry.employeeId === employee.id)
    assert(ownId && expected.every((entry) => workspaces.has(entry.workspaceId)), 'Seeded workspaces missing from directory')
    assert(JSON.stringify(roleRows.map((row) => [row.workspace_id, row.role_code]).sort()) ===
      JSON.stringify(expected.map((entry) => [workspaces.get(entry.workspaceId), entry.role]).sort()),
    `${role}: authenticated memberships differ from the seed`)

    const ownMembers = await api(hostPort('wac'), 'workspace-access-control', membersPath(ownId), { headers })
    assert(ownMembers.ok && (await ownMembers.json()).items.some((row) => row.subject_id === profile.sub && row.role_code === role),
      `${role}: allowed workspace roster unavailable or missing the account`)
    const unauthorized = dataset.workspaces.find((workspace) => !workspace.parentId &&
      !expected.some((entry) => entry.workspaceId === workspace.id))
    const retiredId = before?.workspaces.find((workspace) => !dataset.workspaces.some((active) => active.id === workspace.id))?.id
    const negativeId = workspaces.get(unauthorized?.id ?? retiredId) ?? '00000000-0000-0000-0000-000000000001'
    const unrelatedMembers = await api(hostPort('wac'), 'workspace-access-control', membersPath(negativeId), { headers })
    assert(unrelatedMembers.status === 403, `${role}: unrelated roster should return 403, got ${unrelatedMembers.status}`)

    if (role === 'admin') {
      const anonymousMembers = await api(hostPort('wac'), 'workspace-access-control', membersPath(ownId))
      const anonymousIdentity = await api(hostPort('identity'), 'identity-lite', '/oauth2/userinfo')
      assert(denied(anonymousMembers) && denied(anonymousIdentity), 'Anonymous protected API read did not fail closed')
    }

    for (const [otherIndex, other] of demoScenarios.entries()) {
      if (other === scenario) continue
      const badLogin = await api(19611 + otherIndex * 10, 'identity-lite', '/oauth2/authorize', post({
        ...authorize, redirect_uri: `http://${other}.localhost:${9561 + otherIndex}/login/oauth/callback`,
      }))
      assert(badLogin.status === 401, `Foreign Ilex login did not fail closed (HTTP ${badLogin.status})`)
      const badToken = await api(19613 + otherIndex * 10, 'workspace-access-control', membershipsPath, { headers })
      assert(denied(badToken), `Foreign WAC token did not fail closed (HTTP ${badToken.status})`)
      const badIdentity = await api(19611 + otherIndex * 10, 'identity-lite', '/oauth2/userinfo', { headers })
      assert(denied(badIdentity), `Foreign Ilex token did not fail closed (HTTP ${badIdentity.status})`)
    }
  }
  console.log(`${scenario}: Admin, Manager, Member and Viewer PKCE login, allowed/denied WAC roster, anonymous API and cross-sandbox checks passed`)
}

function consolidationBackup() {
  assert(before, 'This scenario has no consolidation backup')
  verifyTopology()
  const base = resolve(process.env.LOCALAPPDATA, 'Tectona/WorkspaceSandbox/Backups')
  const manifest = resolve(base, scenario === 'startup' ? 'startup-before-single-workspace.json' : 'smb-before-three-workspaces.json')
  const db = name('db')
  const query = (database, sql) => docker(['exec', db, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'tectona_sandbox', '-d', database, '-Atc', sql])
  const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
  if (existsSync(manifest)) {
    const backup = JSON.parse(readFileSync(manifest, 'utf8'))
    assert(backup.ownership === ownership && backup.archives.length === 2, 'Backup does not belong to this sandbox')
    for (const archive of backup.archives) {
      assert(digest(resolve(base, archive.file)) === archive.digest, 'Sandbox backup integrity check failed')
    }
    return manifest
  }

  const orgState = query('workspace_org_sandbox', `SELECT string_agg(w.workspace_key || ':' || s.code, ',' ORDER BY w.workspace_key)
    FROM workspace_org_workspaces w JOIN workspace_org_lookup_workspace_status s ON s.id=w.status_id`)
  const membershipCount = query('wac_sandbox', `SELECT count(*) FROM wac_memberships m JOIN wac_lookup_membership_status s
    ON s.id=m.wac_lookup_membership_status_id WHERE m.deleted_at IS NULL AND s.code='active'`)
  const originalWorkspaces = before.workspaces.map((workspace) => workspace.id.split(':').at(-1) + ':active').sort().join(',')
  assert(orgState === originalWorkspaces && Number(membershipCount) === before.memberships.length, 'Unexpected sandbox state before backup')

  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 17)
  mkdirSync(base, { recursive: true })
  const archives = []
  for (const [database, table] of [['workspace_org_sandbox', 'workspace_org_workspaces'], ['wac_sandbox', 'wac_memberships']]) {
    const file = `${scenario}-${stamp}-${database}.dump`
    const scratch = `restore_${database}_${stamp}`
    const local = resolve(base, file)
    const dump = '/tmp/' + file
    const restoreDump = dump + '.restore'
    const fingerprint = `SELECT count(*), md5(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY t.id)) FROM ${table} t`
    const before = query(database, fingerprint)
    docker(['exec', db, 'pg_dump', '-U', 'tectona_sandbox', '-Fc', '-f', dump, database])
    docker(['cp', `${db}:${dump}`, local])
    docker(['cp', local, `${db}:${restoreDump}`])
    docker(['exec', db, 'createdb', '-U', 'tectona_sandbox', scratch])
    docker(['exec', db, 'pg_restore', '--exit-on-error', '-U', 'tectona_sandbox', '-d', scratch, restoreDump])
    assert(query(scratch, fingerprint) === before && query(database, fingerprint) === before, `Restore comparison failed for ${database}`)
    archives.push({ database, file, scratch, digest: digest(local) })
    console.log(`${scenario}: backup restored to ${scratch} and matched source rows`)
  }
  writeFileSync(manifest, JSON.stringify({ ownership, archives }, null, 2), { flag: 'wx' })
  return manifest
}

async function consolidate() {
  const backup = consolidationBackup()
  console.log('Verified recovery manifest: ' + backup)
  const run = (service, payload) =>
    runSeed(service, ['exec', '-i', name(service), 'python', '-B', '/sandbox/seed.py', service], payload)
  const plan = JSON.parse(await run('org', { phase: 'consolidation-plan' }))
  await run('wac', { phase: 'consolidation-members', ...plan })
  await run('org', { phase: 'consolidation-archive' })
  await start()
}

if (action === 'credential' || action === 'email') {
  const person = /^\d+$/.test(employeeSelector ?? '')
    ? dataset.employees[Number(employeeSelector) - 1]
    : dataset.employees.find((record) => record.email === employeeSelector?.trim().toLowerCase())
  assert(person, 'Unknown sandbox employee number or email')
  process.stdout.write(action === 'credential' ? 'Aa1!' + derive('account:' + person.id) : person.email)
} else if (action === 'start') {
  await start()
} else if (action === 'verify') {
  await verify()
} else if (action === 'backup-workspaces') {
  console.log('Verified recovery manifest: ' + consolidationBackup())
} else if (action === 'consolidate-workspaces') {
  await consolidate()
} else if (action === 'status') {
  verifyTopology()
  for (const service of ['db', ...Object.keys(services), 'relay']) {
    console.log(`${scenario} ${service}: ${inspect('container', name(service)).State.Status}`)
  }
} else if (action === 'stop') {
  verifyTopology()
  docker(['stop', ...['relay', 'identity', 'wac', 'org', 'db'].map(name)])
  console.log(`${scenario}: sandbox stopped; database preserved`)
} else {
  throw new Error('Unsupported sandbox action')
}
