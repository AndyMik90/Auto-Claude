#!/usr/bin/env python3
"""Fix for Issue #489: Command Injection via MCP Server Configuration"""

def apply_fix():
    with open('client.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    i = 0
    added_constant = False
    added_validation = False
    
    while i < len(lines):
        line = lines[i]
        
        # Step 1: Add SHELL_METACHARACTERS constant after DANGEROUS_FLAGS closing brace
        if not added_constant and line.strip() == '}' and i > 0 and '"-r"' in lines[i-1]:
            new_lines.append(line)  # Add the closing }
            new_lines.append('\n')
            new_lines.append('    # Shell metacharacters that could enable command injection\n')
            new_lines.append('    # Issue #489: Prevent shell metacharacters in MCP server args\n')
            new_lines.append('    SHELL_METACHARACTERS = {"&", "|", ";", ">", "<", "`", "$", "(", ")", "{", "}", "\n", "\r"}\n')
            added_constant = True
            i += 1
            continue
        
        # Step 2: Add shell metacharacter validation before DANGEROUS_FLAGS check
        # Look for the line: "# Check for dangerous interpreter flags"
        if not added_validation and '# Check for dangerous interpreter flags' in line:
            # Insert shell metacharacter check before dangerous flags check
            new_lines.append('            # Issue #489: Check for shell metacharacters that could enable command injection\n')
            new_lines.append('            for arg in server["args"]:\n')
            new_lines.append('                if any(char in arg for char in SHELL_METACHARACTERS):\n')
            new_lines.append('                    logger.warning(\n')
            new_lines.append('                        f"Rejected arg with shell metacharacter in MCP server: {arg}. "\n')
            new_lines.append('                        f"Shell metacharacters are not allowed for security reasons."\n')
            new_lines.append('                    )\n')
            new_lines.append('                    return False\n')
            new_lines.append('\n')
            added_validation = True
        
        new_lines.append(line)
        i += 1
    
    # Write the fixed file
    with open('client.py', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("[OK] Fix #489 applied successfully")
    print(f"[OK] Added SHELL_METACHARACTERS constant: {added_constant}")
    print(f"[OK] Added shell metacharacter validation: {added_validation}")

if __name__ == '__main__':
    # First restore clean backup
    import shutil
    shutil.copy('/tmp/client_backup.py', 'client.py')
    print("[OK] Restored clean backup")
    
    # Apply fix
    apply_fix()
