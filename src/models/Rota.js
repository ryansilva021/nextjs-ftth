/**
 * Rota.js
 * Rota de fibra óptica entre equipamentos — traçado geoespacial da rede.
 * Equivalente à tabela SQL: rotas
 *
 * Campos SQL originais:
 *   rota_id TEXT PK, nome TEXT, geojson TEXT, updated_at TEXT, projeto_id TEXT
 *
 * O campo geojson armazenava um objeto GeoJSON serializado como string no SQL.
 * No MongoDB, armazenamos o GeoJSON nativo, permitindo queries geoespaciais
 * com $geoIntersects, $near etc.
 *
 * Formato GeoJSON esperado para o traçado:
 *   { "type": "LineString", "coordinates": [[lng, lat], [lng, lat], ...] }
 *
 * Atenção: GeoJSON usa [longitude, latitude] (ordem invertida em relação ao sistema legado).
 */

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

// ---------------------------------------------------------------------------
// Sub-schema: GeoJSON LineString nativo para índice 2dsphere
// ---------------------------------------------------------------------------
const LineStringSchema = new Schema(
  {
    type: {
      type:    String,
      enum:    ["LineString"],
      default: "LineString",
      required: true,
    },
    // Array de pontos [[lng, lat], [lng, lat], ...]
    // GeoJSON exige longitude primeiro (diferente do padrão lat/lng do sistema legado)
    coordinates: {
      type:     [[Number]], // Array de arrays de dois números [lng, lat]
      required: [true, "coordinates é obrigatório"],
      validate: {
        validator: function (coords) {
          if (!Array.isArray(coords) || coords.length < 2) return false;
          return coords.every(
            (pt) =>
              Array.isArray(pt) &&
              pt.length === 2 &&
              typeof pt[0] === "number" &&
              typeof pt[1] === "number"
          );
        },
        message: "coordinates deve ser um array de ao menos 2 pontos [lng, lat]",
      },
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Schema principal
// ---------------------------------------------------------------------------
const RotaSchema = new Schema(
  {
    // Identificador legível único por projeto
    rota_id: {
      type:     String,
      required: [true, "rota_id é obrigatório"],
      trim:     true,
    },

    // Multi-tenancy
    projeto_id: {
      type:     String,
      required: [true, "projeto_id é obrigatório"],
      trim:     true,
      default:  "default",
    },

    nome: {
      type:    String,
      trim:    true,
      default: null,
    },

    // Traçado geoespacial nativo (GeoJSON LineString)
    // Indexado com 2dsphere para queries espaciais
    geojson: {
      type:     LineStringSchema,
      required: [true, "geojson (traçado) é obrigatório"],
    },

    // Metadados adicionais da rota
    tipo: {
      type:    String,
      trim:    true,
      default: null,
      // Ex: "subterranea", "aerea", "duto"
    },

    // Comprimento em metros (calculado ou informado)
    comprimento_m: {
      type:    Number,
      default: null,
      min:     [0, "comprimento não pode ser negativo"],
    },

    obs: {
      type:    String,
      trim:    true,
      default: null,
    },

    // IDs dos itens snappados nas extremidades da rota (ex: ["cdo:CDO-001", "cto:CTO-001"])
    // Permite matching confiável de rota por topologia sem depender do texto de obs
    snap_ids: {
      type:    [String],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "rotas",
  }
);

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

// Índice composto único por projeto
RotaSchema.index({ projeto_id: 1, rota_id: 1 }, { unique: true });

// Índice geoespacial para queries $geoIntersects, $near
// Requer que coordinates esteja no padrão GeoJSON [lng, lat]
RotaSchema.index({ "geojson": "2dsphere" });

// Índice por tipo para filtragens no mapa
RotaSchema.index({ projeto_id: 1, tipo: 1 });

// ---------------------------------------------------------------------------
// Métodos estáticos
// ---------------------------------------------------------------------------

/**
 * Busca todas as rotas que passam por um bounding box.
 * box: { swLng, swLat, neLng, neLat }
 *
 * @param {string} projeto_id
 * @param {{ swLng: number, swLat: number, neLng: number, neLat: number }} box
 */
RotaSchema.statics.findByBoundingBox = function (projeto_id, box) {
  return this.find({
    projeto_id,
    geojson: {
      $geoIntersects: {
        $geometry: {
          type: "Polygon",
          coordinates: [
            [
              [box.swLng, box.swLat],
              [box.neLng, box.swLat],
              [box.neLng, box.neLat],
              [box.swLng, box.neLat],
              [box.swLng, box.swLat],
            ],
          ],
        },
      },
    },
  });
};

/**
 * Converte coordenadas legadas [lat, lng] para GeoJSON [lng, lat].
 * Útil para migrar dados do sistema atual.
 *
 * @param {Array<[number, number]>} latLngArray - Array no formato [[lat, lng], ...]
 * @returns {Array<[number, number]>} Array no formato GeoJSON [[lng, lat], ...]
 */
RotaSchema.statics.latLngToGeoJSON = function (latLngArray) {
  return latLngArray.map(([lat, lng]) => [lng, lat]);
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export const Rota = models.Rota || model("Rota", RotaSchema);
