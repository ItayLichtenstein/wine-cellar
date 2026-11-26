#!/bin/sh
# Vercel "Ignored Build Step": exit 0 = skip this build, exit 1 = build.
# The free plan caps builds per day, and every push to every branch used to
# start one. GitHub CI already builds and tests each PR, so:
# - preview builds (PR branches) are skipped;
# - a production build is skipped when the merge changed only docs.
if [ "$VERCEL_ENV" != "production" ]; then
  echo "Preview build skipped (CI builds every PR)"
  exit 0
fi
if git diff --quiet HEAD^ HEAD -- . ':(exclude)docs' ':(exclude)*.md' 2>/dev/null; then
  echo "Only docs changed, production build skipped"
  exit 0
fi
exit 1
