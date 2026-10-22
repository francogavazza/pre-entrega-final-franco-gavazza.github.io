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
  var SHEET_URL = "";

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

  function openDoor() {
    if (door.classList.contains("open")) return;
    door.classList.add("open", "opening");
    document.querySelector(".kicker-big").classList.add("go");
    document.querySelector(".pen-wrap").classList.add("go");
    document.body.classList.remove("locked");
    setMusic(true);
    setTimeout(lanzarPetalos, 900);
    setTimeout(function () { door.hidden = true; }, 6600);
  }
  $("open-door").addEventListener("click", openDoor);
  door.addEventListener("click", function (e) { if (e.target === door) openDoor(); });
  document.body.classList.add("locked");
  if (location.hash !== "#admin") document.querySelector(".kicker-big").classList.add("write");

  // ===== Cuenta regresiva (días y horas), se actualiza cada minuto =====
  function tick() {
    var ms = TARGET - new Date();
    if (ms <= 0) return;
    $("cd-d").textContent = Math.floor(ms / 86400000);
    $("cd-h").textContent = Math.floor((ms % 86400000) / 3600000);
  }
  tick();
  setInterval(tick, 60000);

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

  function showDone(count, asiste) {
    $("send").textContent = "Cambiar respuesta";
    $("done").classList.add("show");
    $("done-msg").textContent = asiste === "no"
      ? "Anotamos que no van a poder asistir. ¡Gracias por avisarnos!"
      : "Anotamos tu respuesta para " + plural(count) + " en la ceremonia y cena.";
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
      ? "¡Hola Fran y Sofi! Confirmamos asistencia a la ceremonia y cena del 22 de enero (" + plural(count) + "):\n" + names
      : "¡Hola Fran y Sofi! Lamentablemente no vamos a poder asistir a la ceremonia y cena del 22 de enero:\n" + names;
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  // En GitHub Pages (sin base de datos): se anota en la planilla o, si no hay planilla, se manda por WhatsApp
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

  if (hasClaude) {
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
      $("card-names").textContent = names;
      $("card-names").hidden = false;
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
      el = door.classList.contains("open") ? document.querySelector(".env-card .kicker-big") : $("open-door");
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
    var dpr = window.devicePixelRatio || 1;
    petalCanvas.width = window.innerWidth * dpr;
    petalCanvas.height = window.innerHeight * dpr;
    petalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nuevoPetalo(arriba) {
    var size = 11 + Math.random() * 11;
    petals.push({
      x: Math.random() * window.innerWidth,
      y: arriba ? -20 - Math.random() * 60 : -Math.random() * window.innerHeight * 0.6,
      size: size,
      vy: 38 + Math.random() * 46,
      sway: 18 + Math.random() * 30,
      swaySpeed: 0.8 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 1.6,
      flip: Math.random() * Math.PI * 2,
      vflip: 1.5 + Math.random() * 2.5,
      tint: Math.random()
    });
  }

  // Un pétalo de rosa: redondeado, con una muesca arriba y la base angosta
  function dibujarPetalo(p) {
    var s = p.size;
    var ctx = petalCtx;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(Math.max(0.15, Math.abs(Math.cos(p.flip))), 1);
    var g = ctx.createRadialGradient(-s * 0.15, -s * 0.2, s * 0.1, 0, 0, s);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.6, p.tint > 0.5 ? "#FBF6F1" : "#FDF8F8");
    g.addColorStop(1, p.tint > 0.5 ? "#EADFD3" : "#F2E2E0");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(120, 95, 70, .18)";
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
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.55);
    ctx.quadraticCurveTo(s * 0.05, 0, 0, -s * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  var petalLast = 0;
  var petalSpawn = 0;
  function animarPetalos(now) {
    var dt = Math.min((now - (petalLast || now)) / 1000, 0.05);
    petalLast = now;
    if (now < petalUntil) {
      petalSpawn += dt * 6;
      while (petalSpawn >= 1) { nuevoPetalo(true); petalSpawn--; }
    }
    petalCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
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
    resizePetals();
    petalCanvas.hidden = false;
    for (var i = 0; i < 35; i++) nuevoPetalo(false);
    petalUntil = performance.now() + 8000;
    if (!petalRunning) {
      petalRunning = true;
      petalLast = 0;
      requestAnimationFrame(animarPetalos);
    }
  }
  window.addEventListener("resize", function () { if (petalRunning) resizePetals(); });

})();
