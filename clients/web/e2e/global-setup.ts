import { activateBudgetModule, startStack } from "./stack"

export default async function globalSetup() {
  await startStack()
  await activateBudgetModule()
}
