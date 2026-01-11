# Puppeteer MCP Server

Browser automation for web application testing and verification.

## Overview

Puppeteer MCP provides QA agents with full browser control for testing web applications. While Electron MCP handles desktop apps, Puppeteer is for:
- Web application testing
- Cross-browser verification
- Visual regression testing
- Web scraping verification

## Capabilities

### Browser Control
| Action | Description |
|--------|-------------|
| Launch browser | Start Chrome/Chromium instance |
| Navigate | Go to URLs |
| Close browser | Clean up resources |

### Page Interaction
| Action | Description |
|--------|-------------|
| Click | Click elements by selector |
| Type | Enter text into inputs |
| Select | Choose dropdown options |
| Hover | Mouse over elements |
| Scroll | Scroll page/elements |

### Capture & Inspection
| Action | Description |
|--------|-------------|
| Screenshot | Capture full page or element |
| PDF | Generate PDF of page |
| Evaluate | Execute JavaScript in page |
| Get content | Extract HTML/text |
| Wait | Wait for elements/conditions |

### Network
| Action | Description |
|--------|-------------|
| Intercept | Monitor network requests |
| Mock | Stub API responses |
| Block | Block specific resources |

## Use Cases for BD Automation

### 1. Web Scraper Verification
Verify Apify scrapers are collecting correct data:
```
Test: Verify ClearanceJobs scraper output

1. Navigate to ClearanceJobs
2. Search for "DCGS San Diego"
3. Extract job listings
4. Compare with Apify output
5. Screenshot differences
```

### 2. Notion Web Verification
Verify data appears correctly in Notion web UI:
```
Test: Verify job record in Notion

1. Navigate to Notion database URL
2. Search for specific job ID
3. Verify all fields populated
4. Screenshot record
```

### 3. n8n Workflow Testing
Test n8n workflows via web interface:
```
Test: Verify webhook workflow

1. Navigate to n8n instance
2. Open workflow editor
3. Trigger test execution
4. Verify execution succeeded
5. Screenshot results
```

### 4. Visual Regression
Compare UI before/after changes:
```
Test: Visual regression for dashboard

1. Screenshot baseline
2. Apply changes
3. Screenshot current
4. Compare images
5. Report differences
```

## Configuration

### Agent Access
Puppeteer MCP is available to:
- `qa_reviewer` agent
- `qa_fixer` agent

### Browser Options
Default configuration:
```javascript
{
  headless: true,       // Run without visible browser
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
}
```

## Example Test Scenarios

### Web Form Testing
```
Scenario: Test contact form submission

Steps:
1. puppeteer_navigate: "https://example.com/contact"
2. puppeteer_type: selector="#name", text="John Smith"
3. puppeteer_type: selector="#email", text="john@example.com"
4. puppeteer_type: selector="#message", text="Test message"
5. puppeteer_click: selector="button[type=submit]"
6. puppeteer_wait: selector=".success-message"
7. puppeteer_screenshot: path="contact-success.png"
```

### API Response Verification
```
Scenario: Verify API data displays correctly

Steps:
1. puppeteer_navigate: "https://app.example.com/dashboard"
2. puppeteer_wait: selector=".data-table"
3. puppeteer_evaluate: "document.querySelectorAll('.data-row').length"
4. Assert: row count matches expected
5. puppeteer_screenshot: path="dashboard-data.png"
```

### Multi-Page Flow
```
Scenario: Test authentication flow

Steps:
1. puppeteer_navigate: "https://app.example.com/login"
2. puppeteer_type: selector="#username", text="testuser"
3. puppeteer_type: selector="#password", text="testpass"
4. puppeteer_click: selector="#login-button"
5. puppeteer_wait: url contains "/dashboard"
6. puppeteer_screenshot: path="logged-in.png"
7. puppeteer_navigate: "https://app.example.com/settings"
8. puppeteer_screenshot: path="settings-page.png"
```

## Comparison: Puppeteer vs Electron MCP

| Feature | Puppeteer | Electron |
|---------|-----------|----------|
| Target | Web apps | Desktop Electron apps |
| Browser | Chromium (launches new) | Connects to running app |
| Network | Full control | Limited |
| Isolation | Separate browser | App's actual state |
| Use Case | Web testing, scraping | App E2E testing |

## Best Practices

### 1. Wait for Elements
Always wait for elements before interacting:
```javascript
// Bad: May fail if element not ready
await page.click('#submit');

// Good: Wait first
await page.waitForSelector('#submit');
await page.click('#submit');
```

### 2. Handle Dynamic Content
For SPAs and dynamic pages:
```javascript
await page.waitForFunction(
  () => document.querySelectorAll('.item').length > 0
);
```

### 3. Screenshot Strategically
- Full page for layout issues
- Element screenshots for specific components
- Before/after for changes

### 4. Clean Up Resources
Always close browser when done:
```javascript
await browser.close();
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Browser not found" | Install Chrome/Chromium |
| "Timeout waiting for selector" | Check selector, increase timeout |
| "Navigation failed" | Verify URL, check network |
| "Screenshot blank" | Wait for page load, check visibility |

## Integration Notes

Puppeteer MCP integrates with the QA workflow:
1. QA Reviewer uses Puppeteer to verify web components
2. Screenshots included in QA report
3. QA Fixer can re-test after fixes

For Electron apps, prefer Electron MCP as it connects to the actual running application state.
