#!/bin/bash
# Extract sections from ipc-handlers.ts based on line ranges

FILE="auto-claude-ui/src/main/ipc-handlers.ts"
OUT_DIR="auto-claude-ui/src/main/ipc-handlers/sections"

mkdir -p "$OUT_DIR"

# Extract task handlers (lines 381-1877)
sed -n '381,1877p' "$FILE" > "$OUT_DIR/task-section.txt"

# Extract terminal handlers (lines 2201-2687)
sed -n '2201,2687p' "$FILE" > "$OUT_DIR/terminal-section.txt"

# Extract roadmap/context handlers (lines 2840-3716)
sed -n '2840,3716p' "$FILE" > "$OUT_DIR/context-roadmap-section.txt"

# Extract integration handlers (lines 3717-5369)
sed -n '3717,5369p' "$FILE" > "$OUT_DIR/integration-section.txt"

# Extract ideation handlers (lines 5656-6830)
sed -n '5656,6830p' "$FILE" > "$OUT_DIR/ideation-insights-section.txt"

echo "Sections extracted to $OUT_DIR"
ls -lh "$OUT_DIR"
