/**
 * src/lib/huawei-adapter.js
 * Huawei OLT SSH adapter for GPON ONU provisioning.
 *
 * Uses ssh2 for interactive shell access to Huawei MA5800/MA5600 series OLTs.
 * Falls back to mock mode when:
 *   - ssh2 module is not installed
 *   - olt.ip === 'mock'
 *
 * A per-OLT mutex prevents concurrent SSH sessions to the same device.
 */

// ssh2 is loaded lazily inside connect() to avoid bundler issues.
// Do NOT import it at module level — Next.js bundler will fail.

// Per-OLT IP mutex: Map<ip, Promise<void>>
const oltMutex = new Map()

/**
 * Acquires an exclusive lock for a given OLT IP.
 * Returns a release function to call when done.
 *
 * @param {string} ip
 * @returns {Promise<() => void>}
 */
async function acquireLock(ip) {
  const prev = oltMutex.get(ip) ?? Promise.resolve()
  let release
  const next = new Promise((res) => { release = res })
  oltMutex.set(ip, prev.then(() => next))
  await prev
  return release
}

/**
 * Huawei OLT SSH adapter.
 * Manages a single interactive SSH shell session per instance.
 */
export class HuaweiOltAdapter {
  /**
   * @param {{ ip: string, ssh_user: string, ssh_pass: string, ssh_port?: number, vendor?: string }} olt
   */
  constructor(olt) {
    this.olt      = olt
    this.client   = null
    this.stream   = null
    this.isMock   = olt.ip === 'mock'
    this.vendor   = olt.vendor ?? 'huawei'
    this._release = null
  }

  /**
   * Opens an SSH interactive shell.
   * Acquires the per-OLT mutex to prevent concurrent sessions.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isMock) return

    this._release = await acquireLock(this.olt.ip)

    // Lazy dynamic import — keeps ssh2 out of the webpack bundle.
    let Client
    try {
      const ssh2 = await import('ssh2')
      Client = ssh2.Client
    } catch {
      if (this._release) { this._release(); this._release = null }
      throw new Error('Módulo ssh2 não instalado. Execute: npm install ssh2')
    }

    await new Promise((resolve, reject) => {
      this.client = new Client()

      this.client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        // Respond to each prompt (typically "Password:") with the configured password
        finish(prompts.map(() => this.olt.ssh_pass ?? ''))
      })

      this.client.on('ready', () => {
        this.client.shell((err, stream) => {
          if (err) return reject(err)
          this.stream = stream
          this._buffer = ''
          stream.on('data', (chunk) => {
            this._buffer += chunk.toString()
          })

          // After initial banner loads, check for simulator OLT selection menu
          // and auto-select OLT 1 so the adapter behaves like a direct real OLT connection.
          setTimeout(() => {
            if (this._buffer.includes('Enter OLT number')) {
              // Simulator menu detected — select the first OLT automatically
              stream.write('1\n')
              this._buffer = ''
              setTimeout(resolve, 1500)
            } else {
              resolve()
            }
          }, 1500)
        })
      })

      this.client.on('error', reject)

      this.client.connect({
        host:            this.olt.ip,
        port:            this.olt.ssh_port ?? 22,
        username:        this.olt.ssh_user,
        password:        this.olt.ssh_pass,
        tryKeyboard:     true,   // required for simulators using keyboard-interactive auth
        readyTimeout:    8_000,
        algorithms: {
          serverHostKey: ['ssh-ed25519', 'ecdsa-sha2-nistp256', 'ssh-rsa'],
        },
      })
    })
  }

  /**
   * Closes the SSH connection and releases the mutex lock.
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.isMock) return
    try {
      if (this.stream) this.stream.end()
      if (this.client) this.client.end()
    } catch {
      // Ignore cleanup errors
    } finally {
      this.stream = null
      this.client = null
      if (this._release) {
        this._release()
        this._release = null
      }
    }
  }

  /**
   * Sends a command over the interactive shell and waits for output.
   *
   * @param {string} cmd - Command string (no newline needed)
   * @param {number} waitMs - Milliseconds to wait for device response
   * @returns {Promise<string>} Accumulated output since last call
   */
  async sendCmd(cmd, waitMs = 1000) {
    if (this.isMock) return ''
    if (!this.stream) throw new Error('SSH stream not connected')

    this._buffer = ''
    this.stream.write(`${cmd}\n`)

    await new Promise((res) => setTimeout(res, waitMs))

    return this._buffer
  }

  /**
   * Tests the SSH connectivity to the OLT by opening a session, sending
   * `display version`, and immediately disconnecting.
   *
   * Never throws — always returns a result object.
   *
   * @returns {Promise<{ ok: boolean, ms: number, message: string }>}
   */
  async testConnection() {
    if (this.isMock) {
      return { ok: true, ms: 1, message: 'Mock OLT (simulado)' }
    }

    const t0 = Date.now()
    const timeout = 15_000

    try {
      await Promise.race([
        (async () => {
          await this.connect()
          await this.sendCmd('display version', 1000)
          await this.disconnect()
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout após 15s')), timeout)
        ),
      ])

      return { ok: true, ms: Date.now() - t0, message: 'Conexão SSH estabelecida com sucesso' }
    } catch (err) {
      try { await this.disconnect() } catch {}
      return { ok: false, ms: Date.now() - t0, message: err.message ?? 'Falha na conexão SSH' }
    }
  }

  /**
   * Provisions an ONU on the specified GPON port.
   *
   * @param {{ slot: number, port: number, onuId: number, serial: string, cliente: string, vlan: number }} params
   * @returns {Promise<{ success: boolean, mock?: boolean }>}
   */
  async provisionOnu({ slot, port, onuId, serial, cliente, vlan = 100 }) {
    if (this.isMock) {
      console.log(`[HuaweiAdapter][MOCK] provisionOnu serial=${serial} slot=${slot}/${port} id=${onuId}`)
      return { success: true, mock: true }
    }

    try {
      await this.sendCmd('enable',       500)
      await this.sendCmd('config',       500)
      await this.sendCmd(`interface gpon 0/${slot}`, 500)
      await this.sendCmd(
        `ont add ${port} ${onuId} sn-auth ${serial} omci ont-lineprofile-id 1 ont-srvprofile-id 1 desc "${cliente}"`,
        2000
      )
      await this.sendCmd('quit', 500)
      await this.sendCmd(
        `service-port vlan ${vlan} gpon 0/${slot}/${port} ont ${onuId} gemport 1 multi-service user-vlan ${vlan}`,
        2000
      )
      await this.sendCmd('quit', 500)
      await this.sendCmd('save', 3000)
      return { success: true }
    } catch (err) {
      console.error('[HuaweiAdapter] provisionOnu error:', err.message)
      return { success: false, error: err.message }
    }
  }

  /**
   * Removes an ONU from the OLT.
   *
   * @param {{ slot: number, port: number, onuId: number, servicePortId: number }} params
   * @returns {Promise<{ success: boolean, mock?: boolean }>}
   */
  async deleteOnu({ slot, port, onuId, servicePortId }) {
    if (this.isMock) {
      console.log(`[HuaweiAdapter][MOCK] deleteOnu slot=${slot}/${port} id=${onuId}`)
      return { success: true, mock: true }
    }

    try {
      await this.sendCmd('enable', 500)
      await this.sendCmd('config',  500)

      // Remove service port first
      if (servicePortId != null) {
        await this.sendCmd(`undo service-port ${servicePortId}`, 2000)
      }

      await this.sendCmd(`interface gpon 0/${slot}`, 500)
      await this.sendCmd(`ont delete ${port} ${onuId}`, 2000)
      await this.sendCmd('quit',  500)
      await this.sendCmd('save',  3000)

      return { success: true }
    } catch (err) {
      console.error('[HuaweiAdapter] deleteOnu error:', err.message)
      return { success: false, error: err.message }
    }
  }

  /**
   * Reads optical power readings for an ONU.
   *
   * @param {number} slot
   * @param {number} port
   * @param {number} onuId
   * @returns {Promise<{ rx: number, tx: number, status: string, mock?: boolean }>}
   */
  async getOnuStatus(slot, port, onuId) {
    if (this.isMock) {
      return { rx: -18.5, tx: 2.3, status: 'online', mock: true }
    }

    try {
      const output = await this.sendCmd(
        `display ont optical-info ${slot} ${port} ${onuId}`,
        2000
      )

      // Parse output: Rx: -18.50 dBm, Tx: 2.30 dBm
      const rxMatch = output.match(/Rx.*?(-?\d+\.\d+)\s*dBm/i)
      const txMatch = output.match(/Tx.*?(-?\d+\.\d+)\s*dBm/i)
      const statusMatch = output.match(/Run state\s*:\s*(\S+)/i)

      return {
        rx:     rxMatch     ? parseFloat(rxMatch[1])     : null,
        tx:     txMatch     ? parseFloat(txMatch[1])     : null,
        status: statusMatch ? statusMatch[1].toLowerCase() : 'unknown',
      }
    } catch (err) {
      console.error('[HuaweiAdapter] getOnuStatus error:', err.message)
      return { rx: null, tx: null, status: 'error', error: err.message }
    }
  }

  /**
   * Runs `display ont autofind all` and returns a list of ONUs that have
   * been auto-discovered by the OLT but not yet provisioned.
   *
   * Huawei MA5800/MA5600 output format (two common variants):
   *   F/S/P   ONT-ID  SN           Password  VendorID  OntType
   *   0/ 1/ 0 0       HWTCE1234567 -         HWTC      HG8245H
   *
   * @returns {Promise<Array<{ serial: string, pon: string, pon_port: number, mock?: boolean }>>}
   */
  async getUnconfiguredOnus() {
    if (this.isMock) return []

    try {
      await this.sendCmd('enable', 500)
      const output = await this.sendCmd('display ont autofind all', 3000)

      return _parseAutoFind(output)
    } catch (err) {
      console.error('[HuaweiAdapter] getUnconfiguredOnus error:', err.message)
      return []
    }
  }

  /**
   * Returns basic OLT hardware and software information.
   * Real: runs `display version` and parses Version and Uptime fields.
   *
   * @returns {Promise<{ modelo: string, versao: string, uptime: string, slots: number, mock?: boolean }>}
   */
  async getOltInfo() {
    if (this.isMock) {
      return {
        modelo:  'Huawei MA5800-X7',
        versao:  'V800R021C10',
        uptime:  '15d 4h 32m',
        slots:   8,
        mock:    true,
      }
    }

    try {
      const output = await this.sendCmd('display version', 1500)

      const versaoMatch = output.match(/Version\s*[:\s]+(\S+)/i)
      const uptimeMatch = output.match(/Uptime\s*[:\s]+(.+)/i)

      return {
        modelo:  this.olt.ip,
        versao:  versaoMatch ? versaoMatch[1] : 'unknown',
        uptime:  uptimeMatch ? uptimeMatch[1].trim() : 'unknown',
        slots:   8,
      }
    } catch (err) {
      console.error('[HuaweiAdapter] getOltInfo error:', err.message)
      return { modelo: 'unknown', versao: 'unknown', uptime: 'unknown', slots: 0, error: err.message }
    }
  }

  /**
   * Returns the list of GPON PON ports and their current state.
   * Real: runs `display port state all` and parses slot/port/status from each line.
   *
   * @returns {Promise<Array<{ slot: number, port: number, pon: string, onus: number, capacidade: number, status: string }>>}
   */
  async getPonPorts() {
    if (this.isMock) {
      return [
        { slot: 0, port: 0, pon: '0/0/0', onus: 12, capacidade: 128, status: 'online'  },
        { slot: 0, port: 1, pon: '0/0/1', onus: 8,  capacidade: 128, status: 'online'  },
        { slot: 0, port: 2, pon: '0/0/2', onus: 3,  capacidade: 128, status: 'online'  },
        { slot: 0, port: 3, pon: '0/0/3', onus: 0,  capacidade: 128, status: 'offline' },
      ]
    }

    try {
      const output = await this.sendCmd('display port state all', 2000)
      const results = []

      for (const line of output.split('\n')) {
        // Match lines containing port references like "0/0/0" or "0/ 0/ 0"
        const m = line.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/)
        if (!m) continue

        const slot   = parseInt(m[1], 10)
        const port   = parseInt(m[3], 10)
        const pon    = `${m[1]}/${m[2]}/${m[3]}`
        const online = /online|up/i.test(line)

        results.push({
          slot,
          port,
          pon,
          onus:       0,
          capacidade: 128,
          status:     online ? 'online' : 'offline',
        })
      }

      return results
    } catch (err) {
      console.error('[HuaweiAdapter] getPonPorts error:', err.message)
      return []
    }
  }

  /**
   * Returns all ONUs provisioned on a given GPON port.
   * Dispatches to ZTE or Huawei implementation based on this.vendor.
   *
   * @param {number} slot
   * @param {number} port
   * @returns {Promise<Array<{ onuId: number, serial: string, cliente: string, status: string, rx: number|null, tx: number|null }>>}
   */
  async getOnus(slot, port) {
    if (this.isMock) return []

    if (this.vendor === 'zte') return this.getZTEOnus(slot, port)

    try {
      const output = await this.sendCmd(`display ont info ${slot} ${port} all`, 2000)
      const results = []

      for (const line of output.split('\n')) {
        // Pattern: leading whitespace, ONT-ID, serial, run-state
        const m = line.match(/\s*(\d+)\s+(\S+)\s+(\w+)/)
        if (!m) continue

        const onuId  = parseInt(m[1], 10)
        const serial = m[2].toUpperCase()
        const status = m[3].toLowerCase()

        // Only include lines that look like valid ONU entries (serial >= 8 chars)
        if (serial.length < 8) continue

        results.push({ onuId, serial, cliente: '', status, rx: null, tx: null })
      }

      return results
    } catch (err) {
      console.error('[HuaweiAdapter] getOnus error:', err.message)
      return []
    }
  }

  /**
   * ZTE: Returns all ONUs on a given GPON port.
   * Runs `show gpon onu state gpon_onu-<slot>/<port>` and parses the tabular output.
   *
   * Expected ZTE output columns: ONU-ID  SN  Admin-State  Oper-State  Rx-Power  Tx-Power
   *
   * @param {number} slot
   * @param {number} port
   * @returns {Promise<Array<{ onuId: number, serial: string, status: string, rx: number|null, tx: number|null }>>}
   */
  async getZTEOnus(slot, port) {
    try {
      const output = await this.sendCmd(`show gpon onu state gpon_onu-${slot}/${port}`, 2000)
      const results = []

      for (const line of output.split('\n')) {
        // ZTE format: "  1   ZTEG1234ABCD  enable  online  -18.50  2.30"
        const m = line.match(/^\s*(\d+)\s+([A-Z0-9]{8,16})\s+\S+\s+(\S+)\s+(-?\d+\.\d+|-+)\s+(-?\d+\.\d+|-+)/i)
        if (!m) continue

        const onuId  = parseInt(m[1], 10)
        const serial = m[2].toUpperCase()
        const status = m[3].toLowerCase()
        const rx     = m[4] === '----' || m[4] === '-' ? null : parseFloat(m[4])
        const tx     = m[5] === '----' || m[5] === '-' ? null : parseFloat(m[5])

        results.push({ onuId, serial, status, rx, tx })
      }

      return results
    } catch (err) {
      console.error('[HuaweiAdapter][ZTE] getZTEOnus error:', err.message)
      return []
    }
  }

  /**
   * ZTE: Returns detailed info for a single ONU.
   * Runs `show gpon onu detail-info gpon_onu-<slot>/<port>:<onuId>`.
   *
   * @param {number} slot
   * @param {number} port
   * @param {number} onuId
   * @returns {Promise<{ onuId: number, serial: string, status: string, rx: number|null, tx: number|null, mac: string|null, distance: string|null }>}
   */
  async getZTEOnuDetail(slot, port, onuId) {
    try {
      const output = await this.sendCmd(
        `show gpon onu detail-info gpon_onu-${slot}/${port}:${onuId}`,
        2000
      )

      const serialMatch   = output.match(/SN\s*[:\s]+([A-Z0-9]{8,16})/i)
      const statusMatch   = output.match(/Oper[- ]?[Ss]tate\s*[:\s]+(\S+)/i)
      const rxMatch       = output.match(/Rx\s+[Pp]ower\s*[:\s]+(-?\d+\.\d+)/i)
      const txMatch       = output.match(/Tx\s+[Pp]ower\s*[:\s]+(-?\d+\.\d+)/i)
      const macMatch      = output.match(/MAC\s*[:\s]+([\da-fA-F:]{17})/i)
      const distanceMatch = output.match(/Distance\s*[:\s]+([\d.]+\s*(?:km|m))/i)

      return {
        onuId,
        serial:   serialMatch   ? serialMatch[1].toUpperCase()   : 'unknown',
        status:   statusMatch   ? statusMatch[1].toLowerCase()   : 'unknown',
        rx:       rxMatch       ? parseFloat(rxMatch[1])         : null,
        tx:       txMatch       ? parseFloat(txMatch[1])         : null,
        mac:      macMatch      ? macMatch[1].toUpperCase()      : null,
        distance: distanceMatch ? distanceMatch[1].trim()        : null,
      }
    } catch (err) {
      console.error('[HuaweiAdapter][ZTE] getZTEOnuDetail error:', err.message)
      return { onuId, serial: 'unknown', status: 'error', rx: null, tx: null, mac: null, distance: null, error: err.message }
    }
  }

  /**
   * Returns full detail for a single ONU, including optical power readings.
   * Real: runs `display ont info` and `display ont optical-info`, then merges both outputs.
   *
   * @param {number} slot
   * @param {number} port
   * @param {number} onuId
   * @returns {Promise<{ onuId: number, serial: string, cliente: string, status: string, rx: number|null, tx: number|null, pon: string, mac: string, distancia: string, mock?: boolean }>}
   */
  async getOnuDetail(slot, port, onuId) {
    if (this.isMock) {
      return {
        onuId,
        serial:    'HWTCE1234567A',
        cliente:   'Mock Cliente',
        status:    'online',
        rx:        -18.5,
        tx:        2.3,
        pon:       `${slot}/${port}`,
        mac:       'AA:BB:CC:DD:EE:FF',
        distancia: '1.2km',
        mock:      true,
      }
    }

    try {
      const [infoOut, optOut] = await Promise.all([
        this.sendCmd(`display ont info ${slot} ${port} ${onuId}`, 2000),
        this.sendCmd(`display ont optical-info ${slot} ${port} ${onuId}`, 2000),
      ])

      const serialMatch   = infoOut.match(/SN\s*[:\s]+([A-Z0-9]{8,16})/i)
      const statusMatch   = infoOut.match(/Run state\s*[:\s]+(\S+)/i)
      const macMatch      = infoOut.match(/MAC\s*[:\s]+([\da-fA-F:]{17})/i)
      const distMatch     = infoOut.match(/Distance\s*[:\s]+([\d.]+\s*(?:km|m))/i)
      const rxMatch       = optOut.match(/Rx.*?(-?\d+\.\d+)\s*dBm/i)
      const txMatch       = optOut.match(/Tx.*?(-?\d+\.\d+)\s*dBm/i)

      return {
        onuId,
        serial:    serialMatch   ? serialMatch[1].toUpperCase()    : 'unknown',
        cliente:   '',
        status:    statusMatch   ? statusMatch[1].toLowerCase()     : 'unknown',
        rx:        rxMatch       ? parseFloat(rxMatch[1])           : null,
        tx:        txMatch       ? parseFloat(txMatch[1])           : null,
        pon:       `${slot}/${port}`,
        mac:       macMatch      ? macMatch[1].toUpperCase()        : null,
        distancia: distMatch     ? distMatch[1].trim()              : null,
      }
    } catch (err) {
      console.error('[HuaweiAdapter] getOnuDetail error:', err.message)
      return { onuId, serial: 'unknown', cliente: '', status: 'error', rx: null, tx: null, pon: `${slot}/${port}`, mac: null, distancia: null, error: err.message }
    }
  }

  /**
   * Fetches the run-state and last-down cause for a single ONU.
   * Real: runs `display ont info <slot> <port> <onuId>`.
   *
   * @param {number} slot
   * @param {number} port
   * @param {number} onuId
   * @returns {Promise<{ status: string, last_down_cause: string|null, uptime: string|null, mock?: boolean }>}
   */
  async getOnuRunStatus(slot, port, onuId) {
    if (this.isMock) {
      return { status: 'online', last_down_cause: null, uptime: '5d 3h 14m', mock: true }
    }

    try {
      const output = await this.sendCmd(
        `display ont info ${slot} ${port} ${onuId}`,
        2000
      )

      const statusMatch    = output.match(/Run state\s*[:\s]+(\S+)/i)
      const downMatch      = output.match(/Last down cause\s*[:\s]+(.+)/i)
      const uptimeMatch    = output.match(/ONT distance\s*[:\s]+(.+)/i)

      return {
        status:          statusMatch ? statusMatch[1].toLowerCase() : 'unknown',
        last_down_cause: downMatch   ? downMatch[1].trim()          : null,
        uptime:          uptimeMatch ? uptimeMatch[1].trim()         : null,
      }
    } catch (err) {
      console.error('[HuaweiAdapter] getOnuRunStatus error:', err.message)
      return { status: 'error', last_down_cause: null, uptime: null, error: err.message }
    }
  }

  /**
   * Reads optical power (RX/TX) for a single ONU.
   * Real: runs `display ont optical-info <slot>/<port> <onuId>`.
   *
   * @param {number} slot
   * @param {number} port
   * @param {number} onuId
   * @returns {Promise<{ rx: number|null, tx: number|null, mock?: boolean }>}
   */
  async getOpticalInfo(slot, port, onuId) {
    if (this.isMock) {
      return { rx: -18.5, tx: 2.3, mock: true }
    }

    try {
      const output = await this.sendCmd(
        `display ont optical-info ${slot}/${port} ${onuId}`,
        2000
      )

      const rxMatch = output.match(/Rx.*?(-?\d+\.\d+)\s*dBm/i)
      const txMatch = output.match(/Tx.*?(-?\d+\.\d+)\s*dBm/i)

      return {
        rx: rxMatch ? parseFloat(rxMatch[1]) : null,
        tx: txMatch ? parseFloat(txMatch[1]) : null,
      }
    } catch (err) {
      console.error('[HuaweiAdapter] getOpticalInfo error:', err.message)
      return { rx: null, tx: null, error: err.message }
    }
  }

  /**
   * Returns the state of a GPON PON port and how many ONUs are connected.
   * Real: runs `display gpon port state <slot>/<port>`.
   *
   * @param {number} slot
   * @param {number} port
   * @returns {Promise<{ state: string, onu_count: number, mock?: boolean }>}
   */
  async getPonStatus(slot, port) {
    if (this.isMock) {
      return { state: 'online', onu_count: 8, mock: true }
    }

    try {
      const output = await this.sendCmd(
        `display gpon port state ${slot}/${port}`,
        2000
      )

      const stateMatch = output.match(/Port state\s*[:\s]+(\S+)/i)
      const countMatch = output.match(/ONT number\s*[:\s]+(\d+)/i)

      return {
        state:     stateMatch ? stateMatch[1].toLowerCase() : 'unknown',
        onu_count: countMatch ? parseInt(countMatch[1], 10) : 0,
      }
    } catch (err) {
      console.error('[HuaweiAdapter] getPonStatus error:', err.message)
      return { state: 'error', onu_count: 0, error: err.message }
    }
  }

  /**
   * Sends a reset command to an ONU.
   * Real: enters enable → config → interface gpon → ont reset → quit.
   *
   * @param {number} slot
   * @param {number} port
   * @param {number} onuId
   * @returns {Promise<{ success: boolean, mock?: boolean }>}
   */
  async rebootOnu(slot, port, onuId) {
    if (this.isMock) {
      console.log(`[HuaweiAdapter][MOCK] rebootOnu slot=${slot}/${port} id=${onuId}`)
      return { success: true, mock: true }
    }

    try {
      await this.sendCmd('enable',                    500)
      await this.sendCmd('config',                    500)
      await this.sendCmd(`interface gpon 0/${slot}`,  500)
      await this.sendCmd(`ont reset ${port} ${onuId}`, 3000)
      await this.sendCmd('quit',                      500)
      return { success: true }
    } catch (err) {
      console.error('[HuaweiAdapter] rebootOnu error:', err.message)
      return { success: false, error: err.message }
    }
  }
}

// ─── Failure analysis ─────────────────────────────────────────────────────────

/**
 * Analyses raw OLT data and returns a structured diagnostic result.
 *
 * Rules:
 *   1. OFFLINE + no RX          → ONU desligada / sem energia
 *   2. OFFLINE + RX < -30       → Fibra rompida / desconectada
 *   3. OFFLINE (other)          → ONU offline — verificar cliente
 *   4. RX between -28 and -25   → Alta atenuação
 *   5. RX < -28 (online)        → Sinal crítico
 *   6. TX > 5 dBm               → Saturação / problema de transmissão
 *   7. Online + RX ok           → Funcionamento normal
 *
 * @param {{ status: string, rx: number|null, tx: number|null, last_down_cause?: string }} data
 * @returns {{ status, problema, rx, tx, rx_raw, tx_raw, recomendacao, nivel, last_down_cause }}
 */
export function analyzeFailure({ status, rx, tx, last_down_cause }) {
  const isOffline = status !== 'online'
  let problema, recomendacao, nivel

  if (isOffline) {
    if (rx == null) {
      problema     = 'ONU desligada ou sem energia'
      recomendacao = 'Verificar fonte de energia do cliente (tomada, nobreak, adaptador)'
      nivel        = 'critico'
    } else if (rx < -30) {
      problema     = 'Possível fibra rompida ou desconectada'
      recomendacao = 'Inspecionar trecho de fibra, fusões e conectores da ONU até a CTO'
      nivel        = 'critico'
    } else {
      problema     = 'ONU offline — causa indeterminada'
      recomendacao = last_down_cause
        ? `Última causa registrada: ${last_down_cause}. Verificar equipamento no cliente.`
        : 'Verificar equipamento no cliente e continuidade da fibra'
      nivel        = 'critico'
    }
  } else if (tx != null && tx > 5) {
    problema     = 'Saturação ou problema de transmissão'
    recomendacao = 'Verificar nível de potência do laser da ONU — possível defeito no transceptor'
    nivel        = 'atencao'
  } else if (rx != null && rx < -28) {
    problema     = 'Sinal crítico — atenuação muito alta'
    recomendacao = 'Inspecionar fusão, conector sujo ou splitter danificado na CTO'
    nivel        = 'critico'
  } else if (rx != null && rx < -25) {
    problema     = 'Alta atenuação — cliente no limite operacional'
    recomendacao = 'Verificar fusão, conector ou atenuação na CTO'
    nivel        = 'atencao'
  } else {
    problema     = 'Funcionamento normal'
    recomendacao = 'Nenhuma ação necessária'
    nivel        = 'ok'
  }

  return {
    status:          status ?? 'unknown',
    problema,
    rx:              rx  != null ? `${rx.toFixed(2)} dBm`  : 'N/D',
    tx:              tx  != null ? `${tx.toFixed(2)} dBm`  : 'N/D',
    rx_raw:          rx,
    tx_raw:          tx,
    recomendacao,
    nivel,
    last_down_cause: last_down_cause ?? null,
  }
}

// ─── Auto-Find parser ─────────────────────────────────────────────────────────

/**
 * Parses Huawei `display ont autofind all` output.
 * Handles the two most common output formats from MA5800/MA5600 series.
 *
 * @param {string} output
 * @returns {Array<{ serial: string, pon: string, pon_port: number }>}
 */
function _parseAutoFind(output) {
  const results = []
  const seen    = new Set()

  const lines = output.split('\n')
  for (const line of lines) {
    // Format A: "0/ 1/ 0   0   HWTCE1234567  ..."
    // Matches: F/S/P followed by ONT-ID and SN
    const matchA = line.match(/^\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s+\d+\s+([A-Z0-9]{8,16})\s/i)
    if (matchA) {
      const frame   = matchA[1]
      const slot    = matchA[2]
      const port    = matchA[3]
      const pon     = `${frame}/${slot}/${port}`
      const board   = `${frame}/${slot}`
      const serial  = matchA[4].toUpperCase()
      if (!seen.has(serial)) {
        seen.add(serial)
        results.push({ serial, pon, pon_port: parseInt(port, 10), board, slot: parseInt(slot, 10) })
      }
      continue
    }

    // Format B: "SN         : HWTCE1234567" + "OntIndex   : 0/ 1/ 0/ 0"
    const snMatch  = line.match(/SN\s*:\s*([A-Z0-9]{8,16})/i)
    if (snMatch) {
      const serial = snMatch[1].toUpperCase()
      if (!seen.has(serial)) {
        seen.add(serial)
        // pon resolved on next matching line; add placeholder
        results.push({ serial, pon: 'unknown', pon_port: null, board: null, slot: null })
      }
    }

    const idxMatch = line.match(/OntIndex\s*:\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*\/\s*\d+/i)
    if (idxMatch && results.length > 0) {
      const last = results[results.length - 1]
      if (last.pon === 'unknown') {
        const frame = idxMatch[1]
        const slot  = idxMatch[2]
        const port  = idxMatch[3]
        last.pon      = `${frame}/${slot}/${port}`
        last.board    = `${frame}/${slot}`
        last.slot     = parseInt(slot, 10)
        last.pon_port = parseInt(port, 10)
      }
    }
  }

  return results.filter(r => r.serial && r.serial.length >= 8)
}
