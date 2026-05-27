import { createStore } from "../src/lib/store";

await createStore().ensureReady();
console.log("Database schema is ready.");
