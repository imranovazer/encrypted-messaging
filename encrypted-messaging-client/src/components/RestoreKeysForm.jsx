// Restore keys from backup when key is missing or decryption fails.
export default function RestoreKeysForm({
  reason,
  password,
  onPasswordChange,
  onSubmit,
  loading,
  error: submitError,
}) {
  const isNoKey = reason === 'no-key';
  const message = isNoKey
    ? 'Private key not found. Restore your keys from backup below (e.g. new device or cleared storage).'
    : "Some messages couldn't be decrypted—often because the key was changed or you're on a different device. Restore your keys with your password to read them.";

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 flex-shrink-0 space-y-2">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded">
        {message}
      </div>
      <form
        onSubmit={onSubmit}
        className="bg-amber-50/50 border border-amber-200 rounded px-4 py-3 flex flex-wrap items-end gap-3"
      >
        <span className="text-amber-800 text-sm">Password:</span>
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Your password"
          className="px-3 py-1.5 border border-amber-300 rounded text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Restoring…' : 'Restore keys'}
        </button>
        {submitError && (
          <span className="text-red-600 text-sm w-full">{submitError}</span>
        )}
      </form>
    </div>
  );
}
