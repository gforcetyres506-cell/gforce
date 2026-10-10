// Retired: implicit identity/password defaults are not a provisioning process.
// No credentials are loaded, logged or changed.
console.error('Legacy admin provisioning is retired. Use an explicitly approved owner provisioning workflow.');
process.exitCode = 1;
