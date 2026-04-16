import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  username:   { type: String, required: true, index: true },
  projeto_id: { type: String, required: true },
  subscription: {
    endpoint:        { type: String, required: true },
    expirationTime:  { type: Number, default: null },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
  },
}, { timestamps: true })

// Garante uma subscrição por endpoint (upsert por endpoint)
schema.index({ 'subscription.endpoint': 1 }, { unique: true })

export const PushSubscription =
  mongoose.models.PushSubscription ??
  mongoose.model('PushSubscription', schema)
