import { readFile } from "node:fs/promises";
import { parseEvents, evaluateEvents } from "../src/core/evaluation";
const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run evaluate -- path/to/events.jsonl");
  process.exitCode = 1;
} else
  try {
    console.log(
      JSON.stringify(
        evaluateEvents(parseEvents(await readFile(path, "utf8"))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
