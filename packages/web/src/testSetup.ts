import "@testing-library/jest-dom";

// jsdom's AbortController creates AbortSignal objects that aren't instances of
// Node.js's native AbortSignal. React Router v7's createClientSideRequest calls
// new Request(url, { signal }) with this signal, and undici (Node.js v24+)
// validates that the signal is a genuine AbortSignal instance, rejecting jsdom's.
// We wrap the Request constructor to strip the non-native signal.

const OrigRequest = globalThis.Request;

globalThis.Request = new Proxy(OrigRequest, {
  construct(target, args: ConstructorParameters<typeof OrigRequest>) {
    const [input, init] = args;
    if (init?.signal) {
      // Strip the signal — undici rejects jsdom's AbortSignal.
      // Navigating with a signal is not critical in test navigation.
      const { signal: _signal, ...rest } = init;
      return new target(input, rest);
    }
    return new target(input, init);
  },
}) as typeof Request;
