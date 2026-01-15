# Git Workflow - Шпаргалка

## Ваша текущая конфигурация

```
origin   → https://github.com/chucky23/idle.git (ваш форк)
upstream → https://github.com/AndyMik90/Auto-Claude.git (оригинал, push заблокирован)
```

## Ежедневная работа

### 1. Создание новой ветки для фичи
```bash
git checkout -b feature/language-config
```

### 2. Работа с изменениями
```bash
git add .
git commit -m "feat: add language configuration"
git push origin feature/language-config
```

### 3. Отправка в main вашего форка
```bash
git checkout main
git merge feature/language-config
git push origin main
```

## Синхронизация с оригиналом

### Получить обновления из оригинального репозитория
```bash
# Получить все изменения
git fetch upstream

# Влить изменения в вашу ветку main
git checkout main
git merge upstream/main

# Или rebase (если хотите линейную историю)
git rebase upstream/main

# Отправить обновления в ваш форк
git push origin main
```

### Обновить feature-ветку с учетом изменений из upstream
```bash
git checkout feature/my-feature
git rebase upstream/main
git push origin feature/my-feature --force-with-lease
```

## Защита от ошибок

### ✅ Безопасные команды (работают):
```bash
git push                      # → origin (ваш форк)
git push origin main          # → origin (ваш форк)
git pull upstream main        # ← upstream (получить обновления)
git fetch upstream            # ← upstream (получить обновления)
```

### ❌ Заблокированные команды (выдадут ошибку):
```bash
git push upstream main        # ❌ Заблокировано!
git push upstream             # ❌ Заблокировано!
```

## Проверка конфигурации

### Посмотреть все remote'ы
```bash
git remote -v
```

### Посмотреть текущую ветку
```bash
git branch
git status
```

### Посмотреть, куда будет push
```bash
git remote show origin
```

## Полезные алиасы

Добавьте в `~/.gitconfig`:

```ini
[alias]
    # Быстрая синхронизация с upstream
    sync = !git fetch upstream && git merge upstream/main
    
    # Посмотреть все remote'ы
    remotes = remote -v
    
    # Красивый лог
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit
    
    # Статус коротко
    st = status -sb
    
    # Последний коммит
    last = log -1 HEAD --stat
```

Использование:
```bash
git sync        # синхронизация с upstream
git remotes     # показать remote'ы
git lg          # красивый лог
git st          # короткий статус
```

## Сценарии работы

### Сценарий 1: Новая фича
```bash
# 1. Обновиться с upstream
git checkout main
git pull upstream main
git push origin main

# 2. Создать ветку
git checkout -b feature/my-feature

# 3. Работать
git add .
git commit -m "feat: implement feature"

# 4. Отправить в свой форк
git push origin feature/my-feature

# 5. Создать PR (если нужно) через GitHub UI
```

### Сценарий 2: Быстрый фикс в main
```bash
# 1. Убедиться что в main
git checkout main

# 2. Обновиться
git pull upstream main

# 3. Внести изменения
git add .
git commit -m "fix: quick fix"

# 4. Отправить в свой форк
git push origin main
```

### Сценарий 3: Конфликт при синхронизации
```bash
# 1. Попытка синхронизации
git pull upstream main
# CONFLICT!

# 2. Посмотреть конфликты
git status

# 3. Разрешить конфликты в редакторе
# Отредактировать файлы, убрать маркеры <<<<< ===== >>>>>

# 4. Завершить merge
git add .
git commit -m "merge: resolve conflicts with upstream"

# 5. Отправить в свой форк
git push origin main
```

## Восстановление после ошибок

### Отменить последний коммит (но сохранить изменения)
```bash
git reset --soft HEAD~1
```

### Отменить последний коммит (удалить изменения)
```bash
git reset --hard HEAD~1
```

### Вернуться к состоянию из upstream
```bash
git fetch upstream
git reset --hard upstream/main
git push origin main --force
```

### Отменить изменения в файле
```bash
git checkout -- filename
```

## Проверка перед push

Всегда проверяйте:
```bash
# Куда будет push?
git remote -v | grep origin

# Что будет отправлено?
git log origin/main..HEAD

# Какие файлы изменены?
git status
```

## Если случайно отправили в upstream

Не паникуйте! Push заблокирован, вы увидите ошибку:
```
fatal: 'no_push' does not appear to be a git repository
```

Просто используйте правильную команду:
```bash
git push origin main
```

## Дополнительная защита

### Установить default push remote
```bash
git config push.default current
git config remote.pushDefault origin
```

Теперь `git push` всегда будет отправлять в `origin`.

### Включить автоматическую проверку
Добавьте в `~/.gitconfig`:
```ini
[push]
    default = current
    
[remote]
    pushDefault = origin
```

## Полезные команды для проверки

```bash
# Показать конфигурацию push
git config --get remote.pushDefault

# Показать URL для push
git remote get-url --push origin
git remote get-url --push upstream

# Показать все настройки git
git config --list | grep remote
```
