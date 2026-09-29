(function () {
  var deferredPrompt = null;
  var banner = document.getElementById('installBanner');
  var installBtn = document.getElementById('installBtn');
  var installClose = document.getElementById('installClose');
  var installHint = document.getElementById('installHint');
  var installModal = document.getElementById('installModal');
  var headerInstallBtn = document.getElementById('headerInstallBtn');

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isIOSChrome = isIOS && /CriOS/i.test(navigator.userAgent);
  var isIOSFirefox = isIOS && /FxiOS/i.test(navigator.userAgent);
  var isInAppBrowser = /Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(navigator.userAgent);
  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function hideBanner() {
    if (banner) banner.classList.remove('show');
  }

  function showBanner() {
    if (banner && !isStandalone) banner.classList.add('show');
  }

  function setHint(text) {
    if (installHint) installHint.textContent = text;
  }

  function showInstallModal() {
    if (installModal) installModal.classList.add('show');
  }

  function hideInstallModal() {
    if (installModal) installModal.classList.remove('show');
  }

  function getInstallSteps() {
    if (isInAppBrowser) {
      return [
        'Estás en un navegador interno (Instagram, WhatsApp, etc.).',
        'Abrí la página en Chrome o Safari.',
        'Luego instalá desde el menú del navegador.'
      ];
    }
    if (isIOSChrome || isIOSFirefox) {
      return [
        'En iPhone usá Safari.',
        'Compartir (↑) → Agregar a pantalla de inicio.',
        'Confirmá con Agregar.'
      ];
    }
    if (isIOS) {
      return [
        'Safari → Compartir (↑) → Agregar a pantalla de inicio.',
        'Confirmá con Agregar.'
      ];
    }
    if (isAndroid) {
      return [
        'Usá Google Chrome (no incógnito, no Samsung Internet).',
        'Borrá accesos directos viejos de Tu Rutina.',
        'Chrome → Configuración → Configuración de sitios → aalonso008.github.io → Borrar y restablecer.',
        'Volvé a https://aalonso008.github.io/ y esperá 30 segundos.',
        'Menú (⋮) → Instalar app (debe decir "Instalar app", no solo acceso directo).'
      ];
    }
    return ['Chrome o Edge → Instalar app.'];
  }

  function renderInstallSteps() {
    var list = document.getElementById('installSteps');
    if (!list) return;
    list.innerHTML = getInstallSteps()
      .map(function (step) {
        return '<li>' + step + '</li>';
      })
      .join('');
  }

  function setupMobileInstructions() {
    if (isStandalone) return;
    if (isIOS) {
      if (installBtn) installBtn.style.display = 'none';
      setHint('Safari → Compartir → Agregar a pantalla de inicio');
    } else if (isAndroid) {
      setHint('Chrome normal → Menú (⋮) → Instalar app');
    }
    showBanner();
  }

  function tryInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
      });
      return;
    }
    renderInstallSteps();
    showInstallModal();
    showBanner();
  }

  function cleanupOldWorkers() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) {
        if (reg.scope.indexOf('miturina') !== -1) reg.unregister();
      });
    });
  }

  function checkInstallReady() {
    if (isStandalone || !isAndroid) return;
    if (!('serviceWorker' in navigator)) {
      setHint('Tu navegador no soporta apps instalables. Usá Chrome.');
      showBanner();
      return;
    }
    navigator.serviceWorker.getRegistration('/').then(function (reg) {
      if (!reg || !reg.active) {
        setHint('Esperá unos segundos a que cargue la app…');
        showBanner();
      }
    });
  }

  cleanupOldWorkers();

  if (!isStandalone) {
    setTimeout(setupMobileInstructions, 1500);
    setTimeout(checkInstallReady, 4000);
  } else {
    hideBanner();
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    return;
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn) {
      installBtn.style.display = '';
      installBtn.textContent = 'Instalar';
    }
    setHint('Listo: tocá Instalar para modo app');
    showBanner();
  });

  if (installBtn) installBtn.addEventListener('click', tryInstall);
  if (headerInstallBtn) headerInstallBtn.addEventListener('click', tryInstall);
  if (installClose) installClose.addEventListener('click', hideBanner);

  var modalClose = document.getElementById('installModalClose');
  if (modalClose) modalClose.addEventListener('click', hideInstallModal);

  if (installModal) {
    installModal.addEventListener('click', function (e) {
      if (e.target === installModal) hideInstallModal();
    });
  }

  window.addEventListener('appinstalled', function () {
    hideBanner();
    hideInstallModal();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (window.__reloadingForSw) return;
      window.__reloadingForSw = true;
      window.location.reload();
    });
    navigator.serviceWorker.getRegistration().then(function (registration) {
      if (!registration) return;
      if (registration.waiting) showUpdate(registration);
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
        });
      });
    });
  }

  function showUpdate(registration) {
    var bar = document.getElementById('updateBanner');
    if (!bar) return;
    bar.hidden = false;
    var button = document.getElementById('updateNow');
    if (button) {
      button.onclick = function () {
        if (registration.waiting) registration.waiting.postMessage('skip-waiting');
      };
    }
  }
})();
