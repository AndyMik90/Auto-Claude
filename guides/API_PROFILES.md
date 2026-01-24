# API Profile Configuration Guide

## Overview

Auto Claude's API Profile system allows you to easily configure and switch between different API endpoints without editing environment variables. This is especially useful for:

- **new-api users**: Connect to local proxy servers for Chinese API providers
- **litellm users**: Use multi-provider gateways
- **OpenRouter users**: Access multiple LLM providers through one API
- **Enterprise users**: Use self-hosted Claude instances or custom endpoints

## Quick Start

### 1. Open API Profile Settings

1. Launch Auto Claude Desktop App
2. Click **Settings** (gear icon) in the sidebar
3. Navigate to **API Profiles** section

### 2. Create Your First Profile

Click "Add Profile" and fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Friendly name for this profile | "Local new-api", "Production" |
| **Base URL** | API endpoint URL | `http://localhost:3000` |
| **API Key** | Your API key for this endpoint | `sk-your-api-key-here` |
| **Model Mappings** (Optional) | Custom model names | See "Custom Model Mappings" below |

### 3. Test Connection

Before activating, click **Test Connection** to verify:
- ✅ **Connection Successful**: Endpoint is reachable and API key is valid
- ❌ **Connection Failed**: Check URL format and API key

### 4. Activate Profile

Click **Set Active** to use this profile for all Auto Claude operations.

To switch back to OAuth authentication, click **Switch to OAuth**.

## Common Use Cases

### new-api (Local Proxy for Chinese APIs)

**Scenario**: You want to use Chinese LLM providers (智谱AI, 百度文心, 阿里通义千问) through a local new-api proxy.

**Steps**:
1. Install and start new-api: https://github.com/Calcium-Ion/new-api
2. Configure your Chinese API keys in new-api dashboard
3. Create profile in Auto Claude:
   - Name: `Local new-api`
   - Base URL: `http://localhost:3000` (or your new-api port)
   - API Key: Your new-api token (create in new-api dashboard)
4. Test connection and activate

**Model Mapping Example**:
```
Default Model: gpt-4o  # new-api will route to your configured model
```

### litellm (Multi-Provider Gateway)

**Scenario**: You use litellm to aggregate multiple LLM providers.

**Steps**:
1. Install and configure litellm: https://docs.litellm.ai/docs/
2. Start litellm proxy: `litellm --config config.yaml`
3. Create profile in Auto Claude:
   - Name: `litellm Gateway`
   - Base URL: `http://localhost:8000` (litellm default port)
   - API Key: Your litellm API key (if configured)
4. Test and activate

### OpenRouter

**Scenario**: Access multiple LLM providers through OpenRouter's unified API.

**Steps**:
1. Get OpenRouter API key: https://openrouter.ai/keys
2. Create profile:
   - Name: `OpenRouter`
   - Base URL: `https://openrouter.ai/api/v1`
   - API Key: Your OpenRouter API key
   - Model Mappings:
     - Default: `anthropic/claude-sonnet-4-5-20250929`
     - Haiku: `anthropic/claude-haiku-4-5-20251001`
     - Sonnet: `anthropic/claude-sonnet-4-5-20250929`
     - Opus: `anthropic/claude-opus-4-5-20251101`
3. Test and activate

### Self-Hosted Claude

**Scenario**: You have a self-hosted Claude instance in your organization.

**Steps**:
1. Get your internal Claude endpoint URL and API key
2. Create profile:
   - Name: `Internal Claude`
   - Base URL: `https://claude.yourcompany.internal`
   - API Key: Your internal API key
3. Test and activate

## Custom Model Mappings

Auto Claude uses different Claude models for different phases:
- **Default**: General-purpose model
- **Haiku**: Fast, cost-effective model
- **Sonnet**: Balanced performance
- **Opus**: Most capable model

If your API endpoint uses different model names, specify custom mappings:

### Example 1: new-api with Chinese Provider

```
Default Model: gpt-4o
Haiku Model: gpt-3.5-turbo
Sonnet Model: gpt-4o
Opus Model: gpt-4o
```

### Example 2: OpenRouter

```
Default Model: anthropic/claude-sonnet-4-5-20250929
Haiku Model: anthropic/claude-haiku-4-5-20251001
Sonnet Model: anthropic/claude-sonnet-4-5-20250929
Opus Model: anthropic/claude-opus-4-5-20251101
```

### Example 3: litellm

```
Default Model: claude-3-5-sonnet
Haiku Model: claude-3-5-haiku
Sonnet Model: claude-3-5-sonnet
Opus Model: claude-3-opus
```

## Managing Multiple Profiles

You can create multiple profiles and switch between them:

1. **Development**: Local new-api for testing
2. **Production**: Official Anthropic API or company proxy
3. **Backup**: Alternative provider in case of rate limits

To switch profiles:
1. Go to Settings → API Profiles
2. Click **Set Active** on the desired profile
3. Changes take effect immediately (no restart needed)

## Troubleshooting

### Connection Test Fails

**Problem**: "Connection Failed" when testing profile

**Solutions**:
1. **Check URL format**: Must start with `http://` or `https://`
2. **Verify endpoint is running**: Try accessing URL in browser
3. **Check API key**: Ensure key is correct and has proper permissions
4. **Firewall/network**: Ensure Auto Claude can reach the endpoint
5. **CORS issues**: Some proxies may require CORS configuration

### Profile Not Applied

**Problem**: Changes don't take effect after activating profile

**Solutions**:
1. Check active profile indicator (✓ Active badge)
2. Restart any running tasks/builds
3. Check backend logs: `.auto-claude/logs/` for error messages
4. Verify `~/.config/Auto-Claude/profiles.json` was updated

### Custom Models Not Working

**Problem**: Custom model mappings are ignored

**Solutions**:
1. Ensure model names match your endpoint's available models
2. Check endpoint documentation for correct model IDs
3. Test with base Anthropic model names first
4. Verify endpoint supports model name parameter

## Technical Details

### Configuration File

Profiles are stored in: `~/.config/Auto-Claude/profiles.json`

Structure:
```json
{
  "profiles": [
    {
      "id": "uuid-here",
      "name": "Local new-api",
      "baseUrl": "http://localhost:3000",
      "apiKey": "sk-...",
      "models": {
        "default": "gpt-4o",
        "haiku": "gpt-3.5-turbo",
        "sonnet": "gpt-4o",
        "opus": "gpt-4o"
      },
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    }
  ],
  "activeProfileId": "uuid-here",
  "version": 1
}
```

### Backend Integration

When a profile is active, the backend (`apps/backend/core/auth.py`) automatically:
1. Loads the active profile from `profiles.json`
2. Sets environment variables:
   - `ANTHROPIC_BASE_URL` → profile's `baseUrl`
   - `ANTHROPIC_AUTH_TOKEN` → profile's `apiKey`
   - `ANTHROPIC_MODEL` → profile's model mappings
3. Passes these to the Claude SDK client

This happens before any agent operations, ensuring all API calls use the configured endpoint.

### Security

- **API keys are stored encrypted** in the profiles file
- **File permissions**: 600 (owner read/write only)
- **No plaintext keys in logs**: Keys are masked in debug output
- **No network transmission**: Keys stay on your machine

## FAQ

### Q: Can I use both OAuth and API Profiles?

**A**: Yes! You can switch between them anytime:
- Active profile: Uses configured endpoint and API key
- No active profile: Uses OAuth token from system keychain

### Q: Do I need to restart Auto Claude after changing profiles?

**A**: No. Changes take effect immediately. However, any running tasks will complete with the old profile - new tasks will use the new profile.

### Q: Can I share profiles between machines?

**A**: Yes, but be careful with API keys. Copy `~/.config/Auto-Claude/profiles.json` to the same location on another machine. Ensure proper file permissions (600).

### Q: What if my endpoint doesn't support Anthropic API format?

**A**: Your endpoint must be Anthropic API-compatible. Most proxies (new-api, litellm, OpenRouter) provide Anthropic-compatible interfaces.

### Q: How do I report issues with API Profiles?

**A**: Open an issue on GitHub: https://github.com/AndyMik90/Auto-Claude/issues
Include:
- Profile configuration (mask your API key)
- Error messages from connection test
- Backend logs (`.auto-claude/logs/`)

## Additional Resources

- **new-api Documentation**: https://github.com/Calcium-Ion/new-api
- **litellm Documentation**: https://docs.litellm.ai/
- **OpenRouter Documentation**: https://openrouter.ai/docs
- **Auto Claude GitHub**: https://github.com/AndyMik90/Auto-Claude

---

**中文用户提示 (Chinese User Note)**:

Auto Claude 完全支持中文界面。在设置中选择"简体中文"语言即可切换。API 配置界面也提供完整的中文翻译。

建议中国用户使用 new-api 作为代理，连接智谱AI、百度文心等国内大模型平台。配置方法请参考上述 "new-api" 使用案例。
