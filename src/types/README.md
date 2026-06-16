# src/types/

Shared TypeScript types used across features:

- Re-exports from `lib/supabase/types.ts` (generated DB shape)
- Hand-written JSONB interfaces (`jsonb.ts`): `StorePaymentMethods`, `StoreDeliveryOptions`, `NotificationPrefs`, `NotificationData`
- Global utility types (pagination, result wrappers, etc.)

Feature-local types live under `features/<area>/types/`. Feature folders map to UI Spec areas — see `src/features/README.md`.
