import mongoose from 'mongoose';
import { getConfig } from '../config/env.js';
import { logger } from '../common/logger.js';
import { ContactModel } from '../modules/contacts/contact.model.js';

/** Drops legacy indexes from older schemas (e.g. userId+instanceId+phone) that break upserts. */
async function migrateContactIndexes(): Promise<void> {
  const coll = ContactModel.collection;
  const indexes = await coll.indexes();
  for (const idx of indexes) {
    const name = idx.name as string;
    if (name === '_id_') continue;
    const key = idx.key as Record<string, number>;
    const legacyInstance =
      name === 'userId_1_instanceId_1_phone_1' ||
      (key && 'instanceId' in key && !('sessionId' in key));
    if (!legacyInstance) continue;
    try {
      await coll.dropIndex(name);
      logger.info({ dropped: name }, 'Dropped legacy Contact index');
    } catch {
      /* ignore */
    }
  }
  try {
    await ContactModel.syncIndexes();
  } catch (e) {
    logger.warn({ e }, 'Contact syncIndexes failed');
  }
}

export async function connectMongo(): Promise<void> {
  const uri = getConfig().MONGO_URI;
  await mongoose.connect(uri);
  await migrateContactIndexes();
  logger.info('MongoDB connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
