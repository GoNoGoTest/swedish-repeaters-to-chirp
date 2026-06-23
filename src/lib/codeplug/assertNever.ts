// Tvingar TypeScript att verifiera exhaustivitet i switch/if-kedjor över
// diskriminerade unioner. Anropas i default-grenen — om en variant glöms
// kvar blir argumentet inte `never` och bygget fel.
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
