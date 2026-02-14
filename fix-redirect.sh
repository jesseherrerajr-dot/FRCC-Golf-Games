#!/bin/bash

# Search for hardcoded localhost redirects and remove them
# This will make Supabase use the Site URL we configured

find src/app -name "*.tsx" -type f -exec grep -l "localhost:3000" {} \; | while read file; do
  echo "Checking $file..."
  if grep -q "redirectTo.*localhost:3000" "$file"; then
    echo "  Found hardcoded localhost redirect in $file"
  fi
done
