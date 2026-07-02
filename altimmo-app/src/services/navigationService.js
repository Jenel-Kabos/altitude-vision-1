import { createRef } from 'react';

// Ref partagée vers le NavigationContainer — permet de naviguer depuis n'importe quel service
export const navigationRef = createRef();

// Notification en attente reçue avant que la navigation soit prête (cold start)
let pendingNotification = null;

export function navigate(name, params) {
  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(name, params);
  } else {
    // On stocke et on navigue dès que le container est prêt
    pendingNotification = { name, params };
  }
}

// Appelé dans AppNavigator onReady()
export function flushPendingNavigation() {
  if (pendingNotification && navigationRef.current?.isReady()) {
    navigationRef.current.navigate(pendingNotification.name, pendingNotification.params);
    pendingNotification = null;
  }
}
