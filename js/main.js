(function () {
  // ===== Datos de la boda (editar acá) =====
  var MUSIC_SRC = "./assets/boda/musica.mp3"; // El Danubio Azul, Johann Strauss (dominio público), vals de cuento
  var TARGET = new Date(2027, 0, 21, 0, 0, 0); // cuenta regresiva hasta el 21/01/2027 a las 00:00
  // Número de WhatsApp que recibe las confirmaciones cuando la página está en GitHub Pages
  // (sin + ni espacios, ej.: "5492914000000"). Vacío: el invitado elige a quién mandarlo.
  var WHATSAPP = "5492931420208";
  // Link de la invitación publicada en Claude (ahí las confirmaciones se guardan en su base)
  var ARTIFACT_URL = "https://claude.ai/artifact/EhYXrakUV9p9SFZaMFQmXk";

  var $ = function (id) { return document.getElementById(id); };
  var hasClaude = !!(window.claude && window.claude.use);

  // ===== Sobre: al tocar el sello se abre, sale la tarjeta y empieza la música =====
  var door = $("door");
  var audio = $("music");
  var musicBtn = $("music-btn");
  var musicOn = false;

  audio.src = MUSIC_SRC;
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
      })
      .catch(function (err) {
        btn.disabled = false;
        if (err && err.code === "quota_exceeded") setStatus("Ya no hay lugar para más confirmaciones. Escribinos directamente.", true);
        else setStatus("No se pudo guardar. Revisá la conexión e intentá de nuevo.", true);
      });
  }

  // En GitHub Pages (sin base de datos): se arma el mensaje y se manda por WhatsApp
  function submitStatic() {
    if (!validate()) return;
    var count = countPeople();
    var asiste = getAnswer();
    var names = $("hogar").value.trim();
    var text = asiste === "si"
      ? "¡Hola Fran y Sofi! Confirmamos asistencia a la ceremonia y cena del 22 de enero (" + plural(count) + "):\n" + names
      : "¡Hola Fran y Sofi! Lamentablemente no vamos a poder asistir a la ceremonia y cena del 22 de enero:\n" + names;
    try { localStorage.setItem("rsvp-fran-sofi", JSON.stringify({ hogar: names, asiste: asiste })); } catch (e) {}
    showDone(count, asiste);
    window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text), "_blank", "noopener");
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
})();
