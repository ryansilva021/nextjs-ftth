/**
 * src/services/olt-ssh-adapter.ts
 *
 * Typed orchestrator for OLT SSH operations.
 * Each method acquires an adapter, connects, runs the operation, then disconnects.
 * On any error the original exception is re-thrown — no fake/fallback data is produced.
 */

// @ts-ignore — js interop
import { getOltAdapter } from '../lib/olt-adapter-factory'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface OltDoc {
  id: string
  nome?: string
  ip: string
  ssh_user?: string
  ssh_pass?: string
  ssh_port?: number
  vendor?: string
  protocolo?: string
}

export interface OnuRecord {
  onuId: number
  serial: string
  cliente: string
  status: string
  rx: number | null
  tx: number | null
}

export interface UnconfiguredOnu {
  serial: string
  pon: string
  pon_port: number | null
  board: string | null
  slot: number | null
}

export interface ProvisionParams {
  slot: number
  port: number
  onuId: number
  serial: string
  cliente: string
  vlan?: number
}

// ─── OltSshService ────────────────────────────────────────────────────────────

export class OltSshService {
  /**
   * Tests the SSH connection to an OLT.
   * Returns latency and a human-readable status message.
   * Never fakes data — throws on failure.
   */
  async testConnection(olt: OltDoc): Promise<{ ok: boolean; ms: number; message: string }> {
    const adapter = getOltAdapter(olt)
    try {
      return await adapter.testConnection()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`testConnection falhou para OLT "${olt.nome ?? olt.ip}": ${msg}`)
    }
  }

  /**
   * Returns all provisioned ONUs on a GPON port.
   * Connects, queries, disconnects in a finally block.
   * Throws on SSH or parsing failure.
   */
  async getOnus(olt: OltDoc, slot: number, port: number): Promise<OnuRecord[]> {
    const adapter = getOltAdapter(olt)
    try {
      await adapter.connect()
      try {
        return await adapter.getOnus(slot, port)
      } finally {
        await adapter.disconnect()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`getOnus falhou para OLT "${olt.nome ?? olt.ip}" slot=${slot} port=${port}: ${msg}`)
    }
  }

  /**
   * Returns ONUs discovered by the OLT but not yet provisioned.
   * Connects, queries, disconnects in a finally block.
   * Throws on SSH failure — returns empty array only when the device genuinely reports none.
   */
  async getUnconfiguredOnus(olt: OltDoc): Promise<UnconfiguredOnu[]> {
    const adapter = getOltAdapter(olt)
    try {
      await adapter.connect()
      try {
        return await adapter.getUnconfiguredOnus()
      } finally {
        await adapter.disconnect()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`getUnconfiguredOnus falhou para OLT "${olt.nome ?? olt.ip}": ${msg}`)
    }
  }

  /**
   * Provisions an ONU on the OLT.
   * Connects, runs provisioning commands, disconnects in a finally block.
   * Throws on SSH or provisioning failure — never returns a mock success.
   */
  async provisionOnu(olt: OltDoc, params: ProvisionParams): Promise<{ success: boolean }> {
    const adapter = getOltAdapter(olt)
    try {
      await adapter.connect()
      try {
        const result = await adapter.provisionOnu(params)
        if (!result.success) {
          throw new Error(result.error ?? 'Provisionamento falhou sem mensagem de erro')
        }
        return { success: true }
      } finally {
        await adapter.disconnect()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`provisionOnu falhou para OLT "${olt.nome ?? olt.ip}" serial=${params.serial}: ${msg}`)
    }
  }
}
