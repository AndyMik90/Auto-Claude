#!/bin/bash
# Load environment variables from .env file
# Source this before running Auto Claude: source load-env.sh

if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
    echo "Loaded environment variables from .env"
else
    echo "Warning: .env file not found. Copy .env.example to .env and fill in your values."
fi
