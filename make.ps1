# PowerShell task runner mirroring the Makefile targets, for shells without a
# POSIX sh on PATH. Usage: .\make.ps1 <target>   (default: help)
#   .\make.ps1 dev
#   .\make.ps1 create-migration -Feature budget -Name AddExample
#   .\make.ps1 prod-restore -Backup deployments\backups\household-20260805.dump
[CmdletBinding()]
param(
    [Parameter(Position = 0)] [string] $Target = "help",
    [string] $Feature,
    [string] $Name,
    [string] $Backup
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$deployments = Join-Path $root "deployments"
$envFile = Join-Path $deployments ".env"
$envExampleFile = Join-Path $deployments ".env.example"
$devComposeFile = Join-Path $deployments "docker-compose.dev.yml"
$prodComposeFile = Join-Path $deployments "docker-compose.yml"
$prodBuildComposeFile = Join-Path $deployments "docker-compose.build.yml"
$backendDir = Join-Path $root "backend"
$webDir = Join-Path $root "clients" "web"

function Invoke-Step {
    param([string] $Description, [scriptblock] $Action)
    if ($Description) { Write-Host ">> $Description" }
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Step failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}

function Read-EnvFile {
    $values = @{}
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
            $key, $value = $line -split '=', 2
            $values[$key.Trim()] = $value.Trim()
        }
    }
    return $values
}

function Set-ApiDevEnvironment {
    $values = Read-EnvFile
    function Value([string] $key, [string] $fallback) {
        if ($values.ContainsKey($key) -and $values[$key]) { return $values[$key] }
        $current = [Environment]::GetEnvironmentVariable($key)
        if ($current) { return $current }
        return $fallback
    }
    $env:HOUSEHOLD_API_DB_HOST = "localhost"
    $env:HOUSEHOLD_API_DB_PORT = Value "HOUSEHOLD_DB_PORT" "5432"
    $env:HOUSEHOLD_API_DB_DATABASE = Value "HOUSEHOLD_DB_DATABASE" "household"
    $env:HOUSEHOLD_API_DB_USER = Value "HOUSEHOLD_DB_USER" "household"
    $env:HOUSEHOLD_API_DB_PASSWORD = Value "HOUSEHOLD_DB_PASSWORD" "household"
    $env:HOUSEHOLD_API_SERVER_PORT = Value "HOUSEHOLD_API_SERVER_PORT" "8090"
    $env:HOUSEHOLD_API_SERVER_TIMEOUT_READ = Value "HOUSEHOLD_API_SERVER_TIMEOUT_READ" "5s"
    $env:HOUSEHOLD_API_SERVER_TIMEOUT_WRITE = Value "HOUSEHOLD_API_SERVER_TIMEOUT_WRITE" "10s"
    $env:HOUSEHOLD_API_SERVER_TIMEOUT_IDLE = Value "HOUSEHOLD_API_SERVER_TIMEOUT_IDLE" "60s"
    $env:HOUSEHOLD_LOG_LEVEL = Value "HOUSEHOLD_LOG_LEVEL" "debug"
    $env:HOUSEHOLD_LOG_ENVIRONMENT = "dev"
    $env:HOUSEHOLD_LOG_VERSION = "dev"
    $env:HOUSEHOLD_UPDATES_GITHUB_REPOSITORY = Value "HOUSEHOLD_UPDATES_GITHUB_REPOSITORY" "kratofl/household"
    $env:HOUSEHOLD_SEED_DEMO_USER = "true"
    $env:HOUSEHOLD_SEED_DEMO_USER_NAME = Value "HOUSEHOLD_SEED_DEMO_USER_NAME" "admin"
    $env:HOUSEHOLD_SEED_DEMO_USER_EMAIL = Value "HOUSEHOLD_SEED_DEMO_USER_EMAIL" "admin@household.local"
    $env:HOUSEHOLD_SEED_DEMO_USER_PASSWORD = Value "HOUSEHOLD_DEV_SEED_DEMO_USER_PASSWORD" "admin"
}

function Invoke-ComposeDev { param([string[]] $Arguments)
    & docker compose --env-file $envFile -f $devComposeFile @Arguments
}
function Invoke-ComposeProd { param([string[]] $Arguments)
    & docker compose --env-file $envFile -f $prodComposeFile @Arguments
}

function Invoke-SetupEnv {
    if (-not (Test-Path $envFile)) {
        Copy-Item $envExampleFile $envFile
        Write-Host "Created deployments/.env. Edit it before production use."
    } else {
        Write-Host "deployments/.env already exists."
    }
}

function Assert-EnvFile {
    if (-not (Test-Path $envFile)) {
        Write-Error "deployments/.env is missing. Run: .\make.ps1 setup-env"
        exit 1
    }
}

function Assert-ProdEnv {
    Assert-EnvFile
    if (Select-String -Path $envFile -Pattern '^[A-Z0-9_]+=.*change-me' -Quiet) {
        Write-Error "deployments/.env still contains change-me placeholder values."
        exit 1
    }
}

switch ($Target) {
    "help" {
        Write-Host "Household targets (.\make.ps1 <target>)"
        Write-Host ""
        Write-Host "Setup:        setup-env, bootstrap, doctor"
        Write-Host "Development:  dev, db-up, db-down, db-logs, api-dev, web-dev, reset-dev-db"
        Write-Host "Quality:      check, backend-test, backend-build, web-lint, web-build, browser-test, compose-config"
        Write-Host "Production:   prod-pull, prod-up, prod-build-up, prod-down, prod-logs, prod-backup,"
        Write-Host "              prod-restore -Backup <path>, prod-observability-up"
        Write-Host "Other:        observability-up, observability-down, observability-logs,"
        Write-Host "              create-migration -Feature <identity|budget|audit> -Name <MigrationName>"
    }

    "setup-env" { Invoke-SetupEnv }

    "bootstrap" {
        Invoke-SetupEnv
        Invoke-Step "Restoring backend dependencies" { Set-Location $backendDir; dotnet restore Household.slnx }
        Invoke-Step "Installing web dependencies" { Set-Location $webDir; npm ci }
    }

    "doctor" {
        $missing = 0
        foreach ($tool in "dotnet", "node", "npm", "docker") {
            if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
                Write-Host "Missing required tool: $tool"
                $missing = 1
            }
        }
        docker compose version *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Missing Docker Compose plugin: docker compose"
            $missing = 1
        }
        if ($missing -ne 0) { exit 1 }
        Write-Host "All required tools are available."
    }

    "db-up" {
        Invoke-SetupEnv
        Invoke-Step "Starting local dev Postgres..." { Invoke-ComposeDev @("--profile", "db", "up", "-d", "household-db") }
    }

    "db-down" { Invoke-Step "" { Invoke-ComposeDev @("--profile", "db", "down", "--remove-orphans") } }

    "db-logs" { Invoke-ComposeDev @("logs", "-f", "household-db") }

    "reset-dev-db" {
        Invoke-SetupEnv
        Invoke-Step "" { Invoke-ComposeDev @("--profile", "db", "down", "-v", "--remove-orphans") }
    }

    "api-dev" {
        Write-Host ">> Starting local API..."
        Set-ApiDevEnvironment
        Set-Location $backendDir
        dotnet watch --project src/Household.Api/Household.Api.csproj run
    }

    "web-dev" {
        Write-Host ">> Starting Next.js web dev server..."
        Set-Location $webDir
        npm run dev
    }

    "dev" {
        & $PSCommandPath db-up
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Write-Host ">> Starting the API in a new window; the web dev server runs here."
        Write-Host ">> Stop with Ctrl+C here and by closing the API window (then .\make.ps1 db-down)."
        Start-Process pwsh -ArgumentList "-NoExit", "-File", $PSCommandPath, "api-dev" -WorkingDirectory $root
        & $PSCommandPath web-dev
    }

    "check" {
        foreach ($step in "backend-test", "backend-build", "web-lint", "web-build", "browser-test", "compose-config") {
            & $PSCommandPath $step
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
    }

    "test" { & $PSCommandPath backend-test; exit $LASTEXITCODE }
    "build" { & $PSCommandPath backend-build; exit $LASTEXITCODE }

    "backend-test" {
        Invoke-Step "Testing backend against PostgreSQL" { Set-Location $backendDir; dotnet test Household.slnx --configuration Release }
    }

    "backend-build" {
        Invoke-Step "Building household-api and household-updater" { Set-Location $backendDir; dotnet build Household.slnx --configuration Release }
    }

    "web-lint" { Invoke-Step "Linting web" { Set-Location $webDir; npm run lint } }

    "web-build" { Invoke-Step "Building web" { Set-Location $webDir; npm run build } }

    "browser-test" {
        & $PSCommandPath web-build
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Invoke-Step "Running browser journeys against the real API" { Set-Location $webDir; npx playwright test }
    }

    "compose-config" {
        Invoke-Step "Validating production Compose" {
            docker compose --env-file $envExampleFile -f $prodComposeFile config --quiet }
        Invoke-Step "Validating production source-build Compose" {
            docker compose --env-file $envExampleFile -f $prodComposeFile -f $prodBuildComposeFile config --quiet }
        Invoke-Step "Validating development Compose" {
            docker compose --env-file $envExampleFile -f $devComposeFile config --quiet }
    }

    "prod-pull" { Assert-ProdEnv; Invoke-Step "" { Invoke-ComposeProd @("pull") } }
    "prod-up" { Assert-ProdEnv; Invoke-Step "" { Invoke-ComposeProd @("up", "-d") } }
    "prod-build-up" {
        Assert-ProdEnv
        Invoke-Step "" { docker compose --env-file $envFile -f $prodComposeFile -f $prodBuildComposeFile up -d --build }
    }
    "prod-down" { Assert-EnvFile; Invoke-Step "" { Invoke-ComposeProd @("down") } }
    "prod-logs" { Assert-EnvFile; Invoke-ComposeProd @("logs", "-f", "household-api") }
    "prod-observability-up" { Assert-ProdEnv; Invoke-Step "" { Invoke-ComposeProd @("--profile", "observability", "up", "-d") } }

    "prod-backup" {
        Assert-ProdEnv
        $backups = Join-Path $deployments "backups"
        New-Item -ItemType Directory -Force $backups | Out-Null
        $file = Join-Path $backups ("household-" + (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss") + ".dump")
        Write-Host ">> Writing $file"
        # cmd handles the redirect so the binary pg_dump output is not re-encoded.
        cmd /c "docker compose --env-file `"$envFile`" -f `"$prodComposeFile`" exec -T household-db sh -c `"pg_dump -U `$POSTGRES_USER -d `$POSTGRES_DB -Fc`" > `"$file`""
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    "prod-restore" {
        Assert-ProdEnv
        if (-not $Backup) { Write-Error "Please add -Backup <path>"; exit 1 }
        cmd /c "docker compose --env-file `"$envFile`" -f `"$prodComposeFile`" exec -T household-db sh -c `"pg_restore -U `$POSTGRES_USER -d `$POSTGRES_DB --clean --if-exists`" < `"$Backup`""
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    "observability-up" {
        Invoke-SetupEnv
        Invoke-Step "Starting observability stack..." { Invoke-ComposeDev @("--profile", "observability", "up", "-d") }
    }
    "observability-down" { Invoke-Step "" { Invoke-ComposeDev @("stop", "grafana", "alloy", "loki") } }
    "observability-logs" { Invoke-ComposeDev @("logs", "-f", "grafana", "alloy", "loki") }

    "create-migration" {
        if (-not $Feature) { Write-Error "Please add -Feature (e.g. -Feature budget)"; exit 1 }
        if (-not $Name) { Write-Error "Please add -Name: .\make.ps1 create-migration -Feature budget -Name AddAccounts"; exit 1 }
        $context = switch ($Feature) {
            "identity" { "IdentityDbContext" }
            "budget" { "BudgetDbContext" }
            "audit" { "AuditDbContext" }
            default { Write-Error "Unknown feature: $Feature"; exit 1 }
        }
        if (-not (Get-Command dotnet-ef -ErrorAction SilentlyContinue)) {
            Write-Host "dotnet-ef not found, installing..."
            dotnet tool install --global dotnet-ef --version 10.0.10
        }
        Set-Location $backendDir
        dotnet ef migrations add $Name `
            --project src/Household.Api/Household.Api.csproj `
            --context $context `
            --output-dir "Features/$Feature/Migrations"
        exit $LASTEXITCODE
    }

    default {
        Write-Error "Unknown target: $Target (run .\make.ps1 help)"
        exit 1
    }
}
