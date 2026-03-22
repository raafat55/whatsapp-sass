import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IContact extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  phoneNumber: string;
  waJid: string;
  name?: string;
  isBusiness?: boolean;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    phoneNumber: { type: String, required: true },
    waJid: { type: String, required: true },
    name: { type: String },
    isBusiness: { type: Boolean },
    lastSeen: { type: Date },
  },
  { timestamps: true }
);

ContactSchema.index({ sessionId: 1, waJid: 1 }, { unique: true });

export const ContactModel = mongoose.model<IContact>('Contact', ContactSchema);
