# Planilla de confirmaciones

Cada vez que alguien confirma en la invitación, se agrega una fila en una planilla de Google
(Fecha, Nombres, Asiste, Personas, Invitación). Si cambia su respuesta, se actualiza su fila.

## Cómo crearla (una sola vez)

1. Entrá a https://sheets.new con tu cuenta de Google y ponele de nombre "Confirmaciones Fran y Sofi".
2. Menú **Extensiones → Apps Script**.
3. Borrá lo que aparece y pegá todo el contenido de `Codigo.gs`. Guardá (ícono del disquete).
4. Arriba a la derecha: **Implementar → Nueva implementación**.
   - Tipo (engranaje): **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
5. **Implementar** y aceptá los permisos (Google avisa que la app no está verificada: *Configuración avanzada → Ir a…*).
6. Copiá la **URL de la aplicación web** (termina en `/exec`) y pegala en `SHEET_URL`, al principio de `js/main.js`.

La planilla se puede descargar como Excel desde **Archivo → Descargar → Microsoft Excel (.xlsx)**.
