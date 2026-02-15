# setup-task.ps1
$taskName = "ConstructorServerWatchdog"
$scriptPath = "C:\Users\yoel\constructor\scripts\server-watchdog.ps1"
$workingDir = "C:\Users\yoel\constructor"

# Unregister existing task if it exists (for idempotency)
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task: $taskName"
}

# Create new task
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $workingDir
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650) 
# Note: RepetitionDuration is required for indefinite repetition, setting to 10 years effectively for now.

# Configure settings (allow start if on battery, wake to run, etc.)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances Parallel

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($trigger1, $trigger2) -Settings $settings -Description "Ensures the Constructor server is running. Checked hourly and at logon."

Write-Host "Task '$taskName' registered successfully."
Write-Host "Triggers: At Logon, and every 1 hour."
Write-Host "To verify, open Task Scheduler or run: Get-ScheduledTask -TaskName '$taskName'"
