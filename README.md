# Auto Claude Web UI

**Fork web de [Auto-Claude](https://github.com/AndyMik90/Auto-Claude) - Interface web pour l'exécution autonome de tâches avec Claude.**

[![License](https://img.shields.io/badge/license-AGPL--3.0-green?style=flat-square)](./agpl-3.0.txt)
[![Upstream](https://img.shields.io/badge/upstream-AndyMik90%2FAuto--Claude-blue?style=flat-square)](https://github.com/AndyMik90/Auto-Claude)

---

## Qu'est-ce que c'est ?

Ce projet est un **fork web** du projet Auto-Claude original. L'interface Electron desktop a été convertie en une **application web** accessible via navigateur, permettant :

- Accès depuis n'importe quel appareil sur le réseau local
- Pas d'installation d'application desktop nécessaire
- Même fonctionnalités que la version desktop

---

## Différences avec l'original

| Aspect | Auto-Claude (original) | Auto-Claude Web UI (ce fork) |
|--------|------------------------|------------------------------|
| **Interface** | Application Electron desktop | Application web (React + Vite) |
| **Accès** | Installation locale requise | Navigateur web |
| **Backend** | IPC Electron | WebSocket server |
| **Déploiement** | Téléchargement .exe/.dmg/.AppImage | `npm run dev` |

---

## Prérequis

- **Node.js 18+** ou **Bun**
- **Python 3.11+** avec venv
- **Claude Pro/Max subscription** - [Obtenir ici](https://claude.ai/upgrade)
- **Claude Code CLI** - `npm install -g @anthropic-ai/claude-code`
- **Git repository** - Votre projet doit être initialisé comme repo git

---

## Installation

```bash
# Cloner le repo
git clone https://github.com/VOTRE_USERNAME/auto-claude-webui.git
cd auto-claude-webui

# Installer les dépendances frontend
cd apps/web
npm install

# Installer les dépendances backend
cd ../backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate sur Windows
pip install -r requirements.txt
```

---

## Démarrage rapide

### 1. Lancer le backend WebSocket

```bash
cd apps/backend
source .venv/bin/activate
export CORS_ORIGINS="http://localhost:5173,http://VOTRE_IP:5173"
python web_server.py
```

### 2. Lancer le frontend web

```bash
cd apps/web
npm run dev -- --host
```

### 3. Accéder à l'interface

Ouvrir `http://localhost:5173` ou `http://VOTRE_IP:5173` dans un navigateur.

---

## Structure du projet

```
auto-claude-webui/
├── apps/
│   ├── backend/     # Python agents, specs, QA pipeline, WebSocket server
│   ├── web/         # Interface web React (remplace frontend Electron)
│   └── frontend/    # (Original) Electron desktop application
├── guides/          # Documentation additionnelle
├── tests/           # Suite de tests
├── scripts/         # Utilitaires de build
└── README.md        # Ce fichier
```

---

## Synchronisation avec l'upstream

Ce fork peut être synchronisé avec le projet original pour récupérer les nouvelles fonctionnalités :

```bash
# Ajouter l'upstream (une seule fois)
git remote add upstream https://github.com/AndyMik90/Auto-Claude.git

# Synchroniser
./scripts/sync-upstream.sh
```

Le script gère automatiquement les conflits potentiels en privilégiant les changements de l'UI web.

---

## Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| **Tâches autonomes** | Décrivez votre objectif ; les agents gèrent la planification, l'implémentation et la validation |
| **Exécution parallèle** | Exécutez plusieurs builds simultanément avec jusqu'à 12 terminaux d'agents |
| **Workspaces isolés** | Tous les changements se font dans des git worktrees - votre branche principale reste safe |
| **QA auto-validante** | Boucle de qualité intégrée qui détecte les problèmes avant votre review |
| **Merge IA** | Résolution automatique des conflits lors de l'intégration vers main |
| **Couche mémoire** | Les agents conservent les insights entre sessions pour des builds plus intelligents |
| **Intégration GitHub/GitLab** | Importer des issues, investiguer avec l'IA, créer des merge requests |

---

## Sécurité

Auto Claude utilise un modèle de sécurité à trois couches :

1. **Sandbox OS** - Les commandes Bash s'exécutent en isolation
2. **Restrictions filesystem** - Opérations limitées au répertoire du projet
3. **Allowlist dynamique** - Seules les commandes approuvées selon la stack détectée

---

## Projet original

Ce fork est basé sur [Auto-Claude](https://github.com/AndyMik90/Auto-Claude) par [@AndyMik90](https://github.com/AndyMik90).

- **Discord** - [Rejoindre la communauté](https://discord.gg/KCXaPBr4Dj)
- **YouTube** - [S'abonner](https://www.youtube.com/@AndreMikalsen)

---

## Licence

**AGPL-3.0** - GNU Affero General Public License v3.0

Auto Claude est gratuit. Si vous le modifiez et le distribuez, ou l'exécutez comme service, votre code doit également être open source sous AGPL-3.0.
