$file = 'src/modules/document-knowledge-management/pages/DocumentKnowledgeManagementPage.tsx'
$content = Get-Content $file -Raw

# Fix both occurrences of }} that should be }
# Pattern: return next\n})\ n}} should be return next\n})\n}
$oldPattern = "return next`r`n                                                          })`r`n                                                        }}`r`n                                                        className"
$newPattern = "return next`r`n                                                          })`r`n                                                        }`r`n                                                        className"
$content = $content -replace [regex]::Escape($oldPattern), $newPattern

Set-Content $file $content -NoNewline
Write-Host "Fixed braces in $file"
