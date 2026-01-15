# Файлы для удаления из форка

## Можно безопасно удалить:

### 1. Файлы для контрибьюторов оригинального проекта
- `CLA.md` - соглашение о вкладе (не нужно для форка)
- `CONTRIBUTING.md` - правила контрибуции в оригинальный проект
- `.github/` - GitHub Actions и шаблоны оригинального проекта

### 2. Документация релизов оригинального проекта
- `CHANGELOG.md` - история изменений оригинала
- `RELEASE.md` - процесс релизов оригинала

### 3. Скрипты для оригинального проекта
- `scripts/bump-version.js`
- `scripts/cleanup-version-branches.sh`
- `scripts/validate-release.js`
- `scripts/ai-pr-reviewer.md`

### 4. Тестовые файлы
- ⚠️ **НЕ РЕКОМЕНДУЕТСЯ УДАЛЯТЬ** - тесты помогают проверить работоспособность
- `batch_test.json` - можно удалить, если не используете batch-тестирование

### 5. Конфигурация CI/CD оригинала
- `.github/workflows/` (внутри .github)
- `.husky/` - git hooks для разработки

### 6. Примеры конфигураций
- `.secretsignore.example`
- `apps/backend/.auto-claude/config.example.json`
- `apps/frontend/.env.example` (если не нужны)

### 7. Дизайн-система (если не используете)
- `.design-system/` - вся папка

### 8. Документация разработчика
- ⚠️ **РЕКОМЕНДУЕТСЯ СОХРАНИТЬ** - документация помогает понять как работает проект
- `guides/` - полезные гайды по использованию
- `shared_docs/` - техническая документация

## ОБЯЗАТЕЛЬНО СОХРАНИТЬ:

### ✅ Юридически необходимые файлы:
- `LICENSE` - **ОБЯЗАТЕЛЬНО** (AGPL-3.0)
- Упоминание оригинального проекта в README

### ✅ Основные файлы проекта:
- `README.md` - обновите под свой форк
- `.gitignore`
- `package.json` и зависимости
- `apps/backend/` - основной код
- `apps/frontend/` - основной код

## Рекомендации:

1. **Обновите README.md:**
   - Укажите, что это форк
   - Добавьте ссылку на оригинал: https://github.com/AndyMik90/Auto-Claude
   - Опишите ваши изменения

2. **Сохраните LICENSE:**
   - Не изменяйте файл LICENSE
   - Добавьте свое имя в список авторов модификаций (если делаете значительные изменения)

3. **Создайте свой CHANGELOG.md:**
   - Начните с чистого листа для ваших изменений

## Команды для удаления:

```bash
# Удалить файлы контрибьюторов
rm CLA.md CONTRIBUTING.md RELEASE.md CHANGELOG.md

# Удалить скрипты релизов
rm scripts/bump-version.js scripts/cleanup-version-branches.sh scripts/validate-release.js scripts/ai-pr-reviewer.md

# Удалить batch_test.json (если не используете)
rm batch_test.json

# Удалить дизайн-систему (если не используете)
rm -rf .design-system/

# Удалить git hooks разработки
rm -rf .husky/

# Удалить примеры конфигов
rm .secretsignore.example apps/backend/.auto-claude/config.example.json

# Документацию и тесты лучше СОХРАНИТЬ
# rm -rf guides/ shared_docs/  # НЕ УДАЛЯЙТЕ
# rm -rf tests/  # НЕ УДАЛЯЙТЕ

# Коммит изменений
git add -A
git commit -m "Очистка форка: удалены файлы оригинального проекта"
```
