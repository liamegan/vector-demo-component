export function classList(...args) {
  return args.filter(a => a).join(' ');
}