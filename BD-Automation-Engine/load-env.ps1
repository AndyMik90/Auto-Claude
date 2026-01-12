# Load environment variables from .env file
# Run this before starting Auto Claude: . .\load-env.ps1

$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "Set: $name"
        }
    }
    Write-Host "Environment variables loaded from .env"
} else {
    Write-Host "Warning: .env file not found. Copy .env.example to .env and fill in your values."
}
