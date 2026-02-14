#!/bin/bash

# Fix admin-actions.tsx - wrap async calls properly in startTransition
sed -i '' 's/startTransition(() => approveRegistration(profileId))/startTransition(async () => { await approveRegistration(profileId); })/g' src/app/admin/admin-actions.tsx
sed -i '' 's/startTransition(() => denyRegistration(profileId))/startTransition(async () => { await denyRegistration(profileId); })/g' src/app/admin/admin-actions.tsx

echo "✅ Admin actions fixed!"
