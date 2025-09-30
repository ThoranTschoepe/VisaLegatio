// Lightweight debug logger. Set NEXT_PUBLIC_DEBUG=true to enable verbose logs.
export const debug = (...args: any[]) => {
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

export const warn = (...args: any[]) => {
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.warn(...args)
  }
}

export const error = (...args: any[]) => {
  // Always log errors in development, gate optionally in production if desired
  // eslint-disable-next-line no-console
  console.error(...args)
}
