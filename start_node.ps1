$maxRetries = 1000
$retryCount = 0

Write-Host "Starting Quantix Node with auto-restart..." -ForegroundColor Cyan

while ($true) {
    Write-Host "Launching node (Attempt $retryCount)..." -ForegroundColor Green
    
    # Run the compile command first to ensure latest code
    call npm run compile
    
    # Start the node
    # Using 'call' if it was a batch, but in PS just running it is fine.
    # npm start usually runs 'node src/main.js'
    try {
        & npm start
    } catch {
        Write-Host "Node process crashed with error: $_" -ForegroundColor Red
    }

    Write-Host "Node stopped. Restarting in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $retryCount++
}
