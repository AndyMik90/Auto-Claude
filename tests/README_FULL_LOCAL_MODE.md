# Full Local Mode Testing

This directory contains tests for the Full Local Mode feature, which allows Auto-Claude to run entirely on local Ollama models without using Claude API.

## Quick Start (Windows)

### 1. Install Ollama

Download and install from: https://ollama.com/download

### 2. Install Recommended Models

Open PowerShell or Command Prompt:

```powershell
ollama pull llama3.2:3b
ollama pull llama3.1:8b
ollama pull qwen2.5-coder:7b
```

### 3. Install Python Dependencies

```powershell
cd C:\Users\<YourUsername>\Documents\HybridCoder\Auto-Claude
pip install requests
```

### 4. Run the Test Script

```powershell
python tests\test_full_local_mode.py
```

## Quick Start (Linux/Mac)

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Install Recommended Models

```bash
ollama pull llama3.2:3b
ollama pull llama3.1:8b
ollama pull qwen2.5-coder:7b
```

### 3. Install Python Dependencies

```bash
cd ~/Auto-Claude
pip3 install requests
```

### 4. Run the Test Script

```bash
python3 tests/test_full_local_mode.py
```

## What the Test Checks

The test script verifies:

- ✅ Ollama service is running
- ✅ Recommended models are installed
- ✅ Settings file exists
- ✅ Full Local Mode is configured
- ✅ Models are set to Ollama (not Claude)
- ✅ Backend functions work correctly

## Expected Output

```
============================================================
              Full Local Mode Test Suite
============================================================

ℹ️  Platform: nt (Windows)
ℹ️  Config directory: C:\Users\Marc\AppData\Roaming\auto-claude

🧪 Testing: Ollama Service Running
✅ Ollama is running with 3 models

🧪 Testing: Ollama Models Installed
✅ Model llama3.2:3b is installed
✅ Model llama3.1:8b is installed
✅ Model qwen2.5-coder:7b is installed

🧪 Testing: Settings File Exists
✅ Settings file found: C:\Users\Marc\AppData\Roaming\auto-claude\settings.json

🧪 Testing: Full Local Mode Configuration
✅ Full Local Mode is ENABLED
ℹ️  Using Smart Auto-Select

🧪 Testing: Model Configuration
✅ Phase 'spec' uses Ollama: ollama:llama3.1:8b
✅ Phase 'planning' uses Ollama: ollama:llama3.1:8b
✅ Phase 'coding' uses Ollama: ollama:qwen2.5-coder:7b
✅ Phase 'qa' uses Ollama: ollama:llama3.1:8b

🧪 Testing: Backend Phase Configuration
✅ is_ollama_model() correctly identifies: ollama:llama3.1:8b
✅ get_ollama_model_name() returns: llama3.1:8b
✅ resolve_model_id() preserves ollama: prefix

🧪 Testing: Ollama Client
✅ OllamaClient can be imported
✅ OllamaClient instance created

============================================================
                      Test Summary
============================================================

Total Tests: 15
Passed: 15
Failed: 0

🎉 All tests passed! Full Local Mode is ready to use.
```

## Troubleshooting

### Ollama Not Running

**Windows:**
```powershell
# Start Ollama
ollama serve
```

**Linux:**
```bash
sudo systemctl start ollama
```

### Model Not Found

```bash
# List installed models
ollama list

# Install missing model
ollama pull llama3.1:8b
```

### Settings File Not Found

Run Auto-Claude at least once to create the settings file:

1. Open Auto-Claude
2. Go to Settings
3. Close Auto-Claude
4. Run the test again

### Import Errors

Make sure you're running the test from the Auto-Claude root directory:

```powershell
# Windows
cd C:\Users\<YourUsername>\Documents\HybridCoder\Auto-Claude
python tests\test_full_local_mode.py

# Linux/Mac
cd ~/Auto-Claude
python3 tests/test_full_local_mode.py
```

## Manual Testing

For comprehensive manual testing, see: [Full Local Mode Testing Guide](../docs/FULL_LOCAL_MODE_TESTING.md)

## Configuration Locations

### Windows
- Settings: `%APPDATA%\auto-claude\settings.json`
- Logs: `%USERPROFILE%\.auto-claude\logs\`

### Linux/Mac
- Settings: `~/.config/auto-claude/settings.json`
- Logs: `~/.auto-claude/logs/`

## Support

If tests fail:

1. Check Ollama is running: `http://localhost:11434`
2. Check logs: `%USERPROFILE%\.auto-claude\logs\backend.log`
3. Enable debug mode in Settings
4. Create a GitHub issue with test output

## Related Files

- `test_full_local_mode.py` - Automated test script
- `test_hybrid_provider.py` - Tests for hybrid provider
- `test_context_optimizer.py` - Tests for context optimization
