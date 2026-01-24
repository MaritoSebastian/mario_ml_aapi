import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDB() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db();

  console.log('✅ MongoDB conectado');
  return db;
}

export async function getDB() {
  if (!db) {
    await connectDB();
  }
  return db;
}


