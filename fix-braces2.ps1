$file = 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx'
$lines = Get-Content $file
# Find and fix line 4551 (index 4550)
if ($lines[4550] -match '}}') {
    $lines[4550] = $lines[4550] -replace '}}$', '}'
    Write-Host "Fixed line 4551"
}
# Find and fix line 4637 (index 4636) - same issue for workspace
if ($lines[4636] -match '}}') {
    $lines[4636] = $lines[4636] -replace '}}$', '}'
    Write-Host "Fixed line 4637"
}
Set-Content $file $lines
Write-Host "Done"
