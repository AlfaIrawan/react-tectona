// Review action colours come from theme tokens only, so they follow the active
// accent (data-accent) and dark mode: one hue at three strengths (solid primary
// for Approve, soft and outline primary for the rest) plus destructive for Reject.
export const REVIEW_ACTION_TONE = {
  soft: '!border-primary/25 !bg-primary/10 !text-primary hover:!border-primary/40 hover:!bg-primary/15 hover:!text-primary',
  outline: '!border-primary/40 !bg-transparent !text-primary hover:!bg-primary/10 hover:!text-primary',
  destructive: '!border-destructive/30 !bg-destructive/10 !text-destructive hover:!border-destructive/50 hover:!bg-destructive/15 hover:!text-destructive',
} as const
