import { ContactModel, type IContact } from './contact.model.js';
import type { Types } from 'mongoose';

export class ContactRepository {
  async upsertMany(
    userId: Types.ObjectId,
    sessionId: Types.ObjectId,
    rows: Array<{
      phoneNumber: string;
      waJid: string;
      name?: string;
      isBusiness?: boolean;
    }>
  ): Promise<number> {
    let n = 0;
    for (const r of rows) {
      const phone = r.phoneNumber?.replace(/\D/g, '') ?? '';
      const waJid = r.waJid?.trim();
      if (!phone || !waJid) continue;
      await ContactModel.findOneAndUpdate(
        { sessionId, waJid: r.waJid },
        {
          $set: {
            userId,
            sessionId,
            phoneNumber: phone,
            waJid,
            name: r.name,
            isBusiness: r.isBusiness,
          },
        },
        { upsert: true }
      );
      n++;
    }
    return n;
  }

  async list(
    sessionId: Types.ObjectId,
    opts: { search?: string; limit: number; page: number }
  ): Promise<{ items: IContact[]; total: number }> {
    const q: Record<string, unknown> = { sessionId };
    if (opts.search?.trim()) {
      const s = opts.search.trim();
      q.$or = [
        { phoneNumber: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { name: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const skip = (opts.page - 1) * opts.limit;
    const [items, total] = await Promise.all([
      ContactModel.find(q).sort({ name: 1, phoneNumber: 1 }).skip(skip).limit(opts.limit),
      ContactModel.countDocuments(q),
    ]);
    return { items, total };
  }

  async findByIdForUser(contactId: string, userId: Types.ObjectId): Promise<IContact | null> {
    return ContactModel.findOne({ _id: contactId, userId });
  }

  async deleteById(contactId: string, userId: Types.ObjectId): Promise<boolean> {
    const r = await ContactModel.deleteOne({ _id: contactId, userId });
    return r.deletedCount > 0;
  }

  async findNameForPhone(sessionId: Types.ObjectId, phoneNumber: string): Promise<string | undefined> {
    const digits = phoneNumber.replace(/\D/g, '');
    const c = await ContactModel.findOne({ sessionId, phoneNumber: digits }).select({ name: 1 }).lean();
    return c?.name ?? undefined;
  }
}
