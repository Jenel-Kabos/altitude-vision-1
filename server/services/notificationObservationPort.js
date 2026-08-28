// Port local et étroit entre l'infrastructure Notification et ses
// observateurs applicatifs. Il ne connaît ni CRM, ni modèle, ni transport.
// Un seul observateur est autorisé : cela rend une double initialisation
// visible et évite l'accumulation silencieuse de listeners en hot reload/tests.
let observer = null;

function registerNotificationObserver(handler) {
  if (typeof handler !== 'function') throw new TypeError('Notification observer must be a function.');
  if (observer && observer !== handler) throw new Error('A notification observer is already registered.');
  observer = handler;
  return () => {
    if (observer === handler) observer = null;
  };
}

function publishNotificationObserved(event) {
  if (!observer) return Promise.resolve([]);
  // Contrat historique : exécution au microtask suivant, best-effort et sans
  // propagation d'erreur vers notificationService.notify().
  return Promise.resolve().then(() => observer(event)).catch(() => []);
}

module.exports = { registerNotificationObserver, publishNotificationObserved };
