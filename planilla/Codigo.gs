/**
 * Planilla de confirmaciones de Fran y Sofi.
 * Recibe cada respuesta de la invitación y la anota en la hoja "Confirmaciones".
 * Si la misma persona cambia su respuesta, se actualiza su fila (columna ID).
 */
const HOJA = 'Confirmaciones';
const COLUMNAS = ['Fecha', 'Nombres', 'Asiste', 'Personas', 'Invitación', 'ID'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const hoja = obtenerHoja();
    const fila = [
      new Date(),
      texto(d.nombres),
      d.asiste === 'No' ? 'No' : 'Sí',
      Number(d.personas) || 0,
      texto(d.invitacion),
      texto(d.id)
    ];
    const ultima = hoja.getLastRow();
    const ids = ultima > 1 ? hoja.getRange(2, 6, ultima - 1, 1).getValues().flat() : [];
    const i = ids.indexOf(fila[5]);
    if (i >= 0) hoja.getRange(i + 2, 1, 1, fila.length).setValues([fila]);
    else hoja.appendRow(fila);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function obtenerHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
  }
  return hoja;
}

// Texto corto y sin fórmulas (un valor que empieza con = + - @ se guarda como texto)
function texto(v) {
  const s = String(v || '').slice(0, 600);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
