// Compile-time protocol tests (KAN-4 acceptance: "a type-level test asserts every
// `type` value is covered"). This file is type-checked, not executed. If a new
// CanvasMessage variant is added to protocol.ts without being handled here, the
// `assertNever(m)` call in the default branch fails to compile.

import {
  CanvasMessage,
  CanvasMessageType,
  PROTOCOL_VERSION,
  assertNever,
} from './protocol';

/** Exhaustive handler over the discriminated union. */
export function handle(m: CanvasMessage): string {
  switch (m.type) {
    case 'diagram':
      return m.diagramId;
    case 'patch':
      return `${m.add.length}+/${m.remove.length}-`;
    case 'highlight':
      return m.style;
    case 'status':
      return m.state;
    case 'hello':
      return m.client;
    case 'node_selected':
      return m.diagramId;
    case 'interaction':
      return m.action;
    case 'save_image':
      return m.fileName;
    case 'ack':
      return m.type;
    case 'error':
      return m.message;
    default:
      // Compile error here means a CanvasMessage variant is unhandled above.
      return assertNever(m);
  }
}

// Every discriminant value, enumerated. Adding a variant without listing it here
// is a compile error (the union below would not be assignable).
const ALL_TYPES: Record<CanvasMessageType, true> = {
  diagram: true,
  patch: true,
  highlight: true,
  status: true,
  hello: true,
  node_selected: true,
  interaction: true,
  save_image: true,
  ack: true,
  error: true,
};

// Sanity: the protocol version constant is the literal 1.
const _version: 1 = PROTOCOL_VERSION;

// Reference the bindings so `noUnusedLocals` stays happy in a checked build.
export const _coverage = { ALL_TYPES, _version };
