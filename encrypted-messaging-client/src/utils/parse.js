export function parseJsonIfString(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}
