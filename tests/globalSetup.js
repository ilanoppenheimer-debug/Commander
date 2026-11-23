// Corre una vez, en el proceso principal, antes de lanzar los workers.
// Fija la zona horaria de la usuaria: los tests de fechas dependen de ella.
export default function setup() {
  process.env.TZ = 'America/Santiago';
}
