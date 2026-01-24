#!/bin/bash
# Script de synchronisation avec le projet original Auto-Claude
# Ce script récupère les mises à jour de l'upstream tout en préservant l'UI web

set -e

echo "🔄 Synchronisation avec upstream (AndyMik90/Auto-Claude)..."

# 1. Fetch les mises à jour de l'upstream
echo "📥 Récupération des mises à jour upstream..."
git fetch upstream

# 2. Vérifier la branche actuelle
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Branche actuelle: $CURRENT_BRANCH"

# 3. Créer une branche de merge temporaire
MERGE_BRANCH="upstream-merge-$(date +%Y%m%d-%H%M%S)"
echo "🌿 Création de la branche de merge: $MERGE_BRANCH"
git checkout -b "$MERGE_BRANCH"

# 4. Merge les changements upstream
echo "🔀 Merge des changements upstream (develop)..."
if git merge upstream/develop --no-edit; then
    echo "✅ Merge réussi sans conflits!"
else
    echo ""
    echo "⚠️  CONFLITS DÉTECTÉS!"
    echo ""
    echo "Les fichiers suivants sont en conflit:"
    git diff --name-only --diff-filter=U
    echo ""
    echo "📝 Instructions pour résoudre les conflits:"
    echo "   1. Éditez les fichiers en conflit"
    echo "   2. Pour les fichiers dans apps/web/, privilégiez VOS changements (l'UI web)"
    echo "   3. Pour les autres fichiers, évaluez au cas par cas"
    echo "   4. Après résolution: git add . && git commit"
    echo "   5. Puis: git checkout develop && git merge $MERGE_BRANCH"
    echo ""
    echo "💡 Pour annuler le merge: git merge --abort"
    exit 1
fi

# 5. Retourner sur develop et merger
echo "🔀 Merge sur develop..."
git checkout develop
git merge "$MERGE_BRANCH" --no-edit

# 6. Supprimer la branche temporaire
git branch -d "$MERGE_BRANCH"

# 7. Afficher le résumé
echo ""
echo "✅ Synchronisation terminée!"
echo ""
echo "📊 Résumé:"
git log --oneline upstream/develop..HEAD | head -10
echo ""
echo "📤 Pour pusher les changements: git push origin develop"
