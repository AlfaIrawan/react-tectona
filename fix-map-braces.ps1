$lines = Get-Content 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx'
# Fix line 4558: should be } not }}
# Line 4558 is the closing of the map arrow function
$lines[4557] = '                                                  }'
# Fix line 4644: same issue for workspace
$lines[4643] = '                                                  }'
Set-Content 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx' $lines
Write-Host 'Fixed map closing braces on lines 4558 and 4644'
