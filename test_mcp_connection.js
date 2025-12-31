/**
 * Test script to verify Electron MCP server connection
 * This script tests if the MCP server can connect to an Electron app
 */

import CDP from 'chrome-remote-interface';

async function testCDPConnection() {
    console.log('Testing CDP connection to Electron app...');
    
    try {
        // Try to list available targets
        const targets = await CDP.List({ port: 9222 });
        console.log('Available targets:', targets);
        
        if (targets.length > 0) {
            console.log('✅ Found targets, connection successful!');
            const pageTarget = targets.find(t => t.type === 'page');
            if (pageTarget) {
                console.log('🎯 Found page target:', pageTarget.url || 'No URL');
                
                // Try to connect to the page
                const client = await CDP({ target: pageTarget, port: 9222 });
                console.log('🔌 Connected to page via CDP');
                
                // Test basic functionality
                await client.Runtime.enable();
                const result = await client.Runtime.evaluate({ 
                    expression: 'navigator.userAgent' 
                });
                console.log('📊 User agent:', result.result.value);
                
                await client.close();
                console.log('✅ Test completed successfully!');
                return true;
            }
        } else {
            console.log('❌ No targets found. Is Electron app running with --remote-debugging-port=9222?');
        }
    } catch (error) {
        console.log('❌ CDP connection failed:', error.message);
        console.log('💡 Make sure:');
        console.log('   1. Electron app is running with --remote-debugging-port=9222');
        console.log('   2. Port 9222 is not blocked by firewall');
        console.log('   3. Chrome DevTools Protocol is enabled in the app');
    }
    
    return false;
}

// Run the test
testCDPConnection().then(success => {
    if (success) {
        console.log('\n🎉 Electron MCP setup is working correctly!');
    } else {
        console.log('\n⚠️  Electron MCP setup needs troubleshooting.');
        console.log('   Try starting your Electron app with: electron . --remote-debugging-port=9222');
    }
});