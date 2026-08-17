#!/bin/bash
# MOB-E2E-2 — lancement déterministe pré-Maestro.
#
# Cause racine du menu développeur Expo Dev Client : `dumpsys window windows`
# révèle qu'il s'agit d'une VRAIE fenêtre Android additionnelle empilée sur
# MainActivity (2 entrées "Window # ... MainActivity" au lieu d'1 seule),
# pas d'un élément dans l'arbre React Native — donc invisible à Maestro et
# non détectable en attendant un texte JS (confirmé : l'attente d'un texte
# rendu par React reste bloquée tant que cette fenêtre est présente, preuve
# que la fenêtre elle-même intercepte l'arbre, pas seulement l'affichage).
#
# Ce script utilise le compte de fenêtres "MainActivity" comme signal fiable
# et vérifiable par ADB (pas un sleep arbitraire) : tant qu'il y a 2 fenêtres,
# le tooltip est là ; dès qu'il retombe à 1, l'app est dans un état stable et
# utilisable par Maestro.
set -e
PACKAGE="com.altitudevision.altimmo"
DEEPLINK="exp+altimmo-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"

window_count() {
  adb shell dumpsys window windows 2>/dev/null | grep -c "^  Window #.*MainActivity" || true
}

adb shell am force-stop "$PACKAGE"
adb shell am start -a android.intent.action.VIEW -d "$DEEPLINK" > /dev/null

# Attend que MainActivity existe (>=1 fenêtre), jusqu'à 20s — condition
# réelle (le process a démarré et l'activité est créée), pas un délai fixe.
for i in $(seq 1 20); do
  count=$(window_count)
  if [ "${count:-0}" -ge 1 ]; then break; fi
  sleep 1
done

# Le tooltip apparaît de façon asynchrone APRÈS la création de l'activité
# (le bundle JS doit finir de charger et le module natif du Dev Client doit
# s'enregistrer) — observé entre <1s et >10s selon la charge de la machine
# (mesuré empiriquement jusqu'à ~10s pendant le diagnostic de ce sprint).
# Une lecture précoce à "1 fenêtre" ne prouve donc pas son absence
# définitive. Boucle de 35s : dissout le tooltip dès qu'il apparaît, ne
# déclare l'état prêt qu'après 12 LECTURES CONSÉCUTIVES à 1 fenêtre (~12s
# sans réapparition, marge au-delà du délai maximal observé) — condition
# vérifiée à chaque itération, pas un délai fixe unique.
stable_reads=0
for i in $(seq 1 35); do
  count=$(window_count)
  if [ "${count:-0}" -ge 2 ]; then
    adb shell input tap 450 1349
    stable_reads=0
  else
    stable_reads=$((stable_reads + 1))
  fi
  if [ "$stable_reads" -ge 12 ]; then
    echo "MOB_E2E_PRELAUNCH_READY windows=$count attempt=$i"
    exit 0
  fi
  sleep 1
done

echo "MOB_E2E_PRELAUNCH_TIMEOUT windows=$(window_count)"
exit 1
