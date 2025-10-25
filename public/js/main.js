// Manejo básico de formularios: capturar errores y mostrar mensajes.
// Si usas fetch en el futuro, este archivo también puede adaptarse.

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      // formulario tradicional; dejamos que el servidor redirija o devuelva un HTML
      // también podríamos convertir a fetch si queremos respuestas JSON
      const errEl = document.getElementById('error');
      if (errEl) errEl.textContent = '';
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      const errEl = document.getElementById('regError');
      if (errEl) errEl.textContent = '';
    });
  }
});