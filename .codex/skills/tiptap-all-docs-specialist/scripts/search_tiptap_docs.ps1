param(
  [Parameter(Mandatory = $true)]
  [string]$Query,
  [string]$DocsRoot = "",
  [int]$MaxFileMatches = 20,
  [int]$MaxContentMatches = 40
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DocsRoot)) {
  $defaultCandidate = Join-Path $PSScriptRoot "..\..\..\..\tiptap_all_docs"
  if (Test-Path -LiteralPath $defaultCandidate) {
    $DocsRoot = (Resolve-Path -LiteralPath $defaultCandidate).Path
  } else {
    throw "DocsRoot is required when default relative path is unavailable."
  }
}

if (-not (Test-Path -LiteralPath $DocsRoot)) {
  throw "Docs root not found: $DocsRoot"
}

$tokens = @($Query -split '[^\p{L}\p{Nd}_-]+' | Where-Object { $_ -and $_.Length -ge 2 })
if ($tokens.Count -eq 0) {
  $tokens = @($Query)
}

$escapedTokens = $tokens | ForEach-Object { [regex]::Escape($_) }
$pattern = ($escapedTokens -join "|")

Write-Host "Docs root: $DocsRoot"
Write-Host "Query: $Query"
Write-Host "Pattern: $pattern"
Write-Host ""

$hasRg = [bool](Get-Command rg -ErrorAction SilentlyContinue)

Write-Host "=== Filename Matches ==="
if ($hasRg) {
  $allFiles = & rg --files $DocsRoot
  $fileMatches = $allFiles |
    Where-Object { $_ -match "\\.md$" } |
    Where-Object { $_ -imatch $pattern } |
    Select-Object -First $MaxFileMatches

  if ($fileMatches) {
    $fileMatches | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "(none)"
  }
} else {
  $fileMatches = Get-ChildItem -Recurse -File -Path $DocsRoot -Filter *.md |
    Where-Object { $_.Name -imatch $pattern } |
    Select-Object -First $MaxFileMatches -ExpandProperty FullName
  if ($fileMatches) {
    $fileMatches | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "(none)"
  }
}

Write-Host ""
Write-Host "=== Content Matches ==="
if ($hasRg) {
  $contentMatches = & rg -n -i --max-count $MaxContentMatches $pattern $DocsRoot
  if ($contentMatches) {
    $contentMatches | Select-Object -First $MaxContentMatches | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "(none)"
  }
} else {
  $contentMatches = Get-ChildItem -Recurse -File -Path $DocsRoot -Filter *.md |
    Select-String -Pattern $pattern -CaseSensitive:$false |
    Select-Object -First $MaxContentMatches
  if ($contentMatches) {
    $contentMatches | ForEach-Object {
      Write-Host ("{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim())
    }
  } else {
    Write-Host "(none)"
  }
}
