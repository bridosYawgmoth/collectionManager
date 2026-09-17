#!/bin/sh
# Secret-scan wrapper for the lefthook stages.
#
# What it buys: lefthook prints one `fail_text` for every non-zero exit, so a
# missing binary reported the same "stop and rotate" message as a real finding.
# A control that cannot tell those apart teaches you to bypass it. This keeps
# clean / secret found / scanner unavailable as three distinct outcomes.
#
# Usage: scripts/gitleaks-scan.sh <staged|history>
# Exits 0 clean, 1 secret found, 2 scanner unavailable or errored.

set -u

scope="${1:-}"

# Hooks run from a non-login shell, and `brew shellenv` is only sourced from
# ~/.zprofile — so PATH alone is not enough to conclude the binary is absent.
gitleaks="$(command -v gitleaks 2>/dev/null || true)"
if [ -z "$gitleaks" ]; then
  for candidate in /opt/homebrew/bin/gitleaks /usr/local/bin/gitleaks; do
    if [ -x "$candidate" ]; then
      gitleaks="$candidate"
      break
    fi
  done
fi

if [ -z "$gitleaks" ]; then
  echo "SCANNER UNAVAILABLE: gitleaks was not found, so nothing was scanned."
  echo "This is NOT a finding. Nothing is known about your secrets either way."
  echo "Install it, then retry:  brew install gitleaks"
  exit 2
fi

case "$scope" in
  staged) set -- git --pre-commit --staged --redact --verbose . ;;
  history) set -- git --redact --verbose . ;;
  *)
    echo "SCANNER ERROR: expected a scope of 'staged' or 'history', got '${scope}'."
    exit 2
    ;;
esac

"$gitleaks" "$@"
status=$?

case "$status" in
  0) exit 0 ;;
  1)
    echo
    echo "SECRET FOUND: gitleaks flagged the redacted finding above."
    echo "This repo is public — remove the value and rotate the credential."
    exit 1
    ;;
  *)
    echo
    echo "SCANNER ERROR: gitleaks exited ${status} without completing the scan."
    echo "This is NOT a finding. Fix the scanner and retry rather than bypassing."
    exit 2
    ;;
esac
