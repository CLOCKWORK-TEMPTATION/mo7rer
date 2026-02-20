param(
  [string]$BaseUrl = "http://127.0.0.1:8787",
  [string]$EndpointPath = "/api/file-extract"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$extractUrl = ($BaseUrl.TrimEnd("/") + $EndpointPath)

$fixtures = @(
  "tests/fixtures/regression/12.doc",
  "tests/fixtures/regression/12.docx",
  "tests/fixtures/regression/12.pdf"
)

Write-Host "Running JSON extract smoke against: $extractUrl"

$availableFixtures = @()
foreach ($fixture in $fixtures) {
  $fixturePath = Join-Path $projectRoot $fixture
  if (Test-Path $fixturePath) {
    $availableFixtures += $fixturePath
  } else {
    Write-Warning "Fixture not found and will be skipped: $fixturePath"
  }
}

if ($availableFixtures.Count -eq 0) {
  throw "No fixtures found. Add regression fixtures or pass a valid setup before smoke test."
}

foreach ($fixturePath in $availableFixtures) {
  $name = Split-Path -Leaf $fixturePath
  $extension = [System.IO.Path]::GetExtension($name).TrimStart('.').ToLowerInvariant()

  $bytes = [System.IO.File]::ReadAllBytes($fixturePath)
  $base64 = [System.Convert]::ToBase64String($bytes)

  $payload = @{
    filename = $name
    extension = $extension
    fileBase64 = $base64
  } | ConvertTo-Json -Depth 5

  try {
    $response = Invoke-RestMethod -Uri $extractUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $payload -TimeoutSec 180

    if ($response.success -and $response.data) {
      $method = $response.data.method
      Write-Host ("[PASS] {0} -> method={1}" -f $name, $method)
    } else {
      $errorMessage = if ($response.error) { $response.error } else { "Unknown error" }
      Write-Host ("[FAIL] {0} -> {1}" -f $name, $errorMessage)
    }
  } catch {
    Write-Host ("[FAIL] {0} -> request failed: {1}" -f $name, $_.Exception.Message)
  }
}
