/**
 * The account Vault opens filtered to: Bank accounts sets it just before it
 * opens Vault, and Vault takes it once, as it appears.
 */
let pending: string | null = null;

export function showAccountInVault(key: string): void {
  pending = key;
}

/** The account waiting for Vault, if any; clears it. */
export function takeVaultAccount(): string | null {
  const key = pending;
  pending = null;
  return key;
}
