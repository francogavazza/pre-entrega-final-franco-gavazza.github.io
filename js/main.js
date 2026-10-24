(function () {
  // ===== Datos de la boda (editar acá) =====
  var MUSIC_SRC = "./assets/boda/einaudi-experience.mp3"; // "Experience", Ludovico Einaudi (en vivo desde el Teatro dal Verme, Milán)
  var MUSIC_START = 110; // segundo en el que arranca la canción (1:50), también al repetirse
  var TARGET = new Date(2027, 0, 21, 0, 0, 0); // cuenta regresiva hasta el 21/01/2027 a las 00:00
  // Número de WhatsApp que recibe las confirmaciones cuando la página está en GitHub Pages
  // (sin + ni espacios, ej.: "5492914000000"). Vacío: el invitado elige a quién mandarlo.
  var WHATSAPP = "5492931420208";
  // Link de la invitación publicada en Claude (ahí las confirmaciones se guardan en su base)
  var ARTIFACT_URL = "https://claude.ai/artifact/EhYXrakUV9p9SFZaMFQmXk";
  // Planilla de Google donde se anotan todas las confirmaciones (URL de la app web de Apps Script,
  // ver planilla/README.md). Vacío: en GitHub Pages las confirmaciones se mandan por WhatsApp.
  var SHEET_URL = "https://script.google.com/macros/s/AKfycbwysCg5Sy08qex3t0cPMm1tuBpSeGsvtdDTH-VhxfpWbVkaZmd6VRBbm4oW9n79CL6U/exec";

  var $ = function (id) { return document.getElementById(id); };
  var hasClaude = !!(window.claude && window.claude.use);

  // ===== Sobre: al tocar el sello se abre, sale la tarjeta y empieza la música =====
  var door = $("door");
  var audio = $("music");
  var musicBtn = $("music-btn");
  var musicOn = false;

  audio.loop = false;
  audio.src = MUSIC_SRC + "#t=" + MUSIC_START;
  audio.addEventListener("ended", function () {
    audio.currentTime = MUSIC_START;
    audio.play().catch(function () {});
  });
  musicBtn.hidden = false;

  function setMusic(on) {
    musicOn = on;
    musicBtn.setAttribute("aria-label", on ? "Pausar música" : "Poner música");
    musicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    if (on) audio.play().catch(function () { setMusic(false); });
    else audio.pause();
  }
  musicBtn.addEventListener("click", function () { setMusic(!musicOn); });

  // Apertura: se levanta la solapa, sale la tarjeta y queda adelante para leerla.
  // Se pasa a la página al tocar la pantalla o sola después de un rato.
  var TARJETA_LISTA_MS = 3600;  // cuando la tarjeta ya está adelante
  var TARJETA_SOLA_MS = 60000;  // por las dudas: si algo falla, igual se pasa a la página
  var FRASE = "Un día, dos historias se cruzaron y decidieron empezar a escribirse juntas. Nos gustaría que seas parte de este nuevo capítulo.";
  var LETRA_MS = 180;           // velocidad de la pluma (milisegundos por letra)
  var PAUSA_FINAL_MS = 2200;    // cuánto queda la frase completa antes de abrir la página
  var openedAt = 0;
  var leaving = false;

  function openDoor() {
    if (door.classList.contains("open")) return;
    openedAt = performance.now();
    door.classList.add("open");
    setMusic(true);
    setTimeout(lanzarPetalos, 900);
    setTimeout(escribirFrase, TARJETA_LISTA_MS + 200);
    setTimeout(leaveDoor, TARJETA_SOLA_MS);
  }

  function leaveDoor() {
    if (leaving) return;
    leaving = true;
    door.classList.add("saliendo");
    document.body.classList.remove("locked");
    // Los pétalos pasan a caer por delante, sobre la página, y cae una nueva lluvia al abrirse la página
    if (petalCanvas.parentNode === door) document.body.insertBefore(petalCanvas, door.nextSibling);
    lanzarPetalos();
    setTimeout(function () { door.hidden = true; }, 1000);
  }

  $("open-door").addEventListener("click", function (e) { e.stopPropagation(); openDoor(); });
  door.addEventListener("click", function () {
    if (!door.classList.contains("open")) openDoor();
    else if (performance.now() - openedAt > TARJETA_LISTA_MS) leaveDoor();
  });
  document.body.classList.add("locked");

  // ===== La frase de la tarjeta, escrita a pluma letra por letra =====
  // Todas las letras se arman desde el principio (invisibles) para que el texto no salte al escribirse;
  // después se van mostrando una por una y la pluma sigue a la última. Al terminar se abre la página.
  var escrito = $("card-escrito");
  var pluma = $("card-pluma");
  var adorno = document.querySelector(".env-card .card-adorno");
  var letras = [];
  FRASE.split(" ").forEach(function (palabra, i) {
    if (i) escrito.appendChild(document.createTextNode(" "));
    var w = document.createElement("span");
    w.className = "palabra";
    Array.prototype.forEach.call(palabra, function (ch) {
      var l = document.createElement("span");
      l.className = "letra";
      l.textContent = ch;
      w.appendChild(l);
      letras.push(l);
    });
    escrito.appendChild(w);
  });

  // La punta de la pluma (abajo a la izquierda del dibujo) recorre cada letra de izquierda a derecha
  // mientras la tinta aparece detrás de ella, con un pequeño vaivén como al escribir a mano.
  var PUNTA_X = 3 / 64, PUNTA_Y = 62 / 64;
  function ponerPluma(x, y, giro) {
    var w = pluma.offsetWidth, h = pluma.offsetHeight;
    pluma.style.transform = "translate(" + (x - w * PUNTA_X).toFixed(1) + "px," + (y - h * PUNTA_Y).toFixed(1) +
      "px) rotate(" + giro.toFixed(1) + "deg)";
  }

  // Dónde está cada letra dentro de la tarjeta (la letra tiene un margen invisible que se descuenta)
  function medirLetra(l) {
    var cs = getComputedStyle(l);
    var px = parseFloat(cs.paddingLeft), py = parseFloat(cs.paddingTop);
    var ancho = l.offsetWidth - 2 * px, altoLetra = l.offsetHeight - 2 * py;
    var x0 = escrito.offsetLeft + l.offsetLeft + px;
    return { x0: x0, x1: x0 + ancho, base: escrito.offsetTop + l.offsetTop + py + altoLetra * 0.72, alto: altoLetra * 0.32 };
  }

  // La pluma llega desde arriba, se apoya sobre la primera letra y recién ahí empieza a escribir
  function apoyarPluma(l, listo) {
    var m = medirLetra(l);
    var desde = { x: escrito.offsetLeft + escrito.offsetWidth * 0.85, y: escrito.offsetTop - 120 };
    var dur = 1600;
    var t0 = performance.now();
    pluma.classList.add("activa");
    (function cuadro(now) {
      if (leaving) return;
      var k = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      ponerPluma(desde.x + (m.x0 - desde.x) * e, desde.y + (m.base - desde.y) * e, -24 + 18 * e);
      if (k < 1) requestAnimationFrame(cuadro);
      else setTimeout(listo, 450);
    })(t0);
  }

  function trazarLetra(l, dur, listo) {
    var m = medirLetra(l);
    var x0 = m.x0, x1 = m.x1, base = m.base, alto = m.alto;
    l.style.backgroundSize = escrito.offsetWidth + "px " + escrito.offsetHeight + "px";
    l.style.backgroundPosition = -l.offsetLeft + "px " + -l.offsetTop + "px";
    l.style.setProperty("--d", dur + "ms");
    l.classList.add("v");
    var t0 = performance.now();
    (function cuadro(now) {
      if (leaving) return;
      var k = Math.min(1, (now - t0) / dur);
      // sube y baja una vez por letra, como el trazo de la mano
      ponerPluma(x0 + (x1 - x0) * k, base - Math.sin(k * Math.PI) * alto, -6 + Math.sin(k * Math.PI * 2) * 4);
      if (k < 1) requestAnimationFrame(cuadro);
      else listo();
    })(t0);
  }

  var escribiendo = false;
  function escribirFrase() {
    if (escribiendo || leaving) return;
    escribiendo = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      letras.forEach(function (l) { l.classList.add("v"); });
      setTimeout(leaveDoor, 8000);
      return;
    }
    var i = 0;
    apoyarPluma(letras[0], function siguiente() {
      if (leaving) return;
      if (i >= letras.length) {
        pluma.classList.remove("activa");
        adorno.classList.add("v");
        setTimeout(leaveDoor, PAUSA_FINAL_MS);
        return;
      }
      var l = letras[i++];
      var ch = l.textContent;
      trazarLetra(l, LETRA_MS, function () {
        // pausa un poco más en las comas y los puntos, y un respiro entre palabras
        var pausa = ch === "." ? 450 : ch === "," ? 250 : 0;
        var prox = letras[i];
        if (prox && prox.parentNode !== l.parentNode) pausa += 60;
        setTimeout(siguiente, pausa);
      });
    });
  }

  // ===== Cuenta regresiva (días y horas), se actualiza cada minuto =====
  // Cuenta regresiva (días, horas y minutos). Revisa cada segundo, pero cada número cambia
  // solo cuando corresponde, con un pequeño salto para que se note que el relojito avanza.
  function poner(id, valor) {
    var el = $(id);
    var txt = String(valor);
    if (el.textContent === txt) return;
    el.textContent = txt;
    el.classList.remove("cambia");
    void el.offsetWidth;
    el.classList.add("cambia");
  }
  function tick() {
    var ms = TARGET - new Date();
    if (ms <= 0) { poner("cd-d", 0); poner("cd-h", 0); poner("cd-m", "00"); return; }
    poner("cd-d", Math.floor(ms / 86400000));
    poner("cd-h", Math.floor((ms % 86400000) / 3600000));
    poner("cd-m", String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0"));
  }
  tick();
  setInterval(tick, 1000);

  // ===== Copiar alias y CVU =====
  function copyText(btn, text, selectEl, okLabel) {
    var original = btn.textContent;
    var flash = function (label) {
      btn.textContent = label;
      setTimeout(function () { btn.textContent = original; }, 1600);
    };
    var fallback = function () {
      try {
        var range = document.createRange();
        range.selectNodeContents(selectEl);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        flash("Seleccionado");
      } catch (e) { flash("No se pudo"); }
    };
    try {
      navigator.clipboard.writeText(text).then(function () { flash(okLabel || "¡Copiado!"); }, fallback);
    } catch (e) { fallback(); }
  }
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var src = $(btn.getAttribute("data-copy"));
      copyText(btn, src.textContent.trim(), src);
    });
  });

  // ===== Confirmación de asistencia (ceremonia y cena; el civil no se confirma) =====
  // Una persona por cada línea escrita
  function countPeople() {
    return $("hogar").value.split("\n").filter(function (l) { return l.trim().length > 0; }).length;
  }
  function getAnswer() {
    var checked = document.querySelector('input[name="asiste"]:checked');
    return checked ? checked.value : "";
  }
  function setAnswer(value) {
    var input = document.querySelector('input[name="asiste"][value="' + value + '"]');
    if (input) input.checked = true;
  }
  function plural(n) { return n + (n === 1 ? " persona" : " personas"); }

  function setStatus(msg, isErr) {
    var s = $("status");
    s.textContent = msg || "";
    s.className = "status" + (isErr ? " err" : "");
  }

  // Al enviar, el botón pasa a "Cambiar respuesta" (sin cartel de confirmación)
  function showDone() {
    $("send").textContent = "Cambiar respuesta";
  }

  function validate() {
    if ($("hogar").value.trim().length < 3) {
      setStatus("Escribí el nombre y apellido de cada persona.", true);
      $("hogar").focus();
      return false;
    }
    if (!getAnswer()) {
      setStatus("Elegí si asisten o no a la ceremonia y cena.", true);
      return false;
    }
    setStatus("");
    return true;
  }

  // En Claude: se guarda en la base del artefacto (cada invitado solo ve la suya)
  var db = null;
  var uid = null;
  function submitClaude() {
    if (!validate()) return;
    if (!db || !uid) { setStatus("Para confirmar necesitás iniciar sesión.", true); return; }
    var count = countPeople();
    var asiste = getAnswer();
    var btn = $("send");
    btn.disabled = true;
    setStatus("Guardando…");
    db.doc("rsvp/" + uid).set({
      hogar: $("hogar").value.trim(),
      asiste: asiste,
      personas: asiste === "si" ? count : 0,
      actualizado: new Date().toISOString()
    })
      .then(function () {
        setStatus("");
        btn.disabled = false;
        showDone(count, asiste);
        sendToSheet("claude-" + uid, asiste, count);
      })
      .catch(function (err) {
        btn.disabled = false;
        if (err && err.code === "quota_exceeded") setStatus("Ya no hay lugar para más confirmaciones. Escribinos directamente.", true);
        else setStatus("No se pudo guardar. Revisá la conexión e intentá de nuevo.", true);
      });
  }

  // Anota la respuesta en la planilla de Google. Cada dispositivo tiene un id, así si alguien
  // cambia su respuesta se actualiza su misma fila en vez de agregar otra.
  function deviceId() {
    try {
      var id = localStorage.getItem("rsvp-id");
      if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem("rsvp-id", id);
      }
      return id;
    } catch (e) { return "sin-id-" + Date.now().toString(36); }
  }
  function sendToSheet(id, asiste, count) {
    if (!SHEET_URL) return Promise.resolve(false);
    var data = {
      id: id,
      nombres: $("hogar").value.trim().split("\n").map(function (l) { return l.trim(); }).filter(Boolean).join(", "),
      asiste: asiste === "si" ? "Sí" : "No",
      personas: asiste === "si" ? count : 0,
      invitacion: $("guest-names").hidden ? "" : $("guest-names").textContent
    };
    // text/plain evita el preflight de CORS; la respuesta de Google no se puede leer (no-cors)
    return fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
      .then(function () { return true; }, function () { return false; });
  }

  function sendWhatsApp(asiste, count, names) {
    var text = asiste === "si"
      ? "¡Hola, Fran y Sofi! Confirmamos asistencia a la ceremonia y cena del 22 de enero (" + plural(count) + "):\n" + names
      : "¡Hola, Fran y Sofi! Lamentablemente no vamos a poder asistir a la ceremonia y cena del 22 de enero:\n" + names;
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  // Con planilla (en los dos links): se anota ahí. Sin planilla, en GitHub Pages se manda por WhatsApp
  function submitStatic() {
    if (!validate()) return;
    var count = countPeople();
    var asiste = getAnswer();
    var names = $("hogar").value.trim();
    try { localStorage.setItem("rsvp-fran-sofi", JSON.stringify({ hogar: names, asiste: asiste })); } catch (e) {}
    if (!SHEET_URL) {
      showDone(count, asiste);
      sendWhatsApp(asiste, count, names);
      return;
    }
    var btn = $("send");
    btn.disabled = true;
    setStatus("Enviando…");
    sendToSheet(deviceId(), asiste, count).then(function (ok) {
      btn.disabled = false;
      if (ok) {
        setStatus("");
        showDone(count, asiste);
      } else {
        setStatus("No se pudo enviar. Revisá la conexión e intentá de nuevo.", true);
      }
    });
  }

  // Con planilla, todas las respuestas van a la planilla (también desde el link de Claude, donde
  // los invitados sin cuenta no pueden guardar en la base del artefacto)
  if (hasClaude && !SHEET_URL) {
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (res) {
      db = res[0];
      var user = res[1];
      if (!db) { setStatus("La confirmación no está disponible en este momento.", true); return; }
      $("send").disabled = false;
      $("send").addEventListener("click", function (e) { e.preventDefault(); submitClaude(); });
      if (!user) return;
      return Promise.resolve(user.id()).then(function (id) {
        uid = id;
        if (!uid) return;
        db.doc("rsvp/" + uid).onSnapshot(function (snap) {
          if (snap.exists && !$("hogar").value) {
            var data = snap.data() || {};
            var asiste = data.asiste || "si";
            $("hogar").value = data.hogar || "";
            setAnswer(asiste);
            showDone(countPeople(), asiste);
          }
        }, function () {});
      });
    }).catch(function () { setStatus("La confirmación no está disponible en este momento.", true); });
  } else {
    $("send").disabled = false;
    $("send").addEventListener("click", function (e) { e.preventDefault(); submitStatic(); });
    try {
      var saved = JSON.parse(localStorage.getItem("rsvp-fran-sofi"));
      if (saved && saved.hogar) {
        $("hogar").value = saved.hogar;
        setAnswer(saved.asiste);
        showDone(countPeople(), saved.asiste);
      }
    } catch (e) {}
  }
  $("rsvp").addEventListener("submit", function (e) { e.preventDefault(); });

  // ===== Nombres del invitado: van en el link como #n-<nombres en base64url> =====
  function encodeNames(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeNames(code) {
    try {
      var b64 = code.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes).trim();
    } catch (e) { return ""; }
  }
  if (location.hash.indexOf("#n-") === 0) {
    var names = decodeNames(location.hash.slice(3));
    if (names) {
      $("guest-names").textContent = names;
      $("guest-names").hidden = false;
    }
  }

  // ===== Panel para Fran y Sofi (se abre con #admin) =====
  var baseUrl = hasClaude ? ARTIFACT_URL : location.href.split("#")[0];
  var genLink = "";
  $("gen-names").addEventListener("input", function () {
    var v = $("gen-names").value.trim();
    genLink = v ? baseUrl + "#n-" + encodeNames(v) : "";
    $("gen-out").textContent = genLink;
    $("gen-copy").hidden = !genLink;
  });
  $("gen-copy").addEventListener("click", function () {
    copyText($("gen-copy"), genLink, $("gen-out"));
  });

  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  var adminRows = [];
  function renderAdmin(docs) {
    adminRows = docs.map(function (d) {
      var x = d.data() || {};
      return { hogar: String(x.hogar || ""), asiste: x.asiste === "no" ? "No" : "Sí", personas: Number(x.personas) || 0, actualizado: String(x.actualizado || "") };
    }).sort(function (a, b) { return a.actualizado < b.actualizado ? 1 : -1; });
    var people = 0;
    adminRows.forEach(function (r) { people += r.personas; });
    $("admin-sum").textContent = adminRows.length === 0
      ? "Todavía no hay confirmaciones."
      : adminRows.length + (adminRows.length === 1 ? " hogar confirmó" : " hogares confirmaron") + " · " + people + (people === 1 ? " persona" : " personas") + " en total.";
    var tbody = $("admin-rows");
    tbody.textContent = "";
    adminRows.forEach(function (r) {
      var tr = document.createElement("tr");
      [r.hogar.replace(/\n/g, ", "), r.asiste, String(r.personas), fmtDate(r.actualizado)].forEach(function (t) {
        var td = document.createElement("td");
        td.textContent = t;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    $("admin-csv").hidden = adminRows.length === 0;
  }
  function csvCell(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
  // Excel en español abre el CSV con punto y coma; el BOM mantiene las tildes
  function downloadCsv() {
    var lines = [["Nombre y apellido", "Asiste", "Personas", "Actualizado"].map(csvCell).join(";")];
    adminRows.forEach(function (r) {
      lines.push([r.hogar.replace(/\n/g, ", "), r.asiste, r.personas, r.actualizado].map(csvCell).join(";"));
    });
    var data = "﻿" + lines.join("\r\n");
    window.claude.use("downloads").then(function (api) {
      if (!api) { $("admin-status").textContent = "La descarga no está disponible en esta vista."; return; }
      return api.save({ filename: "confirmaciones-fran-y-sofi.csv", data: data }).then(function () {
        $("admin-status").textContent = "";
      }, function (err) {
        $("admin-status").textContent = err && err.code === "declined" ? "" : "No se pudo descargar. Probá de nuevo.";
      });
    });
  }
  $("admin-csv").addEventListener("click", downloadCsv);

  if (location.hash === "#admin") {
    document.querySelector("main").hidden = true;
    door.hidden = true;
    document.body.classList.remove("locked");
    $("admin").hidden = false;
    if (!hasClaude) {
      $("admin-sum").textContent = "En esta versión las confirmaciones llegan por WhatsApp. La lista completa está en la invitación publicada en Claude.";
    } else {
      window.claude.use("db").then(function (api) {
        if (!api) { $("admin-sum").textContent = "La base no está disponible en esta vista."; return; }
        api.collection("rsvp").onSnapshot(renderAdmin, function () {
          $("admin-sum").textContent = "Esta sección es solo para Fran y Sofi. Iniciá sesión con la cuenta de la boda.";
        });
      });
    }
  }
  // ===== Pajarito con la cartita =====
  // Vuela en círculos alrededor de un punto: primero el sello, al abrirse "Nos casamos" de la
  // tarjeta y después el título que se está viendo (los que tienen data-pajarito).
  // Entre un punto y otro se desplaza suavemente mientras sigue girando.
  var bird = $("pajarito");
  var stops = Array.prototype.slice.call(document.querySelectorAll("main [data-pajarito]"));
  var VUELTA_MS = 5200; // lo que tarda en dar una vuelta
  var centerX = null;
  var centerY = null;
  var angle = -Math.PI / 2;
  var lastTime = null;

  function orbitCenter() {
    var el;
    if (!door.hidden) {
      el = door.classList.contains("open") ? $("card-escrito") : $("open-door");
    } else {
      el = stops[0];
      stops.forEach(function (s) { if (s.getBoundingClientRect().top < window.innerHeight * 0.6) el = s; });
    }
    var r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + Math.min(r.height, 120) / 2];
  }

  function flyBird(now) {
    var dt = lastTime === null ? 16 : Math.min(now - lastTime, 100);
    lastTime = now;
    if (explotado) { requestAnimationFrame(flyBird); return; }
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = bird.offsetWidth;
    var h = bird.offsetHeight;
    var t = orbitCenter();
    var ty = Math.max(h / 2 + 10, Math.min(vh - h / 2 - 70, t[1]));
    if (centerX === null) { centerX = t[0]; centerY = ty; }
    var k = 1 - Math.exp(-dt / 450);
    centerX += (t[0] - centerX) * k;
    centerY += (ty - centerY) * k;

    angle += dt * 2 * Math.PI / VUELTA_MS;
    var rx = Math.max(40, Math.min(vw / 2 - w / 2 - 4, 150));
    var ry = Math.min(45, rx * 0.3);
    var x = centerX + rx * Math.cos(angle) - w / 2;
    var y = centerY + ry * Math.sin(angle) - h / 2;
    // Más grande cuando pasa por adelante (abajo de la vuelta) e inclinada hacia donde gira
    var scale = 0.82 + 0.18 * (Math.sin(angle) + 1) / 2;
    var tilt = -Math.sin(angle) * 10;
    // Mira hacia el lado al que vuela
    bird.classList.toggle("izquierda", Math.sin(angle) > 0);
    bird.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + tilt.toFixed(1) + "deg) scale(" + scale.toFixed(3) + ")";
    requestAnimationFrame(flyBird);
  }

  if (location.hash === "#admin") bird.hidden = true;
  else requestAnimationFrame(flyBird);

  // ===== Pétalos de rosa blancos que caen al abrir la tarjeta =====
  var petalCanvas = $("petalos");
  var petalCtx = petalCanvas.getContext("2d");
  var petals = [];
  var petalUntil = 0;
  var petalRunning = false;

  function resizePetals() {
    // Resolución limitada: los pétalos se ven igual y el celular trabaja mucho menos
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    petalCanvas.width = Math.round(window.innerWidth * dpr);
    petalCanvas.height = Math.round(window.innerHeight * dpr);
    petalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nuevoPetalo(arriba) {
    petals.push({
      x: Math.random() * window.innerWidth,
      y: arriba ? -20 - Math.random() * 60 : -Math.random() * window.innerHeight * 0.6,
      size: 11 + Math.random() * 11,
      vy: 70 + Math.random() * 60,
      sway: 18 + Math.random() * 30,
      swaySpeed: 0.8 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 1.6,
      flip: Math.random() * Math.PI * 2,
      vflip: 1.5 + Math.random() * 2.5,
      sprite: Math.random() < 0.5 ? 0 : 1
    });
  }

  // Un pétalo de rosa (redondeado, con una muesca arriba y la base angosta) dibujado una sola vez
  // en dos tonos; en cada cuadro solo se copia la imagen girada, sin recalcular sombra ni degradado.
  var PETAL_PX = 64;
  function crearSpritePetalo(medio, borde) {
    var cv = document.createElement("canvas");
    cv.width = cv.height = PETAL_PX;
    var ctx = cv.getContext("2d");
    var s = PETAL_PX * 0.42;
    ctx.translate(PETAL_PX / 2, PETAL_PX / 2 - 2);
    var g = ctx.createRadialGradient(-s * 0.15, -s * 0.2, s * 0.1, 0, 0, s);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.6, medio);
    g.addColorStop(1, borde);
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(120, 95, 70, .2)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.62);
    ctx.bezierCurveTo(-s * 0.75, s * 0.3, -s * 0.8, -s * 0.55, -s * 0.28, -s * 0.62);
    ctx.quadraticCurveTo(0, -s * 0.5, 0, -s * 0.4);
    ctx.quadraticCurveTo(0, -s * 0.5, s * 0.28, -s * 0.62);
    ctx.bezierCurveTo(s * 0.8, -s * 0.55, s * 0.75, s * 0.3, 0, s * 0.62);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(205, 185, 165, .35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.55);
    ctx.quadraticCurveTo(s * 0.05, 0, 0, -s * 0.35);
    ctx.stroke();
    return cv;
  }
  var petalSprites = null;

  function dibujarPetalo(p) {
    var k = p.size / (PETAL_PX * 0.42);
    var cos = Math.cos(p.rot);
    var sin = Math.sin(p.rot);
    var sx = Math.max(0.15, Math.abs(Math.cos(p.flip))) * k;
    petalCtx.setTransform(cos * sx * petalScale, sin * sx * petalScale, -sin * k * petalScale, cos * k * petalScale, p.x * petalScale, p.y * petalScale);
    petalCtx.drawImage(petalSprites[p.sprite], -PETAL_PX / 2, -PETAL_PX / 2);
  }
  var petalScale = 1;

  var petalLast = 0;
  var petalSpawn = 0;
  function animarPetalos(now) {
    var dt = Math.min((now - (petalLast || now)) / 1000, 0.05);
    petalLast = now;
    if (now < petalUntil) {
      petalSpawn += dt * 6;
      while (petalSpawn >= 1) { nuevoPetalo(true); petalSpawn--; }
    }
    petalCtx.setTransform(1, 0, 0, 1, 0, 0);
    petalCtx.clearRect(0, 0, petalCanvas.width, petalCanvas.height);
    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i];
      p.phase += p.swaySpeed * dt;
      p.y += p.vy * dt;
      p.x += Math.cos(p.phase) * p.sway * dt;
      p.rot += p.vrot * dt;
      p.flip += p.vflip * dt;
      if (p.y > window.innerHeight + 30) { petals.splice(i, 1); continue; }
      dibujarPetalo(p);
    }
    if (petals.length || now < petalUntil) requestAnimationFrame(animarPetalos);
    else { petalRunning = false; petalCanvas.hidden = true; }
  }

  function lanzarPetalos() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!petalSprites) petalSprites = [crearSpritePetalo("#FBF6F1", "#EADFD3"), crearSpritePetalo("#FDF8F8", "#F2E2E0")];
    resizePetals();
    petalScale = petalCanvas.width / window.innerWidth;
    petalCanvas.hidden = false;
    // Mientras se lee la tarjeta, los pétalos caen detrás de ella (alrededor del sobre)
    if (!leaving) door.insertBefore(petalCanvas, door.firstChild);
    for (var i = 0; i < 30; i++) nuevoPetalo(false);
    petalUntil = performance.now() + 6000;
    if (!petalRunning) {
      petalRunning = true;
      petalLast = 0;
      requestAnimationFrame(animarPetalos);
    }
  }
  window.addEventListener("resize", function () {
    if (!petalRunning) return;
    resizePetals();
    petalScale = petalCanvas.width / window.innerWidth;
  });

  // ===== Si alguien toca el pajarito: explota en plumas, deja una mancha de tinta en la hoja,
  // la mancha se desvanece y el pajarito vuelve volando desde arriba =====
  var explotado = false;
  var MANCHA_MS = 4500;   // cuánto queda la mancha antes de desvanecerse
  var VUELVE_MS = 5600;   // cuándo vuelve a aparecer el pajarito

  // Salpicadura de sangre: mancha central irregular, gotas alargadas que salen disparadas
  // y chorreados que bajan, con brillo húmedo. La forma es distinta cada vez.
  function manchaSVG() {
    var R = function (a, b) { return a + Math.random() * (b - a); };
    var pts = [], n = 18, i;
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, r = R(22, 38);
      pts.push([80 + Math.cos(a) * r, 80 + Math.sin(a) * r * 0.9]);
    }
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (i = 0; i < n; i++) {
      var p = pts[(i + 1) % n], q = pts[i];
      d += " Q" + (q[0] + R(-9, 9)).toFixed(1) + " " + (q[1] + R(-9, 9)).toFixed(1) + " " + p[0].toFixed(1) + " " + p[1].toFixed(1);
    }
    var extra = "";
    // gotas disparadas (alargadas, apuntando hacia afuera)
    for (i = 0; i < 14; i++) {
      var ang = R(0, Math.PI * 2), dist = R(44, 76), rr = R(1.6, 5.5);
      var gx = 80 + Math.cos(ang) * dist, gy = 80 + Math.sin(ang) * dist;
      extra += '<ellipse cx="' + gx.toFixed(1) + '" cy="' + gy.toFixed(1) + '" rx="' + (rr * R(1.2, 2.2)).toFixed(1) + '" ry="' + rr.toFixed(1) +
        '" transform="rotate(' + (ang * 180 / Math.PI).toFixed(0) + ' ' + gx.toFixed(1) + ' ' + gy.toFixed(1) + ')"/>';
    }
    // chorreados que caen desde abajo de la mancha
    var chorros = "";
    for (i = 0; i < 3; i++) {
      var x = R(62, 98), largo = R(30, 62), ancho = R(3, 6.5), y0 = R(98, 106);
      chorros += '<path class="chorro" style="animation-delay:' + R(.2, .7).toFixed(2) + 's" d="M' + (x - ancho / 2).toFixed(1) + ' ' + (y0 - 6).toFixed(1) +
        ' L' + (x - ancho / 2).toFixed(1) + ' ' + (y0 + largo).toFixed(1) + ' a' + (ancho / 2).toFixed(1) + ' ' + (ancho / 1.6).toFixed(1) + ' 0 0 0 ' + ancho.toFixed(1) + ' 0 L' +
        (x + ancho / 2).toFixed(1) + ' ' + (y0 - 6).toFixed(1) + ' Z"/>';
    }
    return '<svg viewBox="0 0 160 200" aria-hidden="true"><defs>' +
      '<radialGradient id="sangre" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#B3121C"/><stop offset=".6" stop-color="#8A0A12"/><stop offset="1" stop-color="#5C0409"/></radialGradient>' +
      '<filter id="humedo"><feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b"/><feSpecularLighting in="b" surfaceScale="3" specularConstant=".9" specularExponent="22" lighting-color="#fff" result="s">' +
      '<fePointLight x="40" y="20" z="90"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/>' +
      '<feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0"/></filter></defs>' +
      '<g filter="url(#humedo)" fill="url(#sangre)"><g class="chorros">' + chorros + '</g><path d="' + d + ' Z"/>' + extra + '</g></svg>';
  }

  function explotar(e) {
    e.preventDefault();
    e.stopPropagation();
    if (explotado) return;
    explotado = true;
    var r = bird.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    bird.classList.add("oculto");

    // mancha: queda pegada a la hoja (se mueve con la página al bajar)
    var mancha = document.createElement("div");
    mancha.className = "mancha";
    mancha.innerHTML = manchaSVG();
    var enSobre = !door.hidden;
    mancha.style.left = (cx + (enSobre ? 0 : window.scrollX)) + "px";
    mancha.style.top = (cy + (enSobre ? 0 : window.scrollY)) + "px";
    if (enSobre) mancha.style.position = "fixed";
    document.body.appendChild(mancha);
    setTimeout(function () { mancha.classList.add("seca"); }, MANCHA_MS);
    setTimeout(function () { mancha.remove(); }, MANCHA_MS + 1600);

    // plumitas que se le escapan: salen disparadas y después caen meciéndose despacio
    for (var i = 0; i < 12; i++) {
      var pl = document.createElement("span");
      pl.className = "pluma-pajaro";
      pl.innerHTML = '<svg viewBox="0 0 12 30"><path d="M6 29 C6 20 6 10 6 1" stroke="#7C8FA6" stroke-width=".7" fill="none"/>' +
        '<path d="M6 2 C10 6 11.5 13 10 20 C9 24 7.5 26 6 27 C4.5 26 3 24 2 20 C.5 13 2 6 6 2 Z" fill="' +
        ["#5B9BE0", "#8FC1F0", "#3E7FC6", "#EEF5FC"][i % 4] + '" fill-opacity=".95"/></svg>';
      pl.style.left = cx + "px";
      pl.style.top = cy + "px";
      document.body.appendChild(pl);
      var ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50;
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 20;
      var lado = Math.random() < .5 ? -1 : 1, caida = 160 + Math.random() * 140, giro = Math.random() * 360;
      var frames = [{ transform: "translate(-50%,-50%) rotate(" + giro + "deg)", opacity: 1 }];
      frames.push({ transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) rotate(" + (giro + 120) + "deg)", opacity: 1, offset: .15 });
      for (var k = 1; k <= 4; k++) {
        lado = -lado;
        frames.push({ transform: "translate(calc(-50% + " + (dx + lado * 22) + "px), calc(-50% + " + (dy + caida * k / 4) + "px)) rotate(" + (lado * 35) + "deg)",
          opacity: k === 4 ? 0 : 1, offset: .15 + .85 * k / 4 });
      }
      pl.animate(frames, { duration: 3200 + Math.random() * 1400, easing: "ease-in-out", fill: "forwards" });
      setTimeout((function (el) { return function () { el.remove(); }; })(pl), 4800);
    }

    // vuelve volando desde arriba de la pantalla
    setTimeout(function () {
      var t = orbitCenter();
      centerX = t[0];
      centerY = -120;
      explotado = false;
      bird.classList.remove("oculto");
    }, VUELVE_MS);
  }
  bird.addEventListener("click", explotar);

  // ===== Flores blancas alrededor del arco del cronograma =====
  // Se dibujan sobre el borde del arco (semicírculo arriba y lados rectos), más tupidas en la
  // corona y en las esquinas de abajo. Se rearman si cambia el ancho de la pantalla.
  var arco = document.querySelector(".timeline");
  function armarGuirnalda() {
    if (!arco) return;
    var viejas = arco.querySelectorAll(".flor-arco");
    for (var v = 0; v < viejas.length; v++) viejas[v].remove();
    var w = arco.offsetWidth, h = arco.offsetHeight, r = w / 2;
    var izq = h - r, arcoLargo = Math.PI * r, total = izq * 2 + arcoLargo;
    // punto del borde a una distancia s, recorriendo desde abajo a la izquierda
    function punto(s) {
      if (s < izq) return { x: 0, y: h - s, ang: -90 };
      s -= izq;
      if (s < arcoLargo) { var a = Math.PI - s / r; return { x: r + Math.cos(a) * r, y: r - Math.sin(a) * r, ang: -a * 180 / Math.PI }; }
      s -= arcoLargo;
      return { x: w, y: r + s, ang: 90 };
    }
    // cuánto se amontonan las flores según la zona: corona y esquinas de abajo
    function densidad(s) {
      var u = s / total, corona = Math.exp(-Math.pow((u - .5) / .09, 2)), esquinas = Math.exp(-Math.pow(u / .07, 2)) + Math.exp(-Math.pow((1 - u) / .07, 2));
      return .45 + corona * .55 + esquinas * .45;
    }
    var semilla = 7;
    function rnd() { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; }
    // Se arma la mitad izquierda y se copia en espejo a la derecha, así el arco queda parejo
    function poner(clase, html, x, y, tam, giro) {
      var el = document.createElement("span");
      el.className = "flor-arco" + (clase ? " " + clase : "");
      el.innerHTML = html;
      el.style.cssText = "left:" + x + "px;top:" + y + "px" + (tam ? ";width:" + tam + "px;height:" + tam + "px" : "") +
        (giro !== null ? ";transform:translate(-50%,-50%) rotate(" + giro + "deg) translateX(12px)" : "");
      arco.appendChild(el);
    }
    var s = 8, i = 0, mitad = total / 2;
    // flor blanca real (foto recortada); cada una gira distinto para que no se vean iguales
    while (s <= mitad) {
      var d = densidad(s), pt = punto(s), espejo = punto(total - s);
      var esCentro = mitad - s < 12;  // la flor de arriba de todo va una sola vez
      var tam = (esCentro ? 50 : 32 + rnd() * 10 + Math.min(d, 1.2) * 6);
      var rot = rnd() * 360;
      var html = '<img src="./assets/boda/flor-blanca.png" alt="" style="transform:rotate(' + rot.toFixed(1) + 'deg)">';
      var html2 = '<img src="./assets/boda/flor-blanca.png" alt="" style="transform:scaleX(-1) rotate(' + (-rot).toFixed(1) + 'deg)">';
      poner("lirio", html, pt.x, pt.y, tam, null);
      if (!esCentro) poner("lirio", html2, espejo.x, espejo.y, tam, null);
      s += 46 / Math.max(.6, d);
      i++;
    }
  }
  if (arco) {
    armarGuirnalda();
    var anchoArco = arco.offsetWidth;
    window.addEventListener("resize", function () { if (arco.offsetWidth !== anchoArco) { anchoArco = arco.offsetWidth; armarGuirnalda(); } });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(armarGuirnalda);
  }

})();
