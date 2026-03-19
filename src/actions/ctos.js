/**
 * src/actions/ctos.js
 * Server Actions para CTOs (Caixas de Terminação Óptica).
 *
 * Mapeamento de endpoints:
 *   GET    /api/ctos              → getCTOs(projetoId)
 *   POST   /api/ctos (upsert)    → upsertCTO(data)
 *   DELETE /api/ctos             → deleteCTO(ctoId, projetoId)
 *   GET    /api/diagrama?id=     → getDiagramaCTO(ctoId, projetoId)
 *   POST   /api/diagrama         → saveDiagramaCTO(data)
 */

"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WRITE_ROLES, ALL_ROLES } from "@/lib/auth";
import { requireActiveEmpresa } from "@/lib/tenant-guard";
import { CTO } from "@/models/CTO";
import { Movimentacao } from "@/models/Movimentacao";

// ---------------------------------------------------------------------------
// GET /api/ctos → getCTOs
// ---------------------------------------------------------------------------

/**
 * Lista todas as CTOs de um projeto com ocupação calculada.
 * Requer: qualquer usuário autenticado do projeto com empresa ativa.
 *
 * @param {string} projetoId
 * @returns {Promise<Array>}  — CTOs serializadas com campo `ocupacao`
 */
export async function getCTOs(projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES);
  const { role, projeto_id: userProjeto } = session.user;

  // Não-superadmin só vê o próprio projeto
  const targetProjeto = role === "superadmin" ? projetoId : userProjeto;

  await connectDB();

  const ctos = await CTO.find({ projeto_id: targetProjeto }).lean();

  // Calcula ocupação: novo formato (splitters) ou legado (portas)
  return ctos.map((cto) => {
    let ocupadas = 0;
    if (cto.diagrama?.splitters?.length) {
      for (const s of cto.diagrama.splitters) {
        for (const sd of (s.saidas ?? [])) {
          if (sd?.cliente?.trim()) ocupadas++;
        }
      }
    } else if (cto.diagrama?.portas) {
      for (const porta of Object.values(cto.diagrama.portas)) {
        if (porta?.cliente) ocupadas++;
      }
    }
    return {
      ...cto,
      _id: cto._id.toString(),
      ocupacao: ocupadas,
    };
  });
}

// ---------------------------------------------------------------------------
// POST /api/ctos (upsert) → upsertCTO
// ---------------------------------------------------------------------------

/**
 * Cria ou atualiza uma CTO.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.cto_id        — identificador único no projeto (obrigatório)
 * @param {string} data.projeto_id    — tenant (obrigatório)
 * @param {number} data.lat           — latitude (obrigatório)
 * @param {number} data.lng           — longitude (obrigatório)
 * @param {string} [data.nome]
 * @param {string} [data.rua]
 * @param {string} [data.bairro]
 * @param {number} [data.capacidade]
 * @param {string} [data.cdo_id]
 * @param {number} [data.porta_cdo]
 * @param {string} [data.splitter_cto]
 * @returns {Promise<Object>}  — CTO criada/atualizada
 */
export async function upsertCTO(data) {
  const session = await requireActiveEmpresa(WRITE_ROLES);
  const { role, projeto_id: userProjeto } = session.user;

  const {
    cto_id,
    projeto_id,
    lat,
    lng,
    nome,
    rua,
    bairro,
    capacidade,
    cdo_id,
    porta_cdo,
    splitter_cto,
  } = data ?? {};

  // Validação básica
  if (!cto_id?.trim()) throw new Error("cto_id é obrigatório");
  if (lat == null) throw new Error("lat é obrigatório");
  if (lng == null) throw new Error("lng é obrigatório");

  const targetProjeto = role === "superadmin" ? projeto_id : userProjeto;
  if (!targetProjeto) throw new Error("projeto_id é obrigatório");

  await connectDB();

  const update = {
    lat: Number(lat),
    lng: Number(lng),
    nome: nome?.trim() ?? null,
    rua: rua?.trim() ?? null,
    bairro: bairro?.trim() ?? null,
    capacidade: capacidade != null ? Number(capacidade) : 0,
    cdo_id: cdo_id ?? null,
    porta_cdo: porta_cdo != null ? Number(porta_cdo) : null,
    splitter_cto: splitter_cto?.trim() ?? null,
  };

  const cto = await CTO.findOneAndUpdate(
    { projeto_id: targetProjeto, cto_id: cto_id.trim() },
    { $set: update },
    { upsert: true, new: true, runValidators: true },
  ).lean();

  revalidatePath("/");
  revalidatePath("/admin/ctos");

  return { ...cto, _id: cto._id.toString() };
}

// ---------------------------------------------------------------------------
// DELETE /api/ctos → deleteCTO
// ---------------------------------------------------------------------------

/**
 * Remove uma CTO pelo cto_id dentro do projeto.
 * Requer: admin ou superior com empresa ativa.
 *
 * @param {string} ctoId
 * @param {string} projetoId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function deleteCTO(ctoId, projetoId) {
  const session = await requireActiveEmpresa(WRITE_ROLES);
  const { role, projeto_id: userProjeto } = session.user;

  if (!ctoId) throw new Error("cto_id é obrigatório");

  const targetProjeto = role === "superadmin" ? projetoId : userProjeto;
  if (!targetProjeto) throw new Error("projeto_id é obrigatório");

  await connectDB();

  const result = await CTO.deleteOne({
    projeto_id: targetProjeto,
    cto_id: ctoId,
  });

  revalidatePath("/");
  revalidatePath("/admin/ctos");

  return { deleted: result.deletedCount > 0 };
}

// ---------------------------------------------------------------------------
// GET /api/diagrama?id= → getDiagramaCTO
// ---------------------------------------------------------------------------

/**
 * Retorna o JSON do diagrama interno de uma CTO.
 * Requer: qualquer usuário autenticado com empresa ativa.
 *
 * @param {string} ctoId
 * @param {string} projetoId
 * @returns {Promise<Object | null>}  — diagrama ou null
 */
export async function getDiagramaCTO(ctoId, projetoId) {
  const session = await requireActiveEmpresa(ALL_ROLES);
  const { role, projeto_id: userProjeto } = session.user;

  const targetProjeto = role === "superadmin" ? projetoId : userProjeto;

  await connectDB();

  const cto = await CTO.findOne(
    { projeto_id: targetProjeto, cto_id: ctoId },
    "cto_id nome capacidade diagrama",
  ).lean();

  if (!cto) return null;

  return {
    ...cto,
    _id: cto._id.toString(),
  };
}

// ---------------------------------------------------------------------------
// POST /api/diagrama → saveDiagramaCTO
// ---------------------------------------------------------------------------

/**
 * Salva (substitui) o JSON do diagrama interno de uma CTO.
 * Requer: admin, tecnico ou superior com empresa ativa.
 *
 * @param {Object} data
 * @param {string} data.cto_id
 * @param {string} data.projeto_id
 * @param {Object} data.diagrama   — objeto diagrama completo
 * @returns {Promise<{ saved: boolean }>}
 */
export async function saveDiagramaCTO(data) {
  const session = await requireActiveEmpresa(["superadmin", "admin", "tecnico"]);
  const { role, projeto_id: userProjeto } = session.user;

  const { cto_id, projeto_id, diagrama } = data ?? {};

  if (!cto_id) throw new Error("cto_id é obrigatório");
  if (!diagrama) throw new Error("diagrama é obrigatório");

  const targetProjeto = role === "superadmin" ? projeto_id : userProjeto;
  if (!targetProjeto) throw new Error("projeto_id é obrigatório");

  await connectDB();

  // Bloquear cliente duplicado dentro da mesma CTO
  if (diagrama.portas && typeof diagrama.portas === 'object') {
    const clientesMap = {}
    for (const [porta, info] of Object.entries(diagrama.portas)) {
      const nome = info?.cliente?.trim().toLowerCase()
      if (!nome) continue
      if (clientesMap[nome] != null) {
        throw new Error(`Cliente duplicado: "${info.cliente.trim()}" já está na porta ${clientesMap[nome]}.`)
      }
      clientesMap[nome] = porta
    }
  }

  // Propaga vínculos de topologia do diagrama para os campos do modelo
  const topologiaUpdate = {}
  if (diagrama.entrada) {
    topologiaUpdate.cdo_id       = diagrama.entrada.cdo_id?.trim()       || null
    topologiaUpdate.porta_cdo    = diagrama.entrada.porta_cdo    ? (Number(diagrama.entrada.porta_cdo)    || null) : null
    topologiaUpdate.splitter_cto = diagrama.entrada.splitter_cto?.trim() || null
  }

  const result = await CTO.updateOne(
    { projeto_id: targetProjeto, cto_id },
    { $set: { diagrama, ...topologiaUpdate } },
  );

  revalidatePath("/");
  revalidatePath("/admin/diagramas");

  return { saved: result.modifiedCount > 0 };
}
