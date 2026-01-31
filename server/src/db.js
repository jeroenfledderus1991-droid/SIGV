const sql = require("mssql");
const config = require("./config");

const poolConfig = {
  user: config.db.user,
  password: config.db.password,
  server: config.db.server,
  database: config.db.name,
  port: config.db.port,
  pool: {
    max: config.db.maxConnections,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  connectionTimeout: config.db.connectionTimeout * 1000,
  requestTimeout: config.db.commandTimeout * 1000,
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(poolConfig);
  }
  return poolPromise;
}

async function queryOne(query, params = {}) {
  const pool = await getPool();
  const request = pool.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  const result = await request.query(query);
  return result.recordset[0] || null;
}

module.exports = {
  getPool,
  queryOne,
  sql,
};
