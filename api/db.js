// db.js
import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDB() {
  if (db) return db;

  try {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(); // usa la DB definida en la URI

    console.log('✅ MongoDB conectado');
    return db;
  } catch (error) {
    console.error('❌ Error MongoDB:', error.message);
    throw error;
  }
}

export function getDB() {
  if (!db) {
    throw new Error('DB no inicializada');
  }
  return db;
}
