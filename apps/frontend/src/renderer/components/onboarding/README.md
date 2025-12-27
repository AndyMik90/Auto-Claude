# Onboarding Wizard System

Das Wizard-System nutzt ein **schema-basiertes Auto-Discovery-Pattern**, das automatisch neue Schritte erkennt und integriert.

## Schnellstart: Neuen Wizard-Schritt hinzufügen

### 1. Step-Komponente erstellen

```tsx
// MyNewStep.tsx
import { WizardStepProps } from './wizard-step.schema';

export function MyNewStep({ onNext, onBack, onSkip }: WizardStepProps) {
  return (
    <div>
      <h2>Mein neuer Schritt</h2>
      {/* Dein Inhalt */}
      <button onClick={onBack}>Zurück</button>
      <button onClick={onNext}>Weiter</button>
    </div>
  );
}
```

### 2. Step im Registry registrieren

Öffne `wizard-registry.ts` und füge hinzu:

```typescript
// 1. Import hinzufügen (oben in der Datei)
// (Lazy loading wird automatisch verwendet)

// 2. Step-Definition erstellen
const myNewStep = defineWizardStep({
  id: 'myNewStep',
  priority: 250,  // Zwischen bestehenden Steps
  translationKey: 'steps.myNewStep',
  component: lazy(() => import('./MyNewStep').then(m => ({ default: m.MyNewStep }))),
  category: 'integration',
  showInProgress: true,
  icon: 'Settings',
  addedInVersion: '1.2.0'
});

// 3. Zur STEP_DEFINITIONS Array hinzufügen
const STEP_DEFINITIONS: WizardStepDefinition[] = [
  welcomeStep,
  oauthStep,
  myNewStep,  // <-- Hier hinzufügen
  memoryStep,
  completionStep,
];
```

### 3. Übersetzungen hinzufügen

In allen `locales/*/onboarding.json`:

```json
{
  "steps": {
    "myNewStep": "Mein Schritt"
  },
  "myNewStep": {
    "title": "Mein neuer Schritt",
    "description": "Beschreibung des Schritts"
  }
}
```

**Fertig!** Der Wizard zeigt den neuen Schritt automatisch an.

---

## Prioritäten-Schema

| Bereich | Priorität | Beschreibung |
|---------|-----------|--------------|
| Welcome | 0-99 | Willkommens-/Intro-Screens |
| Auth | 100-199 | Authentifizierung (OAuth, API-Keys) |
| Integration | 200-299 | Externe Dienste (GitHub, Linear) |
| Memory | 300-399 | Gedächtnis/Persistenz |
| Agent | 400-499 | Agent-Konfiguration |
| Completion | 900-999 | Abschluss-Screens |

## Bedingte Schritte

Schritte können basierend auf Bedingungen ein-/ausgeblendet werden:

```typescript
const conditionalStep = defineWizardStep({
  id: 'advancedMemory',
  priority: 320,
  translationKey: 'steps.advancedMemory',
  component: lazy(() => import('./AdvancedMemoryStep')),
  category: 'memory',
  showInProgress: true,
  // Nur anzeigen wenn Feature aktiviert
  condition: (ctx) => ctx.features?.advancedMemory === true
});
```

## Verfügbare Condition Context

```typescript
interface StepConditionContext {
  settings: Record<string, unknown>;  // App-Einstellungen
  isDev: boolean;                      // Entwicklungsmodus?
  platform: string;                    // 'Windows', 'macOS', 'Linux'
  features: Record<string, boolean>;   // Feature Flags
}
```

## Step-Kategorien

- `welcome` - Willkommens-Screens
- `auth` - Authentifizierung
- `integration` - Externe Dienste
- `memory` - Gedächtnis-Konfiguration
- `agent` - Agent-Einstellungen
- `completion` - Abschluss

## Debugging

```typescript
import { debugSteps } from './wizard-registry';

// In der Konsole alle registrierten Schritte anzeigen
debugSteps();
```
