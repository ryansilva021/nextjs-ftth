/**
 * src/lib/polt-adapter.js
 *
 * Adapter REST para pOLT (programmable OLT / OLT simulada).
 * Envelopa chamadas ao endpoint POST /polt/polt_actions.
 *
 * Referência de actions suportadas:
 *   ADDONU    — provisiona ONU na pOLT
 *   REMOVEONU — remove ONU da pOLT
 *   RxMODE    — configura modo de recepção (ex: onu_sim para simulador)
 */

export class POLTAdapter {
  /**
   * @param {string} baseUrl  Ex: "http://192.168.1.100:3002"
   * @param {number} [timeoutMs=10000]
   */
  constructor(baseUrl, timeoutMs = 10_000) {
    this.baseUrl   = baseUrl.replace(/\/$/, '')
    this.endpoint  = `${this.baseUrl}/polt/polt_actions`
    this.timeoutMs = timeoutMs
  }

  /**
   * Tests REST connectivity by issuing GET <baseUrl>/health with an 8s timeout.
   *
   * Never throws — always returns a result object.
   *
   * @returns {Promise<{ ok: boolean, ms: number, message: string }>}
   */
  async testConnection() {
    const t0 = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      })

      const ms = Date.now() - t0

      if (res.ok) {
        return { ok: true, ms, message: `REST OK (HTTP ${res.status})` }
      }
      return { ok: false, ms, message: `REST respondeu HTTP ${res.status}` }
    } catch (err) {
      const ms = Date.now() - t0
      if (err.name === 'AbortError') {
        return { ok: false, ms, message: 'Timeout após 8s' }
      }
      return { ok: false, ms, message: err.message ?? 'Erro de rede' }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Envia um array de requests para a pOLT.
   * @param {object[]} requests
   * @returns {Promise<object>} resposta JSON da pOLT
   */
  async _send(requests) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(this.endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requests }),
        signal:  controller.signal,
      })

      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch { data = { raw: text } }

      if (!res.ok) {
        throw new Error(`pOLT HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      return data
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`pOLT timeout após ${this.timeoutMs}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Provisiona uma ONU na pOLT.
   *
   * @param {object} p
   * @param {number}  p.channel_term          Número do channel termination (PON port)
   * @param {number}  p.onu_id                ID da ONU na PON (0–127)
   * @param {string}  p.serial_vendor_id      Prefixo do serial (4 chars, ex: "HWTC")
   * @param {string}  p.serial_vendor_specific Sufixo do serial (8 chars hex)
   * @param {string}  [p.flags]               Ex: "present+in_o5"
   * @param {string}  [p.management_state]    Ex: "relying-on-vomci"
   * @param {string}  [p.loid]                Line ID
   * @param {string}  [p.v_ani]               vANI reference
   */
  async addOnu(p) {
    return this._send([{
      channel_term:           p.channel_term,
      action:                 'ADDONU',
      onu_id:                 p.onu_id,
      serial_vendor_id:       p.serial_vendor_id,
      serial_vendor_specific: p.serial_vendor_specific,
      flags:                  p.flags             ?? 'present+in_o5',
      management_state:       p.management_state  ?? 'relying-on-vomci',
      loid:                   p.loid              ?? '',
      v_ani:                  p.v_ani             ?? '',
    }])
  }

  /**
   * Remove uma ONU da pOLT.
   * Aceita os mesmos parâmetros de addOnu.
   */
  async removeOnu(p) {
    return this._send([{
      channel_term:           p.channel_term,
      action:                 'REMOVEONU',
      onu_id:                 p.onu_id,
      serial_vendor_id:       p.serial_vendor_id,
      serial_vendor_specific: p.serial_vendor_specific,
      flags:                  p.flags            ?? 'present+in_o5',
      management_state:       p.management_state ?? 'relying-on-vomci',
      loid:                   p.loid             ?? '',
      v_ani:                  p.v_ani            ?? '',
    }])
  }

  /**
   * Configura o modo de recepção da pOLT.
   *
   * @param {object} p
   * @param {string} p.mode          Ex: "onu_sim"
   * @param {string} p.onu_sim_ip    IP do simulador de ONU
   * @param {number} p.onu_sim_port  Porta do simulador
   */
  async setRxMode(p) {
    return this._send([{
      mode:         p.mode,
      action:       'RxMODE',
      onu_sim_ip:   p.onu_sim_ip,
      onu_sim_port: Number(p.onu_sim_port),
    }])
  }
}
