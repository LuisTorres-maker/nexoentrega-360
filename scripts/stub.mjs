// Marcador de comandos que aun no existen. Termina con codigo 2 para que nadie lo tome por exito.
//   node scripts/stub.mjs <comando> <ronda>
const [comando = 'comando', ronda = 'una ronda posterior'] = process.argv.slice(2);
console.error(`NO IMPLEMENTADO: "${comando}" se completa en ${ronda}.`);
process.exit(2);
