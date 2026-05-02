/**
 * src/lib/telnet-adapter.js
 *
 * Minimal Telnet adapter for OLT management using Node.js built-in net.Socket.
 * No external dependencies required.
 *
 * Supports Huawei/ZTE CLI prompt patterns (> or # at end of line).
 * Credentials flow: wait for "login:" prompt → send user, wait for "Password:" → send pass.
 */

import net from 'net'

/** Regex matching a CLI prompt: lines ending with > or # (optionally followed by spaces) */
const PROMPT_RE = /[>#]\s*$/m

/** Milliseconds to wait for a prompt during connect before timing out. */
const CONNECT_TIMEOUT_MS = 12_000

/**
 * Telnet adapter for OLTs that expose a CLI over raw TCP (Telnet protocol).
 * Interface mirrors HuaweiOltAdapter for interchangeability.
 */
export class TelnetAdapter {
  /**
   * @param {{ ip: string, ssh_user: string, ssh_pass: string, telnet_port?: number }} opts
   *   ssh_user / ssh_pass are reused for the Telnet login sequence.
   */
  constructor({ ip, ssh_user, ssh_pass, telnet_port = 23 }) {
    this.ip       = ip
    this.user     = ssh_user ?? 'admin'
    this.pass     = ssh_pass ?? ''
    this.port     = telnet_port ?? 23
    this.socket   = null
    this._buffer  = ''
    this.isMock   = ip === 'mock'
  }

  // ─── connect ───────────────────────────────────────────────────────────────

  /**
   * Opens a TCP connection to the OLT and authenticates using the standard
   * login/password prompt sequence.
   *
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isMock) return

    await new Promise((resolve, reject) => {
      const socket = new net.Socket()
      this.socket  = socket
      this._buffer = ''

      let settled = false
      const done = (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (err) {
          socket.destroy()
          this.socket = null
          reject(err)
        } else {
          resolve()
        }
      }

      const timer = setTimeout(
        () => done(new Error(`Telnet connect timeout após ${CONNECT_TIMEOUT_MS}ms`)),
        CONNECT_TIMEOUT_MS
      )

      // Track authentication state
      let authState = 'waitLogin' // waitLogin → waitPass → waitPrompt → done

      socket.on('data', (chunk) => {
        this._buffer += chunk.toString('binary')

        if (authState === 'waitLogin' && /[Uu]sername|[Ll]ogin\s*:/i.test(this._buffer)) {
          authState    = 'waitPass'
          this._buffer = ''
          socket.write(`${this.user}\r\n`)
          return
        }

        if (authState === 'waitPass' && /[Pp]assword\s*:/i.test(this._buffer)) {
          authState    = 'waitPrompt'
          this._buffer = ''
          socket.write(`${this.pass}\r\n`)
          return
        }

        if (authState === 'waitPrompt' && PROMPT_RE.test(this._buffer)) {
          authState    = 'done'
          this._buffer = ''
          done(null)
        }
      })

      socket.on('error', (err) => done(err))
      socket.on('close', () => {
        if (!settled) done(new Error('Conexão Telnet fechada inesperadamente'))
      })

      socket.connect(this.port, this.ip)
    })
  }

  // ─── disconnect ────────────────────────────────────────────────────────────

  /**
   * Closes the Telnet socket gracefully.
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.isMock) return
    try {
      if (this.socket) {
        this.socket.destroy()
        this.socket = null
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  // ─── sendCmd ───────────────────────────────────────────────────────────────

  /**
   * Writes a command to the Telnet stream and accumulates data until a CLI
   * prompt is detected or the timeout elapses.
   *
   * @param {string} cmd        - Command string (no newline needed)
   * @param {number} timeoutMs  - Maximum wait time in ms (default 10 000)
   * @returns {Promise<string>} - Output captured after the command
   */
  async sendCmd(cmd, timeoutMs = 10_000) {
    if (this.isMock) return ''
    if (!this.socket) throw new Error('Telnet socket não está conectado')

    this._buffer = ''

    return new Promise((resolve, reject) => {
      let settled = false
      const done = (err, result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.socket.removeListener('data', onData)
        if (err) reject(err)
        else resolve(result)
      }

      const timer = setTimeout(
        () => done(null, this._buffer),   // on timeout, return what we have
        timeoutMs
      )

      const onData = (chunk) => {
        this._buffer += chunk.toString('binary')
        if (PROMPT_RE.test(this._buffer)) {
          done(null, this._buffer)
        }
      }

      this.socket.on('data', onData)
      this.socket.on('error', (err) => done(err))
      this.socket.write(`${cmd}\r\n`)
    })
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  /**
   * Validates connectivity: connects, sends an empty command, then disconnects.
   * Never throws — always returns a result object.
   *
   * @returns {Promise<{ ok: boolean, ms: number, message: string }>}
   */
  async testConnection() {
    if (this.isMock) {
      return { ok: true, ms: 1, message: 'Mock OLT (simulado)' }
    }

    const t0 = Date.now()
    try {
      await this.connect()
      await this.sendCmd('', 2000)
      await this.disconnect()
      return { ok: true, ms: Date.now() - t0, message: 'Conexão Telnet estabelecida com sucesso' }
    } catch (err) {
      try { await this.disconnect() } catch {}
      return { ok: false, ms: Date.now() - t0, message: err.message ?? 'Falha na conexão Telnet' }
    }
  }
}
