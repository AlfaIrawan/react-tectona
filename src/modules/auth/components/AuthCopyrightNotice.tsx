export function AuthCopyrightNotice() {
  const year = new Date().getFullYear()

  return (
    <p className="tectona-auth-copyright text-xs text-muted-foreground/80">
      © {year} Tectona. Powered by Adira Finance.
    </p>
  )
}
