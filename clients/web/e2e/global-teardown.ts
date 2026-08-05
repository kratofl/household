import { stopStack } from "./stack"

export default async function globalTeardown() {
  stopStack()
}
