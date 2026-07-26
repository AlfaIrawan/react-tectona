$lines = Get-Content 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx'
# Fix line 4558: should be }) to close the arrow function AND the map call
$lines[4557] = '                                                  })'
# Fix line 4644: same issue for workspace
$lines[4643] = '                                                  })'
Set-Content 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx' $lines
Write-Host 'Fixed arrow function and map closing on lines 4558 and 4644'
