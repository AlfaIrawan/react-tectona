# -*- coding: utf-8 -*-
path = r"d:/Github Project/Project  Management/react-tectona/src/modules/workspace-management/pages/WorkspaceManagementPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    s = f.read()
old_ws = """                  setAssignGovernanceWorkspace(next)
                  setAssignGovernanceForm(buildGovernanceAssignmentForm(next))
                  setAssignGovernanceError(null)"""
new_ws = """                  setAssignGovernanceWorkspace(next)
                  setAssignGovernanceForm(
                    buildGovernanceAssignmentForm(next, governanceAssignmentByWorkspaceId.get(next.id))
                  )
                  setAssignGovernanceError(null)"""
if old_ws not in s:
    raise SystemExit("workspace onChange block not found")
s = s.replace(old_ws, new_ws, 1)

marker_start = '            <div className="space-y-1.5">\n              <Label htmlFor="gov-template"'
marker_end = '            <div className="space-y-1.5">\n              <Label htmlFor="gov-score"'
idx = s.find(marker_start)
idx2 = s.find(marker_end)
if idx == -1 or idx2 == -1 or idx2 <= idx:
    raise SystemExit("markers not found")
# include through end of gov-score block (next div closing)
rest = s[idx2:]
end_rel = rest.find('            </div>\n\n          {assignGovernanceError')
if end_rel == -1:
    raise SystemExit("end marker not found")
end = idx2 + end_rel + len('            </div>\n')
new_block = r'''            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
              <span className="font-medium text-foreground">Catalog-backed assignment.</span>{' '}
              Pilih entri dari Governance Configuration Center; skor kepatuhan dihitung di server.{' '}
              <Link to="/governance-configuration" className="text-primary underline-offset-2 hover:underline">
                Buka Configuration Center
              </Link>
              {!governanceCatalog ? (
                <span className="mt-1 block text-amber-700">
                  Layanan governance belum tersedia — form berikut memerlukan backend workspace-governance (port 8428) + proxy Vite.
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gov-template" className="text-xs text-muted-foreground">Governance Template</Label>
              <Select
                id="gov-template"
                value={assignGovernanceForm?.governanceTemplateId ?? ''}
                disabled={assignGovernanceSubmitting || !governanceCatalog}
                onChange={(e) =>
                  setAssignGovernanceForm((f) => (f ? { ...f, governanceTemplateId: e.target.value } : f))
                }
                className="h-10 w-full"
              >
                <option value="">Select template</option>
                {(governanceCatalog?.templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gov-owner" className="text-xs text-muted-foreground">Governance Owner</Label>
              <Input
                id="gov-owner"
                value={assignGovernanceForm?.governanceOwner ?? ''}
                disabled={assignGovernanceSubmitting}
                onChange={(e) => setAssignGovernanceForm((f) => (f ? { ...f, governanceOwner: e.target.value } : f))}
                placeholder="e.g. PMO Governance Board"
                className="h-10 w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gov-workflow" className="text-xs text-muted-foreground">Workflow Policy</Label>
              <Select
                id="gov-workflow"
                value={assignGovernanceForm?.workflowPolicyId ?? ''}
                disabled={assignGovernanceSubmitting || !governanceCatalog}
                onChange={(e) =>
                  setAssignGovernanceForm((f) => (f ? { ...f, workflowPolicyId: e.target.value } : f))
                }
                className="h-10 w-full"
              >
                <option value="">Select workflow policy</option>
                {(governanceCatalog?.workflowPolicies ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gov-sla" className="text-xs text-muted-foreground">SLA Policy</Label>
              <Select
                id="gov-sla"
                value={assignGovernanceForm?.slaPolicyId ?? ''}
                disabled={assignGovernanceSubmitting || !governanceCatalog}
                onChange={(e) => setAssignGovernanceForm((f) => (f ? { ...f, slaPolicyId: e.target.value } : f))}
                className="h-10 w-full"
              >
                <option value="">Select SLA policy</option>
                {(governanceCatalog?.slaPolicies ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gov-naming" className="text-xs text-muted-foreground">Naming Convention</Label>
              <Select
                id="gov-naming"
                value={assignGovernanceForm?.namingConventionId ?? ''}
                disabled={assignGovernanceSubmitting || !governanceCatalog}
                onChange={(e) =>
                  setAssignGovernanceForm((f) => (f ? { ...f, namingConventionId: e.target.value } : f))
                }
                className="h-10 w-full"
              >
                <option value="">Select naming convention</option>
                {(governanceCatalog?.namingConventions ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gov-approval" className="text-xs text-muted-foreground">Approval Policy</Label>
              <Select
                id="gov-approval"
                value={assignGovernanceForm?.approvalPolicyId ?? ''}
                disabled={assignGovernanceSubmitting || !governanceCatalog}
                onChange={(e) =>
                  setAssignGovernanceForm((f) => (f ? { ...f, approvalPolicyId: e.target.value } : f))
                }
                className="h-10 w-full"
              >
                <option value="">Select approval policy</option>
                {(governanceCatalog?.approvalPolicies ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gov-last-review" className="text-xs text-muted-foreground">Last Review</Label>
              <Input
                id="gov-last-review"
                type="date"
                value={assignGovernanceForm?.lastReview ?? ''}
                disabled={assignGovernanceSubmitting}
                onChange={(e) => setAssignGovernanceForm((f) => (f ? { ...f, lastReview: e.target.value } : f))}
                className="h-10 w-full"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Compliance score (system-generated)</Label>
              <div className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm font-semibold tabular-nums text-foreground">
                {assignGovernanceWorkspace?.governance.complianceScore != null
                  ? assignGovernanceWorkspace.governance.complianceScore
                  : '—'}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Diperbarui otomatis setelah penyimpanan melalui layanan workspace-governance.
              </p>
            </div>'''

s = s[:idx] + new_block + s[end:]
with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("patched drawer catalog fields")
