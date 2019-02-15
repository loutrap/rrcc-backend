const mysql = require('mysql');

/**
 * RIT dev server info
 */
// const pool = mysql.createPool({
//   connectionLimit: 10,
//   host: '129.21.183.59',
//   user: 'root',
//   password: 'subversionperversion',
//   database: 'rrcc'
// });

/**
 * Creates connection pool
 */
const pool = mysql.createPool({
  connectionLimit: 10,
  host: '10.0.0.239',
  user: 'root',
  password: 'mW(N>CJ9538P',
  database: 'rrcc'
});

/**
 * Exports the connection pool to be user by server.js
 */
module.exports = pool;
