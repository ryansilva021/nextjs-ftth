/**
 * src/lib/rest-olt-adapter.js
 *
 * REST adapter for OLTs that expose an HTTP API (protocolo = 'api').
 * Mirrors the HuaweiOltAdapter interface where applicable.
 *
 * All requests attach `Authorization: Bearer <api_token>` when an api_token
 * is configured.  Every request has an AbortController timeout guard.
 */

export class RestOltAdapter {
  /**
   * @param {{ rest_url: string, api_token?: string|null, timeoutMs?: number }} opts
   */
  constructor({ rest_url, api_token = null, timeoutMs = 10_000 }) {
    this.baseUrl   = (rest_url ?? '').replace(/\/$/, '')
    this.api_token = api_token ?? null
    this.timeoutMs = timeoutMs
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Builds the Authorization header if an api_token is configured.
   * @returns {Record<string, string>}
   */
  _headers() {
    const h = { 'Content-Type': 'application/json' }
    if (this.api_token) h['Authorization'] = `Bearer ${this.api_token}`
    return h
  }

  /**
   * Performs a GET request with an AbortController timeout.
   *
   * @param {string} path  - Path relative to baseUrl (must start with /)
   * @returns {Promise<Response>}
   */
  async _get(path) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method:  'GET',
        headers: this._headers(),
        signal:  controller.signal,
      })
      return res
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`REST timeout após ${this.timeoutMs}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  /**
   * Tests REST connectivity by sending GET <baseUrl>/health.
   * Any 2xx response is considered success.
   *
   * Never throws — always returns a result object.
   *
   * @returns {Promise<{ ok: boolean, ms: number, message: string }>}
   */
  async testConnection() {
    const t0 = Date.now()
    try {
      const res = await this._get('/health')
      const ms  = Date.now() - t0

      if (res.ok) {
        return { ok: true, ms, message: `REST OK (HTTP ${res.status})` }
      }
      return { ok: false, ms, message: `REST respondeu HTTP ${res.status}` }
    } catch (err) {
      return { ok: false, ms: Date.now() - t0, message: err.message ?? 'Erro de rede' }
    }
  }

  // ─── getOltInfo ────────────────────────────────────────────────────────────

  /**
   * Returns basic OLT status/info from GET <baseUrl>/api/status.
   * Falls back to /api/info if /api/status returns a non-2xx response.
   *
   * @returns {Promise<Object>}
   */
  async getOltInfo() {
    try {
      let res = await this._get('/api/status')
      if (!res.ok) res = await this._get('/api/info')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      console.error('[RestOltAdapter] getOltInfo error:', err.message)
      return { error: err.message }
    }
  }

  // ─── getOnus ───────────────────────────────────────────────────────────────

  /**
   * Returns ONUs on a given slot/port from GET <baseUrl>/api/onus?slot=X&port=Y.
   *
   * @param {number} slot
   * @param {number} port
   * @returns {Promise<Array<Object>>}
   */
  async getOnus(slot, port) {
    try {
      const res = await this._get(`/api/onus?slot=${slot}&port=${port}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data : (data?.onus ?? [])
    } catch (err) {
      console.error('[RestOltAdapter] getOnus error:', err.message)
      return []
    }
  }
}
