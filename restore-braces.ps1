$lines = Get-Content 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx'
# Restore the double braces
$lines[4550] = '                                                        }}'
$lines[4636] = '                                                        }}'
Set-Content 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx' $lines
Write-Host 'Restored double braces on lines 4551 and 4637'
