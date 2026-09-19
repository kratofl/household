# PowerShell task runner mirroring the Makefile targets, for shells without a
# POSIX sh on PATH. Usage: .\make.ps1 <target>   (default: help)
#   .\make.ps1 dev
#   .\make.ps1 create-migration -Feature budget -Name AddExample
#   .\make.ps1 prod-restore -Backup deployments\backups\household-20260805.dump
#   .\make.ps1 seed-dev -Backup deployments\backups\household-20260805.dump
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

# Use the same POSIX script as Make. Git for Windows includes sh.exe.
$devTargets = @("dev", "dev-info", "dev-project", "dev-down", "dev-logs", "db-up", "db-down", "db-logs", "reset-dev-db", "api-dev", "web-dev", "logs", "observability-up", "observability-down", "observability-logs")
if ($Target -in $devTargets -or $Target -eq "seed-dev") {
    if ($Target -eq "seed-dev" -and -not $Backup) { Write-Error "Please add -Backup <path> (a dump from prod-backup)"; exit 1 }
    $gitCommand = Get-Command git -ErrorAction Stop
    $gitShell = Join-Path (Split-Path (Split-Path $gitCommand.Source)) "bin/sh.exe"
    if (Test-Path $gitShell) { $shellPath = $gitShell }
    else { $shellPath = (Get-Command sh -ErrorAction Stop).Source }
    if ($Target -eq "seed-dev") { & $shellPath (Join-Path $root "scripts/dev.sh") $Target $Backup }
    else { & $shellPath (Join-Path $root "scripts/dev.sh") $Target }
    exit $LASTEXITCODE
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
        Write-Host "Development:  dev, dev-info, dev-down, dev-logs, db-up, db-logs, reset-dev-db,"
        Write-Host "              seed-dev -Backup <path>"
        Write-Host "Quality:      check, backend-test, backend-build, web-lint, web-build, compose-config, workflow-check"
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

    "check" {
        foreach ($step in "backend-test", "backend-build", "web-lint", "web-build", "compose-config", "workflow-check") {
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

    "workflow-check" {
        Invoke-Step "Linting GitHub Actions workflows" {
            docker run --rm -v "${root}:/repo:ro" -w /repo rhysd/actionlint:1.7.12 -color }
        Invoke-Step "Testing release bundles" {
            Set-Location $root; node --test scripts/create-release-bundle.test.mjs }
    }

    "compose-config" {
        Invoke-Step "Validating production Compose" {
            docker compose --env-file $envExampleFile -f $prodComposeFile config --quiet }
        Invoke-Step "Validating production source-build Compose" {
            docker compose --env-file $envExampleFile -f $prodComposeFile -f $prodBuildComposeFile config --quiet }
        Invoke-Step "Validating development Compose" {
            docker compose --env-file (Join-Path $deployments "dev.env") -f $devComposeFile config --quiet }
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
