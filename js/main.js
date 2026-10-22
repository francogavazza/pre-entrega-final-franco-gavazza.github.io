// ===== Datos del casamiento (editar acá) =====
const BODA = {
  fecha: new Date("2027-03-20T17:00:00-03:00"),
  whatsapp: "5491100000000", // número de los novios, sin + ni espacios
  eventos: {
    ceremonia: {
      titulo: "Ceremonia - Sofía & Franco",
      inicio: "20270320T200000Z",
      fin: "20270320T210000Z",
      lugar: "Parroquia Nuestra Señora del Pilar, Junín 1904, CABA",
    },
    fiesta: {
      titulo: "Fiesta - Sofía & Franco",
      inicio: "20270320T230000Z",
      fin: "20270321T070000Z",
      lugar: "Salón Los Jazmines, Av. del Libertador 4500, CABA",
    },
  },
  // Para usar fotos reales: agregá "img: './assets/img/archivo.jpg'" a cada foto
  fotos: [
    { texto: "El primer café", emoji: "☕", fondo: "linear-gradient(135deg,#e8cfc4,#c9a27e)" },
    { texto: "Patagonia 2020", emoji: "🏔️", fondo: "linear-gradient(135deg,#8a9a7b,#5d6b7a)" },
    { texto: "Nuestro hogar", emoji: "🏡", fondo: "linear-gradient(135deg,#f3ece2,#d8b4a6)" },
    { texto: "Atardeceres", emoji: "🌅", fondo: "linear-gradient(135deg,#d8b4a6,#7b4b52)" },
    { texto: "La propuesta", emoji: "💍", fondo: "linear-gradient(135deg,#c9a27e,#977547)" },
    { texto: "Con amigos", emoji: "🥂", fondo: "linear-gradient(135deg,#5d6b7a,#8a9a7b)" },
    { texto: "Domingos", emoji: "🌻", fondo: "linear-gradient(135deg,#f3e3b5,#c9a27e)" },
    { texto: "Para siempre", emoji: "💕", fondo: "linear-gradient(135deg,#e8cfc4,#a3454f)" },
  ],
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ===== Aviso flotante =====
let avisoTimer;
function mostrarAviso(texto) {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.classList.add("visible");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso.classList.remove("visible"), 2500);
}

// ===== Sobre de bienvenida =====
const sobre = $("#sobre");
document.body.classList.add("bloqueado");
$("#abrir-invitacion").addEventListener("click", () => {
  // 1) se rompe el sello y se abre la solapa, 2) sale la carta, 3) aparece la web
  sobre.classList.add("abierto");
  const espera = sinMovimiento ? 0 : 2600;
  setTimeout(() => {
    sobre.classList.add("saliendo");
    document.body.classList.remove("bloqueado");
    lanzarPetalos(70);
  }, espera);
  setTimeout(() => sobre.remove(), espera + 1100);
});

// ===== Menú =====
const header = $("#header");
const nav = $("#nav");
const toggle = $("#menu-toggle");

function cerrarMenu() {
  nav.classList.remove("abierto");
  toggle.classList.remove("abierto");
  header.classList.remove("menu-abierto");
  toggle.setAttribute("aria-expanded", "false");
}

toggle.addEventListener("click", () => {
  const abierto = nav.classList.toggle("abierto");
  toggle.classList.toggle("abierto", abierto);
  header.classList.toggle("menu-abierto", abierto);
  toggle.setAttribute("aria-expanded", String(abierto));
});
$$(".nav__link").forEach((link) => link.addEventListener("click", cerrarMenu));

window.addEventListener("scroll", () => {
  header.classList.toggle("scrolleado", window.scrollY > 60);
}, { passive: true });

// Resalta el link de la sección visible
const observadorSecciones = new IntersectionObserver((entradas) => {
  entradas.forEach((entrada) => {
    if (!entrada.isIntersecting) return;
    $$(".nav__link").forEach((link) => {
      link.classList.toggle("activo", link.getAttribute("href") === `#${entrada.target.id}`);
    });
  });
}, { rootMargin: "-50% 0px -50% 0px" });
$$("main section[id]").forEach((s) => observadorSecciones.observe(s));

// ===== Cuenta regresiva =====
function actualizarCuenta() {
  const resto = Math.max(0, BODA.fecha - Date.now());
  const s = Math.floor(resto / 1000);
  $("#dias").textContent = Math.floor(s / 86400);
  $("#horas").textContent = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  $("#minutos").textContent = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  $("#segundos").textContent = String(s % 60).padStart(2, "0");
  if (resto === 0) {
    $("#cuenta-regresiva").innerHTML = '<p class="hero__fecha">¡Hoy es el gran día! 🎉</p>';
    clearInterval(intervaloCuenta);
  }
}
const intervaloCuenta = setInterval(actualizarCuenta, 1000);
actualizarCuenta();

// ===== Animaciones al hacer scroll =====
const observadorRevelar = new IntersectionObserver((entradas, obs) => {
  entradas.forEach((entrada) => {
    if (entrada.isIntersecting) {
      entrada.target.classList.add("visible");
      obs.unobserve(entrada.target);
    }
  });
}, { threshold: 0.15 });
$$(".revelar").forEach((el) => observadorRevelar.observe(el));

// ===== Agendar en calendario (.ics) =====
$$("[data-calendario]").forEach((boton) => {
  boton.addEventListener("click", () => {
    const ev = BODA.eventos[boton.dataset.calendario];
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Casamiento//ES",
      "BEGIN:VEVENT",
      `UID:${boton.dataset.calendario}-${ev.inicio}@casamiento`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${ev.inicio}`,
      `DTEND:${ev.fin}`,
      `SUMMARY:${ev.titulo}`,
      `LOCATION:${ev.lugar.replace(/,/g, "\\,")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${boton.dataset.calendario}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// ===== Galería + visor =====
const galeria = $("#galeria");
BODA.fotos.forEach((foto, i) => {
  const item = document.createElement("button");
  item.className = "galeria__item revelar";
  item.dataset.texto = foto.texto;
  item.setAttribute("aria-label", `Ver foto: ${foto.texto}`);
  item.style.backgroundImage = foto.img ? `url("${foto.img}")` : foto.fondo;
  if (!foto.img) item.innerHTML = `<span class="emoji">${foto.emoji}</span>`;
  item.addEventListener("click", () => abrirVisor(i));
  galeria.appendChild(item);
  observadorRevelar.observe(item);
});

const visor = $("#visor");
let fotoActual = 0;

function mostrarFoto(i) {
  fotoActual = (i + BODA.fotos.length) % BODA.fotos.length;
  const foto = BODA.fotos[fotoActual];
  const img = $("#visor-img");
  img.style.backgroundImage = foto.img ? `url("${foto.img}")` : foto.fondo;
  img.textContent = foto.img ? "" : foto.emoji;
  $("#visor-texto").textContent = foto.texto;
}

function abrirVisor(i) {
  mostrarFoto(i);
  visor.hidden = false;
  document.body.classList.add("bloqueado");
}

function cerrarVisor() {
  visor.hidden = true;
  document.body.classList.remove("bloqueado");
}

$(".visor__cerrar").addEventListener("click", cerrarVisor);
$(".visor__nav--prev").addEventListener("click", () => mostrarFoto(fotoActual - 1));
$(".visor__nav--next").addEventListener("click", () => mostrarFoto(fotoActual + 1));
visor.addEventListener("click", (e) => { if (e.target === visor) cerrarVisor(); });
document.addEventListener("keydown", (e) => {
  if (visor.hidden) return;
  if (e.key === "Escape") cerrarVisor();
  if (e.key === "ArrowLeft") mostrarFoto(fotoActual - 1);
  if (e.key === "ArrowRight") mostrarFoto(fotoActual + 1);
});

// Deslizar en celulares
let toqueX = null;
visor.addEventListener("touchstart", (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
visor.addEventListener("touchend", (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX;
  if (Math.abs(dx) > 50) mostrarFoto(fotoActual + (dx < 0 ? 1 : -1));
  toqueX = null;
});

// ===== Copiar datos bancarios =====
$$("[data-copiar]").forEach((boton) => {
  boton.addEventListener("click", async () => {
    const texto = $(`#${boton.dataset.copiar}`).textContent;
    try {
      await navigator.clipboard.writeText(texto);
      mostrarAviso(`Copiado: ${texto}`);
    } catch (e) {
      mostrarAviso("No se pudo copiar, copialo manualmente");
    }
  });
});

// ===== Formulario de confirmación =====
const form = $("#form-rsvp");
const confirmacion = $("#confirmacion");
const inputInvitados = $("#invitados");

$$(".contador button").forEach((boton) => {
  boton.addEventListener("click", () => {
    const valor = Number(inputInvitados.value) + Number(boton.dataset.paso);
    inputInvitados.value = Math.min(Number(inputInvitados.max), Math.max(Number(inputInvitados.min), valor));
  });
});

$$('input[name="asistencia"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    form.classList.toggle("no-asiste", radio.value === "no" && radio.checked);
  });
});

function marcarError(campo, mensaje) {
  campo.classList.toggle("error", Boolean(mensaje));
  $(".campo__error", campo).textContent = mensaje || "";
}

function mostrarConfirmacion(datos) {
  const asiste = datos.asistencia === "si";
  $("#confirmacion-titulo").textContent = asiste ? `¡Gracias, ${datos.nombre}!` : `Te vamos a extrañar, ${datos.nombre}`;
  $("#confirmacion-texto").textContent = asiste
    ? `Confirmaste ${datos.invitados} ${datos.invitados === "1" ? "lugar" : "lugares"} con menú ${datos.menu.toLowerCase()}. ¡Nos vemos en la pista!`
    : "Gracias por avisarnos. ¡Vamos a brindar por vos!";

  const mensaje = [
    `Hola! Soy ${datos.nombre}.`,
    asiste ? `Confirmo asistencia para ${datos.invitados} persona(s). Menú: ${datos.menu}.` : "Lamentablemente no voy a poder ir.",
    datos.cancion ? `Canción: ${datos.cancion}` : "",
    datos.mensaje ? `Mensaje: ${datos.mensaje}` : "",
  ].filter(Boolean).join("\n");
  $("#enviar-whatsapp").href = `https://wa.me/${BODA.whatsapp}?text=${encodeURIComponent(mensaje)}`;

  form.hidden = true;
  confirmacion.hidden = false;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(form));
  datos.nombre = (datos.nombre || "").trim();

  const campoNombre = $("#nombre").closest(".campo");
  const campoAsistencia = $('input[name="asistencia"]').closest(".campo");
  marcarError(campoNombre, datos.nombre.length < 3 ? "Ingresá tu nombre y apellido" : "");
  marcarError(campoAsistencia, datos.asistencia ? "" : "Elegí una opción");
  if (datos.nombre.length < 3 || !datos.asistencia) return;

  try { localStorage.setItem("rsvp", JSON.stringify(datos)); } catch (err) {}
  mostrarConfirmacion(datos);
  if (datos.asistencia === "si") lanzarPetalos(80);
});

$("#editar-rsvp").addEventListener("click", () => {
  confirmacion.hidden = true;
  form.hidden = false;
});

// Recupera una respuesta ya enviada
try {
  const guardado = JSON.parse(localStorage.getItem("rsvp"));
  if (guardado) {
    $("#nombre").value = guardado.nombre;
    $(`input[name="asistencia"][value="${guardado.asistencia}"]`).checked = true;
    form.classList.toggle("no-asiste", guardado.asistencia === "no");
    inputInvitados.value = guardado.invitados || 1;
    $("#menu").value = guardado.menu || "Estándar";
    $("#cancion").value = guardado.cancion || "";
    $("#mensaje").value = guardado.mensaje || "";
    mostrarConfirmacion(guardado);
  }
} catch (err) {}

// ===== Pétalos cayendo =====
const canvas = $("#petalos");
const ctx = canvas.getContext("2d");
const petalos = [];
const colores = ["#e8cfc4", "#d8b4a6", "#f3e3d9", "#c9a27e"];
const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let animando = false;

function ajustarCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", ajustarCanvas);
ajustarCanvas();

function lanzarPetalos(cantidad) {
  if (sinMovimiento) return;
  for (let i = 0; i < cantidad; i++) {
    petalos.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      tam: 6 + Math.random() * 8,
      vel: 1 + Math.random() * 2,
      giro: Math.random() * Math.PI,
      vGiro: (Math.random() - 0.5) * 0.05,
      osc: Math.random() * Math.PI * 2,
      color: colores[Math.floor(Math.random() * colores.length)],
    });
  }
  if (!animando) {
    animando = true;
    requestAnimationFrame(animarPetalos);
  }
}

function animarPetalos() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = petalos.length - 1; i >= 0; i--) {
    const p = petalos[i];
    p.y += p.vel;
    p.osc += 0.02;
    p.x += Math.sin(p.osc) * 0.8;
    p.giro += p.vGiro;
    if (p.y > canvas.height + 20) {
      petalos.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.giro);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.tam, p.tam / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (petalos.length) {
    requestAnimationFrame(animarPetalos);
  } else {
    animando = false;
  }
}

// Pétalos al tocar los nombres
$(".hero__nombres").addEventListener("click", () => lanzarPetalos(40));
